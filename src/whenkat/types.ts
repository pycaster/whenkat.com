export interface PostSummary {
  /** Optional plain text or Markdown for browser-side full-text matching. Public posts only. */
  body?: string;
  title: string;
  /** Existing public URL, including its current trailing-slash convention. */
  href: string;
  date: Date | string;
  description?: string;
  series?: string;
  /** Optional episode order; otherwise newest first. */
  order?: number;
}
export interface Feature {
  post: PostSummary;
  headline?: string;
  description?: string;
  label?: string;
}
