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

## IndexNow

Bing, Yandex, Seznam and Naver share one submission endpoint. The key file that
proves we own the domain is `public/<key>.txt` — deliberately public, so it
lives in the repo rather than in an env var, and `robots.txt` carves out an
`Allow` for it under the blanket `AhrefsBot` block because Ahrefs verifies the
key with that agent.

Submit URLs that have **changed**:

```
npm run indexnow -- /topics/anxiety /answers/what-is-grace
npm run indexnow -- --sitemap --dry-run
```

`--sitemap` submits everything the sitemaps currently list. It is for seeding a
site that has never been submitted, not for a schedule: every reader page a
crawler fetches is a licensed passage fetch against a rate-limited app key, so
resubmitting unchanged pages buys a mass crawl for nothing — and a 429 from
IndexNow on top of it. `--dry-run` prints the payload and sends nothing.

Confirm receipt in [Bing Webmaster Tools](https://www.bing.com/webmasters) under
Indexing → IndexNow.
