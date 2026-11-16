import { rankJournals } from '../lib/search';

export function mountArticleList(root) {
  if (root.dataset.listMounted) return;
  root.dataset.listMounted = 'true';
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const input = root.querySelector('input[type="search"]');
  const clear = root.querySelector('[data-clear]');
  const counter = root.querySelector('[data-count]');
  const empty = root.querySelector('[data-empty]');
  const rows = [...root.querySelectorAll('[data-article]')];
  let posts = rows.map(row => ({
    href: row.querySelector('h2 a').getAttribute('href'),
    title: row.querySelector('h2').textContent,
    description: row.querySelector('.article-excerpt').textContent,
    series: row.dataset.series,
  }));

  function filter() {
    const query = input.value.trim();
    const matches = new Set(rankJournals(posts, query).map(result => result.post.href));
    // Keep the visible list in its original newest-first order as it narrows.
    rows.forEach((row, index) => { row.hidden = !matches.has(posts[index].href); });
    counter.textContent = `${matches.size} ${matches.size === 1 ? 'article' : 'articles'}${query ? ` of ${posts.length}` : ''}`;
    empty.hidden = matches.size > 0 || rows.length === 0;
    clear.hidden = !input.value;
  }
  function reset() { input.value = ''; filter(); input.focus(); }
  input.addEventListener('input', filter, options);
  input.addEventListener('keydown', event => { if (event.key === 'Escape') reset(); }, options);
  clear.addEventListener('click', reset, options);
  root.querySelector('form').addEventListener('submit', event => { event.preventDefault(); filter(); }, options);
  root.querySelector('[data-filter-panel]').hidden = false;
  root.classList.add('has-filter');
  filter();

  // Title, description, and series filtering works immediately. Add the existing
  // public full-text index and reviewed search aliases when available.
  fetch(root.dataset.index, options)
    .then(response => { if (!response.ok) throw new Error('Index unavailable'); return response.json(); })
    .then(index => {
      if (!Array.isArray(index) || controller.signal.aborted) return;
      const byHref = new Map(index.map(entry => [entry.href, entry]));
      posts = posts.map(post => ({ ...post, ...byHref.get(post.href) }));
      filter();
    })
    .catch(() => { /* Keep title/description filtering if the index is unavailable. */ });

  return () => { controller.abort(); delete root.dataset.listMounted; };
}
