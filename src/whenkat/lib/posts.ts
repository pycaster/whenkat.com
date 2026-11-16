import type { PostSummary } from '../types';
export function dateValue(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid post date: ${value}`);
  return date;
}
export function dateLabel(value: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(dateValue(value));
}
export function groupPosts(posts: PostSummary[], preferred: string[] = []) {
  const groups = new Map<string, PostSummary[]>();
  for (const post of posts) {
    const name = post.series?.trim() || 'Engineering Notes';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(post);
  }
  const names = [...preferred.filter(name => groups.has(name)),
    ...[...groups.keys()].filter(name => !preferred.includes(name)).sort()];
  return names.map((name, index) => ({ name, id: `series-${index + 1}`,
    posts: [...groups.get(name)!].sort((a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      dateValue(b.date).getTime() - dateValue(a.date).getTime() || a.title.localeCompare(b.title)),
  }));
}
