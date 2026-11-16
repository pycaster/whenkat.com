# Whenkat — Astro presentation layer

The black / acid-yellow editorial design from the reimagined Whenkat preview, converted into reusable Astro components. Your Markdown remains the source of truth. Your existing Git → build → publish pipeline stays in place.

This is a source integration kit, not a replacement repository or a downloaded copy of your articles. It adds no client-side framework or JavaScript runtime. No package installation is required in an existing compatible Astro project. The components use Astro and plain CSS; the collection route examples use Astro's Content Layer API.

## Start here

1. Create a design branch in your existing repository.
2. Copy this kit's `src/whenkat/` into your repository's `src/whenkat/`.
3. Copy `public/whenkat/` into your repository's `public/whenkat/`.
4. Integrate your homepage using `examples/index.astro`. Copy it to `src/pages/index.astro` only after adapting the collection name and field mapping described below.
5. In your existing article route, replace its presentation wrapper with `PostLayout`. Keep your existing route generation, content rendering, permalink logic, and comments configuration.
6. Wrap your current About content in `PageLayout` (see `examples/about.astro`).
7. Run your repository's usual build command and preview. Commit and push through your existing deployment workflow.

Do not copy `examples/` into `src/pages/` wholesale. They are integration examples, with paths documented in each file. No changes to your Dockerfile, CI, Kubernetes manifests, Astro adapter, RSS implementation, or dependency lockfile are needed for the presentation itself.

I have not inspected your source repository. Collection names, frontmatter names, route helpers, and your metadata/comments components must be connected once at the integration boundary.

## What to edit later

| File | Responsibility |
| --- | --- |
| `src/whenkat/styles/theme.css` | Palette, typography, spacing, breakpoints, motion, article styles |
| `src/whenkat/config.ts` | Brand, profile links, asset paths, preferred series order |
| `src/whenkat/components/HomePage.astro` | Homepage composition and introduction |
| `src/whenkat/components/FeaturedPost.astro` | Featured article and artwork |
| `src/whenkat/components/Journal.astro` | Series navigation and automatically generated article lists |
| `src/whenkat/components/Header.astro` / `Footer.astro` | Shared navigation and footer |
| `src/whenkat/layouts/SiteLayout.astro` | HTML shell, metadata, stylesheet import |
| `src/whenkat/layouts/PostLayout.astro` | Article title/date, Markdown slot, series navigation, comments slot |
| `src/whenkat/layouts/PageLayout.astro` | About and other prose pages |
| `src/whenkat/lib/posts.ts` | Grouping, episode order, date formatting |
| `public/whenkat/compute-core.png` | Original generated editorial artwork from the preview |

## Connect your content once

Presentation components accept ordinary data, independent of your collection schema:

```ts
interface PostSummary {
  title: string;
  href: string;             // Exact existing public URL
  date: Date | string;      // Date or ISO date string
  description?: string;
  series?: string;          // Display label, e.g. "Building the Homelab"
  order?: number;           // Episode order when applicable
}
```

The example homepage assumes a `blog` collection with `title`, `pubDate`, `description`, `series`, `seriesOrder`, and `draft` fields. Adapt these names to your existing schema; do not rename all your content to fit the example. If `series` is an object or reference, resolve its display title in the mapping. If the collection does not declare `draft`, remove that filter or use your existing publication filter. Keep any existing scheduled-publication rules too.

The sample URL `/blog/${entry.id}/` is only an example. Keep your current URL helper. Older collections may use `entry.slug`; custom frontmatter may use `data.slug`. Changing the visual layer should not change a published URL.

The journal's counts come from the data, not hardcoded numbers. Series appear in the configured order; unfamiliar series are appended alphabetically. Numbered episodes sort by `order`, then date descending; posts without `order` sort newest first. Unassigned posts go under Engineering Notes. Dates render in UTC to avoid date-only values shifting a day across machines.

