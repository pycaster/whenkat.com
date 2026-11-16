# whenkat.com

Astro blog with Markdown/MDX content in `src/content/blog/`.

## Develop and build

Requires Node 22.12 or newer. Run `npm ci`, then `npm run dev` from the repository root.
Use `npm run build` for production and `npm run preview` to inspect the output.

## Presentation layer

The homepage, blog archive, article adapter, and About page use `src/whenkat/`.
Original editorial artwork is in `public/whenkat/`.

The homepage shows Venkat Reddy Marepally’s name and links to two destinations: Articles (`/blog/`)
and About me (`/about/`). It uses `HomePage.astro`, `SiteLayout.astro`, and
`styles/professional-home.css`. The About me page contains confirmed career facts and a personal introduction;
missing dates, education details, and outcome claims are intentionally omitted.
The previous `/resume/` route redirects to `/about/`.

The Articles page at `/blog/` lists all published posts, newest first. Each title
links to its existing article page. A keyword field on the right narrows the list
as you type; it moves above the list on mobile. Clear the field to show everything.
The list is rendered as ordinary HTML, so every article remains accessible with
JavaScript disabled. The filter only appears when JavaScript is available.

`src/whenkat/scripts/article-list.js` handles filtering using shared search logic
in `src/whenkat/lib/search.js`. Titles, descriptions, and series are searchable
immediately; the build-time index adds full article text and reviewed aliases.
Filtering keeps the list in its original order.

The older `LivingArchive.astro` and editorial presentation components remain as
unused alternatives. Article URLs remain `/blog/${entry.id}/`. Every collection
entry is published; there are no draft or scheduled-publication fields.

`src/layouts/BlogPost.astro` adapts existing article fields and neighbors to
`PostLayout`, retaining updated dates, hero images, MDX, and the existing Giscus
component. Comments still map to pathnames in the same GitHub repository/category.
Canonical links, RSS, sitemap, and fallback social images remain available.
The Docs pages retain their existing presentation. Articles open directly on their own pages, including MDX widgets and comments.

Edit `styles/professional-home.css` for the homepage, `styles/theme.css` for
shared layouts and article/About styling, `styles/article-list.css` for the
Articles list, and `config.ts` for brand links and series ordering.

Fonts load from Google Fonts (DM Sans and IBM Plex Mono), with system fallbacks.
For offline fonts, replace the CSS import with local font-face declarations.

See `presentation-examples/` for generic integration examples and the supplied
kit README. These are references, not routes; the actual adapters live in `src/pages/`.

## Search

Search runs entirely in the browser over a build-time index, with no search
service or API key. `src/pages/search-index.json.ts` emits `/search-index.json`
at build time: per post, the article text with Markdown, code fences and URLs
stripped and stop words removed, plus the enrichment terms below. The list loads it after first paint; until it arrives, titles, series, and
excerpts are still searchable.

Ranking is [MiniSearch](https://github.com/lucaong/minisearch) (BM25, field
boosts, prefix matching for search-as-you-type, and fuzzy matching for typos).
`src/whenkat/lib/tokenize.ts` holds the shared stop list, imported by both the
build-time index and the browser so a filler word in a query cannot fail the
coverage check.

## Search enrichment

`npm run enrich` asks a local model for the words a reader might search that an
article never actually uses, such as `golang` for a post that only writes `Go`,
or `k8s` for one that writes `kubernetes`. Two passes per post: the alternative
names, then which word in the article each one refers to. The second pass feeds
query expansion, so searching `k8s` also searches `kubernetes` and posts that
only spell it out are ranked on their real content.

Results are cached by content hash in `src/whenkat/data/search-concepts.json` and
committed, so the model runs only for new or edited posts and an ordinary build
never needs the cluster or credentials. Generated terms are reviewable in the
diff before they reach the public index; deleting a line is a valid edit and
nothing regenerates unless that post changes.

It expects an OpenAI-compatible endpoint. The default is `http://127.0.0.1:8000/v1`
with model `qwen38-27b`, reachable via
`kubectl port-forward -n inference svc/llm 8000:8000`. Override with `LLM_URL`
and `LLM_MODEL`.

## Build and release

This repository owns the website source and container build. Infrastructure and
Argo CD manifests remain in a separate private repository. The domain, Kubernetes
hosting, tunnel, and gateway do not move with this source extraction.

`.github/workflows/site.yaml` validates the version, builds Astro, and builds the
container on pull requests and pushes to `main`. Those events do not publish an
image or deploy the website.

After reviewing a release, set `VERSION` to a fresh `YYYY.MM.DD.N` value. Run the
workflow manually from `main` with **Publish a container image** enabled to push
`ghcr.io/pycaster/whenkat.com:<VERSION>`. Treat release tags as immutable: never
reuse a published version. The image also receives a `sha-<commit>` tag and OCI
source/revision labels. No `latest` tag is published.

Image publication also requires approval from `pycaster` in the
`production-image` environment, which accepts protected branches. The workflow
still restricts publication to `main`.

The workflow uses its repository-scoped `GITHUB_TOKEN`; no private infrastructure
repository credentials are needed. GHCR packages initially default to private;
verify package visibility and cluster pull access before selecting the image for
a deployment. See [GitHub's Container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Publishing an image does not deploy it. A separately reviewed change in the
private infrastructure repository selects the image tag or digest for Argo CD.
Keep the previous image reference available for rollback. Never commit cluster
credentials or deployment secrets here.

## Source and content boundaries

This project started as a snapshot of the existing website directory, without
history from the private infrastructure repository. Website routes, content,
assets, and Giscus configuration are retained. Older articles and diagrams
may describe the original single-repository publishing workflow; they are
historical accounts, not instructions for the release process above.

All posts in `src/content/blog/` are included in builds. There is no private draft
or scheduled-publication filter. Keep private notes and career evidence outside
this repository; review and sanitize material before adding it here.

## Repository protections

`main` requires a pull request with passing `build`, `Filesystem vulnerabilities`,
and `Blog container image` checks from GitHub Actions. The branch must be current,
conversations resolved, and history linear. These rules apply to administrators;
force-pushes and deletion are disabled. Since this is a single-maintainer repo,
merging an author's own PR is supported; a second person's approval is not required.

All workflow actions are pinned to reviewed commit SHAs. CI tokens default to
read-only, fork workflows require approval for external contributors, and only the
manual release job receives package-write permission after environment approval.
The public repository has no cluster or private-repository deployment credentials.
The private deployment repository selects an explicit image digest, so merging
website code or publishing a replacement tag cannot by itself change the live site.

These controls do not replace reviewing code and dependency changes. An account
with repository administration access can still change repository settings.
