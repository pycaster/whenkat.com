// Concept enrichment for the living archive search index.
//
// Two passes, so each extraction step stays focused and easy to review:
//   1. terms   - alternative names a reader might search ("golang", "k8s", "otel")
//   2. aliases - which word in the article each of those terms actually refers to
//                ("golang" -> "go"), used for query expansion in archive.js
//
// Both are cached by content hash and committed, so a normal build never needs
// the cluster: the model runs only for new or edited posts. A cached entry that
// predates pass 2 gets only pass 2, leaving its reviewed terms untouched.
//
//   npm run enrich            (needs: kubectl port-forward -n inference svc/llm 8000:8000)
//   npm run enrich -- --force (re-run both passes for every post)
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const CONTENT = 'src/content/blog';
const CACHE = 'src/whenkat/data/search-concepts.json';
const ENDPOINT = process.env.LLM_URL ?? 'http://127.0.0.1:8000/v1';
const MODEL = process.env.LLM_MODEL ?? 'qwen38-27b';
const MAX_TERMS = 12;
const force = process.argv.includes('--force');

// Generic words carrying no search signal. Splitting phrases such as "let's encrypt"
// or "values file" manufactures these, and they would match almost anything.
const GENERIC = new Set(('let lets file files self values value chart repo image images server servers '
  + 'node nodes bare metal api apis data app apps tool tools stack setup guide config '
  + 'system service services network cloud host hosts core using use new old best').split(' '));

const strip = source => source
  .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const words = value => String(value ?? '').toLowerCase().normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);

async function ask(prompt, schema) {
  const response = await fetch(`${ENDPOINT}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0, // keeps the committed cache stable across runs
      max_tokens: 500,
      // vLLM 0.29 silently ignores the older `guided_json` parameter, so this must
      // be the OpenAI-standard form; without it the model overruns max_tokens and
      // returns truncated JSON on longer posts.
      response_format: { type: 'json_schema', json_schema: { name: 'enrichment', schema } },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return JSON.parse((await response.json()).choices[0].message.content);
}

// --- pass 1: alternative names -------------------------------------------------

const TERMS_SCHEMA = {
  type: 'object',
  properties: { terms: { type: 'array', items: { type: 'string', maxLength: 30 }, maxItems: MAX_TERMS } },
  required: ['terms'],
};

const termsPrompt = (title, body) => `Article title: ${title}

Article text:
${body.slice(0, 6000)}

Name the technologies, concepts and products this article is about. For each, give ALTERNATIVE NAMES a reader might search instead: abbreviations, expansions, nicknames, and vendor or project names.

Rules:
- SINGLE WORDS ONLY. Never phrases. "go structured logging" is wrong.
- Only alternative spellings/names. Do not repeat words already common in the text.
- Examples of the mapping wanted: Go -> golang; Kubernetes -> k8s; NVIDIA -> cuda, nvidia; Postgres -> postgresql.
- Lowercase. At most ${MAX_TERMS}.

JSON: {"terms":["..."]}`;

/** Model output is untrusted: split phrases, drop junk, cap in the model's own order. */
function sanitizeTerms(raw) {
  if (!Array.isArray(raw)) return [];
  const terms = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    for (const word of words(item)) {
      if (word.length > 1 && word.length <= 30 && !GENERIC.has(word) && !terms.includes(word)) terms.push(word);
    }
  }
  return terms.slice(0, MAX_TERMS).sort();
}

// --- pass 2: which article word each term means --------------------------------

const ALIAS_SCHEMA = {
  type: 'object',
  properties: {
    pairs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { term: { type: 'string', maxLength: 30 }, article_word: { type: 'string', maxLength: 30 } },
        required: ['term', 'article_word'],
      },
    },
  },
  required: ['pairs'],
};

const aliasPrompt = (body, terms) => `Article text:
${body.slice(0, 6000)}

These are search terms for this article: ${terms.join(', ')}

For each one, which single word IN THE ARTICLE ABOVE refers to the same thing?
If the article uses the exact same word, or no word in the article means it, use "" (empty).

Example: term "golang" -> the article writes "go", so article_word is "go".

JSON: {"pairs":[{"term":"...","article_word":"..."}]}`;

/**
 * A pair survives only if the source word really occurs in the article, which
 * mechanically drops invented ones. Identity pairs are no-ops: the reader's word
 * is already in the text, so nothing needs expanding.
 */
function sanitizeAliases(raw, terms, vocabulary) {
  if (!Array.isArray(raw)) return {};
  const aliases = {};
  for (const pair of raw) {
    const [term] = words(pair?.term);
    const [source] = words(pair?.article_word);
    if (!term || !source || term === source) continue;
    if (!terms.includes(term)) continue;      // not a term we asked about
    if (!vocabulary.has(source)) continue;    // invented source word
    if (vocabulary.has(term)) continue;       // already searchable literally
    if (GENERIC.has(source)) continue;
    aliases[term] = source;
  }
  return aliases;
}

// --- run -----------------------------------------------------------------------

const cache = JSON.parse(await readFile(CACHE, 'utf8').catch(() => '{}'));
const files = (await readdir(CONTENT)).filter(name => /\.mdx?$/.test(name)).sort();

let terminated = 0, mapped = 0, reused = 0;
for (const file of files) {
  const source = await readFile(`${CONTENT}/${file}`, 'utf8');
  const href = `/blog/${file.replace(/\.mdx?$/, '')}/`;
  const title = (source.match(/^title:\s*['"]?(.*?)['"]?\s*$/m) ?? [, file])[1];
  const body = strip(source);
  const hash = createHash('sha256').update(title + '\n' + body).digest('hex').slice(0, 16);
  const vocabulary = new Set(words(body));
  const entry = cache[href];
  const stale = force || entry?.hash !== hash;

  if (!stale && entry.aliases) { reused++; continue; }
  process.stdout.write(`  ${href} ... `);
  try {
    const terms = stale ? sanitizeTerms((await ask(termsPrompt(title, body), TERMS_SCHEMA)).terms) : entry.terms;
    if (stale) terminated++;
    const aliases = sanitizeAliases((await ask(aliasPrompt(body, terms), ALIAS_SCHEMA)).pairs, terms, vocabulary);
    mapped++;
    cache[href] = { hash, terms, aliases };
    const shown = Object.entries(aliases).map(([t, s]) => `${t}->${s}`).join(' ');
    console.log(`${terms.length} terms${shown ? ', aliases: ' + shown : ', no aliases'}`);
  } catch (error) {
    console.log(`FAILED (${error.message.slice(0, 80)})`);
    if (!entry) process.exitCode = 1; // nothing cached to fall back on
  }
}

// Drop posts that no longer exist, and sort keys so the diff stays readable.
const live = new Set(files.map(f => `/blog/${f.replace(/\.mdx?$/, '')}/`));
const pruned = Object.fromEntries(Object.keys(cache).filter(k => live.has(k)).sort().map(k => [k, cache[k]]));

await writeFile(CACHE, JSON.stringify(pruned, null, 2) + '\n');
console.log(`\n${terminated} term passes, ${mapped} alias passes, ${reused} cached -> ${CACHE}`);
