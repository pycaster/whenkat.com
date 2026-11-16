// Shared by the build-time search index and the concept enrichment pass.
// Keep this dependency-free: it runs in Node during the build, never in the browser.

/**
 * English function words and prose filler. A reader searches for a problem or a
 * technology ("nvidia driver proxmox"), never for "good" or "going".
 *
 * Deliberately NOT listed, because they are real terms in this archive:
 * go (the language), node, image, service, port, state, host, core, key, value,
 * build, run, make, load, file, network, system, data.
 *
 * Shared with archive.js: if the index drops a word the query must drop it too,
 * or a filler word in the query fails the coverage floor and returns nothing.
 */
export const STOP = new Set(
  ('a an the this that these those each every some any all both few many much most other another such no nor not only own same ' +
   'i me my myself we us our ours you your yours he him his she her hers it its they them their theirs who whom whose what which ' +
   'am is are was were be been being have has had having do does did doing will would shall should can could may might must ' +
   'about above across after again against along among around as at before behind below beneath beside between beyond but by ' +
   'down during except for from in inside into like near of off on onto out outside over past since through throughout to ' +
   'toward under until up upon with within without and or if then than so because while where when why how ' +
   'get gets got gotten getting goes going gone went makes made making take takes took taken taking come comes came ' +
   'put puts keep keeps kept let lets say says said see sees saw seen look looks looked want wants wanted need needs needed ' +
   'try tries tried use uses used using give gives gave find finds found think thinks thought know knows knew known ' +
   'good bad better best worse worst new old big small large little long short high low easy hard simple nice great fine ' +
   'real actually really just basically simply quite very too also even still yet always never often sometimes usually ' +
   'maybe perhaps probably almost enough more less least lot lots thing things stuff way ways time times day days year years ' +
   'bit part parts kind sort end back next first last one two three here there now')
    .split(' ')
);


/** Strip Markdown/MDX syntax so the index holds prose, not code fences and URLs. */
export function cleanMarkdown(source: string): string {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ' ') // frontmatter
    .replace(/```[\s\S]*?```/g, ' ')                // fenced code
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')                     // inline code
    .replace(/^\s*import\s.+$/gm, ' ')              // MDX imports
    .replace(/^\s*export\s.+$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')          // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // links keep their text
    .replace(/<[^>]+>/g, ' ')                       // html / jsx tags
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_~`|\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Word-boundary tokens, stopwords and single characters removed. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 1 && !STOP.has(word));
}

/**
 * Text for the search index: markdown stripped, stop words removed, order kept.
 * MiniSearch derives its own term frequencies from this, so repeated words must
 * stay in; dropping the filler is what keeps the payload small.
 */
export function indexText(source: string): string {
  return tokenize(cleanMarkdown(source)).join(' ');
}