The selected feature is supplied by the homepage. The example pins the existing Proxmox post and its approved editorial headline. If that post is absent, it uses the first mapped post and that post's own title; customize selection or sort first if you want a "latest post" policy.

## Keep your existing article route

Use the following pattern inside the route you already have. `Content` means the renderer your existing route already obtains; this snippet does not require changing `getStaticPaths()`.

```astro
---
import PostLayout from '../../whenkat/layouts/PostLayout.astro';
// Keep your current code that loads post, renders Content, and resolves siblings.
---
<PostLayout
  title={post.data.title}
  date={post.data.pubDate}
  description={post.data.description}
>
  <Content />
</PostLayout>
```

`examples/blog-route.astro` includes a complete minimal Content Layer example using `getCollection()` and `render()`. Do not replace a working route merely to match that example.

Optional `previous` and `next` props take `PostSummary` objects. Pass the same neighbors your current series navigation uses. `series` supplies the navigation label. Keep navigation outside the article body to avoid duplication.

If your Markdown uses a frontmatter `layout:` directly instead of a collection route, keep an adapter that reads `Astro.props.frontmatter` and passes `title`, `date`, etc. into `PostLayout`; do not point those Markdown files directly at a layout expecting top-level props.

## Preserve comments and metadata

Pass your existing GitHub/Giscus component into the named slot:

```astro
<PostLayout title={post.data.title} date={post.data.pubDate}>
  <Content />
  <YourExistingComments slot="comments" />
</PostLayout>
```

Keep its repository, category, mapping, and discussion identifiers. If it maps by page title, preserve the existing document-title format in `SiteLayout.astro` before publishing; pathname-based mappings require unchanged paths. This kit does not recreate or move discussions.

`SiteLayout` derives canonical URLs from `Astro.site` and the current pathname, or accepts an explicit `canonical` prop. Set your existing `site` value to your production origin, as you already do. Pass your current social image URL as `socialImage`; relative public paths are resolved against that origin. For Astro image metadata, pass the existing image object's `.src` after applying your current per-post fallback policy.

The `head` slot allows your existing structured data, analytics, or extra tags. If you already have a full `BaseHead` component, either preserve it in `SiteLayout` and remove overlapping built-in tags or pass only its nonduplicating tags. Avoid duplicate titles, canonical tags, and descriptions. Keep RSS and sitemap generation in your current project; the RSS link here only points to that endpoint.

## CSS and fonts

Import `theme.css` once, through `SiteLayout`. This stylesheet owns the page theme. Remove the previous theme's global CSS import from pages adopting this layout, or migrate any needed content-specific styles into it. Loading both full themes can cause cascade conflicts.

The font pair is DM Sans and IBM Plex Mono, loaded from Google Fonts with fallbacks. If your CSP or preference requires local fonts, replace the top `@import` with local `@font-face` declarations. Font sizes, contrast, reduced-motion behavior, keyboard focus, skip link, article code blocks, mobile layout, and table overflow are included.

The default configuration assumes hosting at the domain root, matching whenkat.com. For a subpath deployment, update all configured public URLs and map article links using your current base-aware helper.

## Verify before merging

- Run your normal Astro build and check the homepage, About page, one long article, code blocks, and a series boundary at desktop and mobile widths.
- Confirm existing article URLs, canonical tags, RSS, sitemap, social metadata, comments, and any custom MDX components still work.
- Add a temporary post on the branch: verify it appears without editing homepage code, then remove it.
- Confirm draft/future-post filtering follows your existing policy.
- Check browser console/network for asset errors and confirm your deployment CSP allows your chosen font setup.

Build validation details are in `VALIDATION.md`. This kit has no dependency on the separately hosted design preview. All runtime images needed by this theme are included locally.

References: [Astro layouts](https://docs.astro.build/en/basics/layouts/), [Astro content collections](https://docs.astro.build/en/guides/content-collections/).
