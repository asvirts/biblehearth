## Development

This is a Next.js Pages Router site. Preserve the current design in
`src/styles/global.css` and `src/styles/scripture.css` unless a task requests a
redesign. Run `npm run dev` in a persistent background terminal session and
retain its handle for logs and shutdown. The default port is 3000.

Run `npm test`, `npm run typecheck`, and `npm run build` for framework or routing
changes. `prebuild` validates authored content and references, then copies
credited editorial assets to `public/editorial/`.

## Request and rendering boundaries

- `src/pages/[[...path]].tsx` is the public HTML entry. Its
  `getServerSideProps` calls `src/lib/page/server.ts` once per request.
- `src/lib/page/routes.ts` matches static hubs before books and chapters and
  preserves the old `/commentary` redirects. Resolve locale prefixes from the
  public URL with `splitLocalePath()`, never from a client-supplied header.
- `src/loaders/` owns I/O, credentials, existence checks, HTTP status, and cache
  headers. `src/views/` owns synchronous React rendering. Models are data only;
  SuperJSON preserves Dates and Maps across hydration. All page props are public.
- Browser views import pure helpers from `src/lib/paths.ts`,
  `src/lib/commentary/paths.ts`, and `src/lib/youversion/display.ts`. Do not pull
  content I/O, cache adapters, or Platform credentials into the browser graph.
- `src/resources/dispatch.ts` owns XML, Markdown, `llms.txt`, reading redirects,
  and the authenticated warmer. Resources use the same locale resolution.
- Temporary failures are not absence: return retryable 503 and `Retry-After`
  when no Scripture can load; preserve 200 for an original article whose writing
  rendered. Never turn a failed fetch into a cached 404.
- Hydrate selected Bible versions from detail records before displaying text:
  catalog summaries can omit copyright and publisher metadata.
- Keep ordinary anchors for licensed reader links; speculative prefetching spends
  passage quota before the reader chooses a page.
- `site.config.mjs` supplies the canonical origin for rendering and publishing.
- `CLAUDE.md` is a symlink to this file; edit the shared instructions here.

## Documentation

