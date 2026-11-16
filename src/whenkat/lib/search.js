import MiniSearch from 'minisearch';
// One shared stop list with the build-time index; see tokenize.ts for why.
import { STOP } from './tokenize';

const normalize = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');

// A title hit means more than a passing mention in the body. `concepts` are the
// model-generated aliases, kept below the real text so a bad alias cannot dominate.
const BOOST = { title: 4, series: 2.5, description: 2, concepts: 1.5, text: 1 };
// prefix: search-as-you-type. fuzzy: 0.2 * term length, so short words stay exact.
const SEARCH = { prefix: true, fuzzy: 0.2, boost: BOOST };

/**
 * Reader's word -> words the articles actually use, merged across every post and
 * made symmetric. MiniSearch has no synonym support; expanding the query is the
 * supported hook, so typing "k8s" also searches "kubernetes" and the posts that
 * only ever write it out get their real term frequencies counted.
 */
function aliasMap(posts) {
  const map = new Map();
  const link = (from, to) => {
    if (from === to) return;
    const existing = map.get(from);
    if (existing) { if (!existing.includes(to)) existing.push(to); } else map.set(from, [to]);
  };
  for (const post of posts)
    for (const [term, source] of Object.entries(post.aliases ?? {})) { link(term, source); link(source, term); }
  return map;
}

/** One engine per posts array; rebuilt when the fetched index replaces it. */
let indexed = { posts: null, engine: null, expand: null };
function engineFor(posts) {
  if (indexed.posts === posts) return indexed;
  // Same normalising and stop list as the build-time index.
  const clean = term => {
    const word = normalize(term);
    return word.length > 1 && !STOP.has(word) ? word : null;
  };
  const map = aliasMap(posts);
  const engine = new MiniSearch({
    idField: 'href',
    fields: ['title', 'description', 'series', 'concepts', 'text'],
    processTerm: clean,
    extractField: (post, field) =>
      field === 'concepts' ? (post.concepts ?? []).join(' ') : (post[field] ?? ''),
  });
  engine.addAll(posts);
  // Query-side only: documents stay indexed under their own words.
  const expand = term => {
    const word = clean(term);
    if (!word) return null;
    const also = map.get(word);
    return also ? [word, ...also] : word;
  };
  indexed = { posts, engine, expand };
  return indexed;
}

export function rankJournals(posts, query) {
  // Single characters are dropped by processTerm, so a query of only those would
  // match nothing and flash the empty state on the first keystroke. Treat it as
  // no query at all and keep the whole archive on screen.
  const terms = [...new Set(normalize(query).split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t)))];
  if (!terms.length) return posts.map((post, index) => ({ post, index, score: 0, coverage: 0 }));
  const position = new Map(posts.map((post, index) => [post.href, index]));
  const required = Math.ceil(terms.length * .6);
  const ranked = [];
  const { engine, expand } = engineFor(posts);
  for (const hit of engine.search(query, { ...SEARCH, processTerm: expand })) {
    const index = position.get(hit.id);
    // Require meaningful coverage so a long query does not pull in the entire archive.
    if (index === undefined || hit.queryTerms.length < required) continue;
    ranked.push({ post: posts[index], index, score: hit.score, coverage: hit.queryTerms.length });
  }
  return ranked.sort((a, b) => b.score - a.score || a.index - b.index);
}
