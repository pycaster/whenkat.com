// Build-time public search corpus for the article list and legacy archive.
// Filtering uses summaries immediately and loads this index for full-text search.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { indexText } from '../whenkat/lib/tokenize';
// Model-generated aliases, cached by content hash. Regenerate with `npm run enrich`.
import concepts from '../whenkat/data/search-concepts.json';

type Enrichment = { terms: string[]; aliases: Record<string, string> };
const entry_concepts = concepts as Record<string, Enrichment>;

export const GET: APIRoute = async () => {
  // Keep this collection aligned with the published Articles route.
  const entries = await getCollection('blog');

  const index = entries.map(entry => {
    const href = `/blog/${entry.id}/`;
    return {
      href,
      text: indexText(entry.body ?? ''),
      // Terms a reader might search that the post never literally uses.
      // Absent for a post added since the last enrich run; search still works.
      concepts: entry_concepts[href]?.terms ?? [],
      // { reader's word -> the word this article uses }, for query expansion.
      aliases: entry_concepts[href]?.aliases ?? {},
    };
  });

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
