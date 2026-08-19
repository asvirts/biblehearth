## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Study pages

Every chapter of the Bible has a study page at `/{book}/{chapter}` — `/psalms/28`.
Its book page is `/{book}` and the hub is `/study`. Those routes live at the site
root, so `src/pages/[book]/[chapter].astro` is the greediest route in the app:
any new top-level page needs a static segment to beat it, and 66 book slugs
(`/john`, `/acts`, `/job`) are permanently spoken for. They moved out of
`/commentary/*` on 2026-08-18; the old paths 301 from `astro.config.mjs`.

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
`src/pages/llms.txt.ts` from the same `listChapterBriefs()` the sitemap uses. It
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
BaseLayout emits into every page. It is also what unlocks Crawl Control, which
is where Bingbot's pace belongs; `robots.txt` gives it a `Crawl-delay: 1` group
in the meantime, separate from the slower one the long tail gets.
