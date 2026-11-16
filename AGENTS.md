# whenkat.com agent guidance

These instructions apply throughout this repository. Read `README.md` and any
more specific `AGENTS.md` before editing. Use a task branch and preserve unrelated
user changes. This is public website source: keep private notes, credentials,
employer artifacts, and infrastructure configuration out of this repository.

## Structure and design

- Keep Astro and existing Kubernetes hosting. Deployment manifests are maintained
  separately in a private repository; this repository builds the website image.
- Routes: `src/pages/`. Markdown/MDX posts: `src/content/blog/`. Collection schema:
  `src/content.config.ts`. Every post is built; there is no private draft filter.
- The homepage uses `src/whenkat/components/HomePage.astro` and `SiteLayout`.
  The Articles route at `/blog/` renders a plain list with a keyword filter on
  the side (above the list on mobile). All articles are visible by default and
  link to their own pages. The professional and personal introduction is at `/about/`; `/resume/` redirects there.
- About/articles use layouts in `src/whenkat/layouts/`. Docs use older components
  in `src/components/` plus static HTML in `public/docs/`. Check affected navigation
  surfaces explicitly; do not assume a shared header covers every route.
- Homepage styling: `src/whenkat/styles/professional-home.css`. Articles list:
  `src/whenkat/styles/article-list.css`. Shared article/About styling:
  `src/whenkat/styles/theme.css`. Brand links: `src/whenkat/config.ts`.
- Preserve the curiosity-driven voice, dark palette, lime accents, personal
  content, writing, and diagrams. Prefer small extensions over redesigns.
- Preserve article paths, canonical URLs, RSS, sitemap, search, Giscus identifiers,
  and accessible fallback links. Distinguish intended behavior from verified
  runtime results; older infrastructure articles can describe historical setups.

### Professional home content

The website work aims to support networking and future opportunities through a
clear introduction, career progression, a public résumé, selected project
stories, and contact links. Extend the existing site incrementally.

The homepage has two content destinations: Articles and About me. Assume this
structure; do not ask visitors questions, require a persona selection, or add an
onboarding questionnaire. The full name is Venkat Reddy Marepally. Make both
destinations immediately visible. Keep the homepage extremely simple: the full
name and two plain text links, without an introduction or About me summary. Avoid decorative effects, oversized
slogans, panels, or extra homepage navigation. Keep Articles list-first, with
search as an optional narrowing tool. Preserve useful writing and content. Put career history on the About me page and any project stories within
these two sections. Contact links can be ordinary links, not a third section.

- Use user-confirmed career facts. Do not invent dates, metrics, titles,
  accomplishments, education details, project ownership, or outcomes.
- Ask for missing details when they affect accuracy. Keep unresolved notes out
  of public routes rather than publishing placeholders or guesses.
- For project stories, establish the problem, constraints, alternatives,
  personal contribution, and verified outcomes. Distinguish the user's decisions
  and work from team contributions and agent assistance.
- Existing posts and code can support a story but do not independently prove
  authorship, measured impact, or production reliability. Separate intended
  benefits from demonstrated results.
- Do not publish confidential employer information, internal plans, private
  endpoints, credentials, or unapproved employer artifacts. A private repository
  is not permission to copy its contents into a public website.
- Preserve the personal-views disclaimer where relevant.
- The proposed OpenCode decision-record plugin is outside this website scope.
  Do not implement it as part of this work.

## Working and validation

- Follow Node requirements in `package.json`. Use `npm ci` when dependencies are
  missing or dependency inputs change, then `npm run build` for website changes.
- Check affected visual/navigation behavior at desktop and mobile widths when
  preview tooling is available. Check keyboard behavior and reduced motion when
  affected. Report verification limits.
- Documentation-only edits need a diff/whitespace review, not a full build.
- `npm run enrich` is optional, calls a configurable model endpoint, and changes
  the committed search cache. Normal builds use the existing cache and need no
  model, cluster access, or credentials. Do not run enrichment for unrelated work.
- Preserve the Docker build and NGINX serving configuration unless relevant to
  the task. Never include local environment files in the image or Git commits.

## Publishing

- Push, merge, publish images, or deploy only when the user authorizes that
  step. Source publication and live deployment are separate operations.
- The site workflow builds on PRs/pushes; image publishing is a manual opt-in
  from `main`. Publishing does not update the private deployment repository.
- Use a fresh calendar version in `VERSION` for an authorized release. Do not
  overwrite a published version. Deployment selects that release separately.
- Summarize changes, validation, and remaining review items before handoff.

- `main` is protected, including for admins. Publish code through a pull request
  and required checks; do not push directly or bypass protections.
- Keep action references pinned to full commit SHAs. Image releases require the
  `production-image` environment and explicit owner approval, in addition to the
  manual dispatch from `main`. Keep package-write permission confined to that job.