Consult the current [Next.js Pages Router docs](https://nextjs.org/docs/pages)
when changing routing, rendering, or metadata. `getServerSideProps` is deliberate:
real status codes and cache headers come from one load, without fetching licensed
text in a separate request preflight.

## Study pages

Every chapter of the Bible has a study page at `/{book}/{chapter}` — `/psalms/28`.
Its book page is `/{book}` and the hub is `/study`. These routes live at the
site root; 66 book slugs (`/john`, `/acts`, `/job`) are permanently spoken for.
Register a new hub before the generic book matcher in `src/lib/page/routes.ts`.
That matcher also permanently redirects the old `/commentary/*` paths.

A study page carries the chapter itself, then original writing, then three
republished commentaries. **The original writing is what makes it indexable.**
Without a brief in `src/content/chapters/` the page renders `noindex, follow`,
stays out of the sitemap, and does not spend a passage fetch on the full text —
because its substance would be public-domain commentary that four larger sites
already mirror. Writing a brief earns the chapter its text and its indexation
together. `chapterBriefIndex()` is the one lookup all of that hangs off.

To write one, use the `chapter-brief` skill. It starts here:

```
npm run chapter:research -- "psalm 28"
```

`Psalms` is the book, `Psalm 28` is the chapter. `bookNameForChapter()` in
`src/lib/bible/usfm.ts` is the only place that distinction lives; use it rather
than interpolating a book name in front of a number.

## llms.txt and markdown twins

`/llms.txt` follows the [llmstxt.org](https://llmstxt.org) convention: a curated
index of the pages whose substance is ours, generated in
`src/resources/llms.txt.ts` from the same `listChapterBriefs()` the sitemap uses. It
is not a sitemap — the ~1,180 chapter URLs and ~31,000 verse hubs stay out, and
reach agents through the hubs listed under `## Optional`.

Chapter studies, topics and answers each serve a **markdown twin** at
`<url>.md`, linked from the page by `rel="alternate" type="text/markdown"`. One
rule governs them, in `src/lib/markdown.ts`:

**A twin carries the original writing and never the Scripture.** Reproducing
licensed passages as plain text would strip the publisher's required copyright
notice, turn a static file into a bulk-text endpoint for a translation we may
only display, and spend a metered fetch per crawl. Citations become links to the
verse hub instead — so a twin costs nothing upstream and is cheaper to serve
than the page it mirrors.

Twins are `noindex` (`X-Robots-Tag`, not robots.txt — a blocked URL is one whose
`noindex` is never read) so they never compete with their own canonical page. A
chapter with no brief 404s its twin, on the same terms that make its page
`noindex`.

## IndexNow

Bing, Yandex, Seznam and Naver share one submission endpoint. The key file that
proves we own the domain is `public/<key>.txt` — deliberately public, so it
lives in the repo rather than in an env var, and `robots.txt` carves out an
`Allow` for it under the blanket `AhrefsBot` block because Ahrefs verifies the
key with that agent.

**Production deploys submit themselves.** `postbuild` runs
`indexnow --changed --if-production`, which fingerprints everything under
`src/content/` and compares it with the manifest the previous build left in
`node_modules/.cache` — the one directory Vercel restores between builds. Only
what actually changed is sent, plus the book page of any changed chapter brief.
Nothing to do after shipping a brief.

Two things it will not do: submit anything from a preview deploy, and submit
anything when the manifest is missing. A cleared build cache re-records the
baseline and sends nothing, because reading an empty baseline as "every page is
new" is the mass submission this is all built to avoid. It also never fails a
deploy — a failed submission just leaves the manifest unwritten, so the next
build retries.

Submit by hand when the change is not a content file:

```
npm run indexnow -- /topics/anxiety /answers/what-is-grace
npm run indexnow -- --changed --dry-run
```

`--sitemap` submits everything the sitemaps currently list. It is for seeding a
site that has never been submitted, not for a schedule: every reader page a
crawler fetches is a licensed passage fetch against a rate-limited app key, so
resubmitting unchanged pages buys a mass crawl for nothing — and a 429 from
IndexNow on top of it. `--dry-run` prints the payload and sends nothing.

Confirm receipt in [Bing Webmaster Tools](https://www.bing.com/webmasters) under
Indexing → IndexNow. Verifying the site there needs `BING_SITE_VERIFICATION`
set in Vercel — the `content` value of the `msvalidate.01` tag it offers — which
PageLayout emits into every page. It is also what unlocks Crawl Control, which
is where Bingbot's pace belongs; `robots.txt` gives it a `Crawl-delay: 1` group
in the meantime, separate from the slower one the long tail gets.

## Custom events

Vercel Web Analytics is initialized in `src/pages/_app.tsx`. Custom events
remain declared in markup: `data-va` names a click event, `data-va-view` names
an event when the element first reaches the viewport, and accompanying
`data-va-*` values become properties. `src/components/Analytics.tsx` is the
single delegated listener; it reattaches observers when the route changes.

Two rules decide whether an event is worth adding. **Never record what the URL
already says**: the page view carries the path, so an event earns its keep only
by carrying the dimension the path is missing. And **two properties, no more** —
the Pro plan's ceiling, where a third is dropped rather than reported. Events
are billed like page views, so nothing fires on a timer or on scroll, and a view
event fires once per page load.

Client-side is deliberate too. Most of what requests this site is a crawler, and
the beacon only runs where there is a JavaScript engine, so these counts are
people in a way nothing measured on the server can be.

Three are wired. `chapter-tile` carries `briefed`, and is the only demand signal
a chapter with no brief has — those pages are `noindex`, so nobody reaches them
from search and their traffic says nothing. `brief-end` fires when the FAQ
section comes into view, which is a reader who stayed to the end of our own
writing; its `text` property is there to answer whether spending a passage fetch
on the full chapter changes that. `translation-switch` measures what
`DEFAULT_VERSION_ID` and `HUB_TRANSLATION_SLUGS` currently guess at.

## Agent skills

### Issue tracker

GitHub Issues in youversion/biblehearth via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CLAUDE.md` + `README.md` until `CONTEXT.md` / `docs/adr/` exist. See `docs/agents/domain.md`.
