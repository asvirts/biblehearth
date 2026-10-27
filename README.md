# BibleHearth

A Next.js website for reading licensed Bible translations and exploring original
chapter studies, topics, and answers. The React views preserve the existing
BibleHearth design and public URLs.

## Local development

Use Node.js 22.12 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set `YVP_APP_KEY` locally to use the existing YouVersion Platform integration.
Keep it server-side and out of source control. The site still renders original
articles when Scripture is unavailable; reader-only pages return a retryable
response. Run the server in a background terminal session and open
[localhost:3000](http://localhost:3000) in the Codex in-app browser.

```sh
npm test
npm run typecheck
npm run build
npm run start
```

The build first validates the 63 authored Markdown entries, their schema and
related references. It also copies any credited editorial image assets into
`public/editorial/`. No Scripture is fetched during the build.

## Architecture

The site uses the Next.js Pages Router with `getServerSideProps`. Each request
loads its data once, allowing real 404/503 responses and the existing cache and
retry headers to be sent with the rendered page.

| Location | Responsibility |
| --- | --- |
| `src/pages/[[...path]].tsx` | Public HTML entry and React hydration |
| `src/lib/page/routes.ts` | URL matching and legacy redirects |
| `src/lib/page/server.ts` | Server data loading, status, headers, and footer data |
| `src/loaders/` | Server-only page data and upstream reads |
| `src/views/` | Synchronous React page views |
| `src/components/` | Shared UI, metadata, and delegated analytics |
| `src/lib/content/` | Validated Markdown content loading |
| `src/resources/` | XML sitemaps, Markdown twins, `llms.txt`, reader redirects, API handlers |
| `src/lib/i18n/` | The existing locale and direction registry |
| `src/lib/cache/` | Bounded cache, stale fallback, limiter, and circuit breaker |
| `site.config.mjs` | Canonical site origin |

Data models contain no executable functions. SuperJSON preserves dates and maps
between server rendering and browser hydration. Browser views import pure URL
and display helpers; credentials and upstream clients stay in the server graph.
Listing and toolbar models include only the fields their UI uses.

## Content and publishing

- Studies live at `/{book}/{chapter}`; book hubs at `/{book}`; the hub at `/study`.
- Topics and answers retain `/topics/{slug}` and `/answers/{slug}`.
- Bible readers retain `/bible/{version}/{book}/{chapter}` and verse URLs.
- Localized book names, locale prefixes, Psalm numbering, and RTL direction
  remain driven by the existing generated registry.
- A study without an original brief remains `noindex` and is omitted from the
  sitemap. Its Markdown twin returns 404.
- Markdown twins contain original writing and citation links, never licensed
  Scripture. They return `X-Robots-Tag: noindex`.
- Scripture rendering includes publisher metadata from the detailed version
  record, because catalog summaries can omit the required notice.

`npm run chapter:research -- "psalm 28"` prepares research for an authored study.
The existing writing skill lives in `.claude/skills/chapter-brief/`.

Vercel uses the Next.js framework declared in `vercel.json`. The existing
`/api/warm` cron keeps the shared cache warm and requires `CRON_SECRET`.
`postbuild` retains the production-only, changed-content IndexNow submission;
preview and local builds submit nothing.

```sh
npm run sitemap:audit -- http://localhost:3000
npm run indexnow -- --changed --dry-run
```

See [AGENTS.md](AGENTS.md) for the development and publishing invariants.
