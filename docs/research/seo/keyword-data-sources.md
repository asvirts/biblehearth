# Keyword data sources for ranking the question catalogue and chapter list

Ticket: youversion/biblehearth#22. Researched 2026-09-26. Every price below was
read from the vendor's own pricing or docs page on that date unless it is marked
**unverified**. Pricing changes often, so re-check before buying.

## Answer

1. **Primary: DataForSEO** (pay as you go, API only). `dataforseo_labs/google/keyword_overview` returns search volume, keyword difficulty and intent for up to 700 keywords per call. It costs $0.012 per call plus $0.00012 per keyword, so **7,000 keywords is about $1**. `keywords_data/google_ads/search_volume` fills in keywords that Labs doesn't have, at $0.06 per 1,000 keywords. The minimum top-up is $50, which pays for dozens of full passes.
2. **Fallback: Ahrefs Lite, $129 for one month.** Lite includes the API with 200,000 units a month. Volume plus KD costs about 21 units per keyword, so that is roughly 9,500 keywords. The other route is pasting into Keywords Explorer, up to 10,000 at a time. Ahrefs has the best-known KD, and its Parent Topic grouping helps find questions that one page should cover together. The site already loads Ahrefs Web Analytics, but that script doesn't come with Keywords Explorer.
3. **Rejected: Semrush** ($549/mo Advanced plan, plus API units at an unpublished price), **Keyword Planner** (no difficulty score, an Ads account needed, and API access needs a Basic-level developer token) and **Keywords Everywhere** ($80 minimum pack, no difficulty score). Each is too costly or missing a column we need.
4. **Look up search-shaped keywords, not the raw questions.** 2,155 of the 5,164 questions (42%) are longer than Keyword Planner's limit of 10 words or 80 characters. Most of the rest are too long-tail to have a measured volume. Expand each question into a form built from its own wording (shortened where too long), a phrase form and a verse form, with the verse form used only as a tiebreak (see "Expansion"). Expand each chapter into study-intent forms ("romans 8 meaning / explained / summary / commentary"). That makes about 22.5k keywords in total, which is still under $5 on DataForSEO.
5. **Search Console can re-rank pages after they publish, but it can't find demand.** It leaves out "anonymized" queries (fewer than a few dozen searchers over 2–3 months), which is exactly where this long tail sits. It also shows nothing for the 1,158 `noindex` chapters.

## What is being ranked

- `content-ops/questions/*.json`: 66 books, 5,164 questions, each with `q`, `slug`,
  `passage`, `kind` and `priority`. 4,763 distinct starting verses. `priority` is 1 for
  4,497 questions (87%), and `content-ops/questions/README.md` says outright that it
  "should not be used to rank work" until it has measured volume behind it.
- `scripts/questions-export.mjs` flattens the catalogue to CSV
  (`question,book,reference,passage,kind,priority,url`) sorted by that same
  priority, for pasting into a keyword tool by hand. The raw `question` column is
  the wrong input to paste on its own (see "Expansion").
- Chapters: 1,189 in total. 31 have an English brief in `src/content/chapters/`, which leaves
  1,158. Chapter names come from `bookNameForChapter()` in `src/lib/bible/usfm.ts`
  ("Psalm 23", not "Psalms 23").

Question length (words): 3–10 words: 3,010. 11–16+ words: 2,154. Keyword Planner
and every tool built on it rejects keywords over 10 words or 80 characters
([Google Ads help][gkp-use]; [DataForSEO search_volume docs][d4-sv]).

## Sources compared

### Ahrefs

Plans (from [ahrefs.com/pricing][ahrefs-pricing], monthly billing, up to 17% off annually):

| Plan | $/mo | API | API units/mo | Max rows per API request | Keywords Explorer rows per report |
|---|---|---|---|---|---|
| Starter | 29 | no | 0 | — | — |
| Lite | 129 | yes | 200,000 | 100 | 2,500 |
| Standard | 249 | yes | 800,000 | 250 | 30,000 |
| Advanced | 449 | yes | 2,000,000 | 500 | 75,000 |
| Enterprise | 1,499 (annual only) | "Uncapped API access" | 4,000,000 / custom | unlimited | 150,000 |

- The unit allowances appear on the pricing page as "API integration units /mo".
  The page's embedded plan data labels them `apiV3Units`, which confirms they are
  the API v3 allowance. Starter has `apiAccess: false`.
- Extra units: the same embedded data prices an add-on at **$50 per 1,000,000
  units**. That price is not in the page's visible text, so **confirm it in Account settings
  before relying on it**. Pay-as-you-go API units last three billing months (pricing FAQ).
- Lite also shows "1,000 credits per user /mo" and Standard and up show
  "unlimited". What a Keywords Explorer bulk lookup costs in credits is
  **unverified**.
- "Batch Analysis" (Standard and up) is for URLs ("Target URLs per report"), not keywords.
- How units are charged ([limits consumption][ahrefs-units]):
  `max(50, per_row_cost × rows)`. Most fields cost 1 unit, some cost 5 or 10, and requests
  served from cache are free. On `GET /v3/keywords-explorer/overview`
  ([docs][ahrefs-overview]), which accepts a comma-separated `keywords` list or a
  `keyword_list_id`, **`volume` and `difficulty` cost 10 units each**, as do
  `traffic_potential`, `global_volume`, `intents` and `parent_volume`.
  `keyword` + `volume` + `difficulty` comes to about 21 units per row.
  - 7,000 keywords × 21 = 147,000 units. That fits Lite (200k) in 70 requests of 100.
  - About 22,500 keywords (full expansion) × 21 ≈ 470,000 units. That needs Standard, or
    Lite plus a 1M add-on (Lite $129 + $50, if the add-on price holds).
- UI route: paste up to 10,000 keywords into Keywords Explorer
  ([Ahrefs blog][ahrefs-10k]). On Lite, the 2,500-row report cap means pasting in
  chunks of 2,500 or fewer (inference from the plan table). Export rows (500k/mo on Lite) are not a constraint.
- Free test queries only work against fixed demo targets, so they are no use for real lookups
  ([introduction][ahrefs-intro]).
- Ahrefs Web Analytics (the script in `BaseLayout.astro`) does not unlock
  Keywords Explorer.

### Semrush

- API access needs the **Advanced** plan: $549/mo, or $455.67/mo billed annually
  ([pricing][semrush-pricing], "API data integration"). The KB still calls this the
  "Business tier". Upgrading gives **zero units**. Units come in packages of 2M,
  5M, 10M or 20M, renew monthly, and expire unused ([KB][semrush-kb]).
- Package prices are **not published**. Third-party write-ups estimate about $50 per 1M
  units (**unverified**).
- `phrase_these` (Batch Keyword Overview) takes up to 100 keywords per request at
  **10 units per line**, and can return a `Kd` column. `phrase_kdi` (Keyword
  Difficulty) costs **50 units per line** ([keyword reports][semrush-kw]).
  7,000 keywords is about 70k units for volume, plus about 350k for KD via `phrase_kdi`. That is well inside
  the smallest 2M package, but it adds a $549/mo subscription. Poor value at this scale.

### Google Keyword Planner and the Google Ads API

- Free in the Ads UI, but it needs a Google Ads account with billing set up ([Use
  Keyword Planner][gkp-use]). Keywords are capped at 80 characters and 10 words.
- Volume is "the average number of times people have searched for a keyword **and its
  close variants**", and historical stats are exact-match only
  ([forecasts help][gkp-forecast]). "psalm 23 meaning" and "psalms 23 meaning" come back as one
  number, so never add close variants together.
- **No ranking-difficulty score**. "Competition" is advertiser competition.
- Accounts without active spend seeing bucketed ranges (for example 1K–10K) instead of averages
  is widely reported in Google's own community threads but not documented in the
  help pages checked (**unverified**). Ranges would make the numbers unusable for ranking.
- API route: `KeywordPlanIdeaService.GenerateKeywordHistoricalMetrics`
  ([docs][gads-hist]). Keyword planning is **excluded from Explorer access**. It
  needs a developer token with Basic (15,000 ops/day) or Standard access
  ([access levels][gads-access]), which means an application and review. That is too much overhead for a
  one-off ranking when DataForSEO resells the same data per task.

### DataForSEO

Pay as you go. **The minimum payment is $50** ([pricing][d4-pricing]).

| Endpoint | What it returns | Per call | Price |
|---|---|---|---|
| Labs `keyword_overview/live` ([docs][d4-ov]) | volume, monthly history, **keyword_difficulty**, intent, CPC, SERP info | ≤700 keywords | $0.012/task + $0.00012/item ([pricing][d4-labs]). Doubled with `include_clickstream_data` |
| Labs `bulk_keyword_difficulty/live` ([docs][d4-kd]) | KD 0–100 | ≤1,000 | same as above |
| Google Ads `search_volume` ([docs][d4-sv]) | Keyword Planner volume, competition, CPC, 12-month history | ≤1,000 (≤80 chars, ≤10 words) | **$0.06/task** standard queue (1–3 h) or $0.09 live, whatever the keyword count ([pricing][d4-ads]) |
| SERP Google Autocomplete | suggestions for a seed | 1 seed | $0.0006 standard, $0.002 live ([pricing][d4-ac]) |
| SERP Google Organic | top 10 plus People Also Ask | 1 query | $0.0006 standard. PAA expansion adds $0.00015 per click ([pricing][d4-serp]) |
| Google Trends | relative interest | ≤5 keywords | $0.0027/task standard ([pricing][d4-trends]) |

Cost for this backlog:
- 7,000 keywords through `keyword_overview`: 10 × $0.012 + 7,000 × $0.00012 ≈ **$0.96**
  (about $1.92 with clickstream).
- Filling in the same 7,000 from Google Ads: 7 tasks × $0.06 = **$0.42**.
- Full expansion of about 22,500 keywords: 33 × $0.012 + 22,500 × $0.00012 ≈ $3.10 for Labs, plus up to 23 × $0.06 ≈ $1.38 for Ads, so **under $5**.
- PAA for all 1,189 chapters ("romans 8 meaning" SERPs): about $0.71 plus click depth.

Caveat: the Labs database only has keywords it has already seen. Long-tail
question forms will often come back empty. That is why the Google Ads endpoint is in
the plan as a second pass, and why the expansion below matters more than the vendor.

### Keywords Everywhere

- 1 credit = 1 keyword. Packs are **$80 for 200k credits** (40¢ per 1k), down to 16¢ per 1k at
  50M, and credits expire after a year ([credits][ke-credits]). The API uses the same credits and has
  had no separate fee since June 2025. `get_keyword_data` takes 100 keywords per call
  ([API page][ke-api]).
- Volume is from Keyword Planner, optionally blended with clickstream. "Competition" is
  explicitly "not a ranking-difficulty score" ([API page][ke-api]). 7,000 keywords uses
  $2.80 of an $80 pack. Cheap, but it has no difficulty score and no advantage over DataForSEO's Ads endpoint.

### Free proxies

- **Google Trends API**: official, but still an application-gated **alpha**. Values are
  "consistently scaled" across requests, but they "don't reflect absolute numbers"
  ([announcement][trends-blog]; [docs][trends-docs]). Good for comparing seasonality
  or relative interest between chapters. It can't give volume.
- **Autocomplete**: Google has no official API. `suggestqueries.google.com` is
  undocumented and scraping it is at Google's discretion. Use DataForSEO's
  autocomplete endpoint for a supported route. Useful as a yes/no check that
  demand exists ("psalm 28 m…" completing to "meaning") and for finding phrasings.
- **People Also Ask**: SERP scraping only. The best source of real question wording,
  so use it to *rewrite* `q` values, not to rank them.
- **Bing Webmaster Tools keyword research API** (`GetKeyword`, `GetKeywordStats`):
  free weekly Bing impressions per keyword ([Microsoft Learn][bing-kw]). It needs the site
  verified in Bing, and `BING_SITE_VERIFICATION` is not set yet (per CLAUDE.md). Quotas are
  **unverified**. Bing-only, so treat it as a sanity check.

### Google Search Console as a stand-in

- **Anonymized queries are left out**: those "that aren't issued by more than a few dozen
  users over a two-to-three month period" ([Search Central blog][gsc-anon]). Most
  catalogue questions are below that line, so GSC will never list them however
  much data accumulates.
- The API returns at most **50K rows per day per search type**, 25,000 per request
  ([all your data][gsc-rows]). Data retention of 16 months is from memory and **was not re-checked**.
- Pages marked `noindex` aren't in the index, so they collect no impressions. **The 1,158 unbriefed
  chapters get no signal at all.** GSC can only rank chapters indirectly:
  - the 31 briefed chapters show which query templates ("… meaning" vs "… summary")
    actually bring impressions, which tells us which expansion forms to weight;
  - the verse hubs are in `sitemap-verses.xml` (seeded by `verseHubSeedPaths()`) and
    can collect verse-level queries ("psalm 23:4 meaning") that match question
    `passage`s;
  - the 5 published answers show impressions for their own queries.
- Use: once pages publish, **re-rank with GSC impressions** (demand we already
  capture) and keep keyword-tool volume for anything not yet written. It
  can't choose what to write first.

## Recommendation

**Primary: DataForSEO.** A small script, for example `scripts/keywords-lookup.mjs`, would read the same
catalogue and chapter list as `questions-export.mjs`, build the expansion below,
call `keyword_overview`, and send anything that comes back empty to Google Ads
`search_volume`. It would cache results as JSON under `content-ops/` so nothing is paid for twice. Credentials would go
in `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` (Basic auth). Cost: the $50 minimum
top-up, of which one full pass uses under $5. Effort: about a day, including rewriting
`priority` from the data.

**Fallback: Ahrefs Lite for one month ($129).** Use it if DataForSEO's Labs coverage turns out too
thin, or as a check on its KD. Same expansion, through
`/v3/keywords-explorer/overview` (`select=keyword,volume,difficulty,parent_topic`, 100
keywords per request), or pasted into Keywords Explorer in batches of 2,500.
Parent Topic is the extra value: questions sharing a parent topic are
candidates to merge into one answer page. Cancel after the pass.

## Expansion

Look up forms people type, then roll each item up by taking the **max** across its
forms. Don't sum them: every tool folds close variants together.

**Chapters** (1,189; `C` = `bookNameForChapter()` + number, lower-cased):

| Form | Example | Role |
|---|---|---|
| `C meaning` | psalm 23 meaning | score |
| `C explained` | romans 8 explained | score |
| `C summary` | romans 8 summary | score |
| `C commentary` | john 3 commentary | score |
| `what is C about` | what is hebrews 11 about | score |
| `C` (bare) | romans 8 | context column only. Mostly reading intent, served by the reader, not the brief |

Add spelling variants people actually use, as extra rows folded into the same
chapter: `psalms 23 …` for Psalms (150 chapters), `first/second/third …` for the
numbered books (about 229 chapters), `song of solomon …` for Song of Songs (8), and
`revelations …` for Revelation (22). About 1,189 × 5 score forms + 1,189 bare + about
400 variants ≈ **7,500 keywords**. Score = max of the five study forms. KD comes
from `C meaning`, which is the query the brief competes for.

**Questions** (5,164):

| Form | Built from | Example | Count |
|---|---|---|---|
| raw `q` (only if ≤10 words and ≤80 chars) | `q` | what is the seat of scoffers in psalm 1:1 | ≈3,010 |
| shortened `q` (only where raw `q` is over the limit) | `q` cut to ≤10 words: lower-cased, punctuation and leading auxiliaries ("does", "is", "why did") dropped, verse reference and key nouns kept | does psalm 1:3 promise believers prosper | ≈2,155 |
| phrase + `meaning` | `slug` with hyphens replaced by spaces | kiss the son meaning; like a tree planted by streams of water meaning | 5,164 |
| verse + `meaning` | first verse of `passage` | psalm 2:12 meaning | 4,763 distinct |

That is about **15,000 keywords**. Every question gets one form built from its own
wording: the raw `q` where it fits, the shortened `q` where it doesn't. The slug
phrase is a proxy that can drift from the question (the slug for the Psalm 1:3
question gives "whatever he does prospers meaning"), so it sits alongside that form
and never replaces it.

**Primary score** = max over the question's own forms: raw or shortened `q`, plus the
slug phrase. The verse form is left out of the primary score. It's shared by every
question on the same verse, so taking a max over it would give one popular verse's
volume to all of them. Use it only to break ties between questions with equal
primary scores. Where the primary forms all come back empty, use an autocomplete hit
on the shortened `q` or the phrase as a binary "demand exists" flag before dropping
the question to priority 3. Spot-check about 50 shortened forms by hand before the
full run. The shortening is mechanical and can drop the word that carries the intent.

Together that is about 22.5k keywords: ≈$4 on DataForSEO, or about 470k Ahrefs units.

## Sources

All checked 2026-09-26.

- [ahrefs-pricing](https://ahrefs.com/pricing)
- [ahrefs-intro](https://docs.ahrefs.com/en/api/docs/introduction)
- [ahrefs-units](https://docs.ahrefs.com/en/api/docs/limits-consumption)
- [ahrefs-overview](https://docs.ahrefs.com/en/api/reference/keywords-explorer/get-overview)
- [ahrefs-10k](https://ahrefs.com/blog/keyword-clustering-tools/)
- [semrush-pricing](https://www.semrush.com/prices/)
- [semrush-kb](https://www.semrush.com/kb/5-api)
- [semrush-kw](https://developer.semrush.com/api/v3/analytics/keyword-reports/)
- [semrush-units](https://developer.semrush.com/api/basics/api-units-balance/)
- [gkp-use](https://support.google.com/google-ads/answer/7337243)
- [gkp-forecast](https://support.google.com/google-ads/answer/3022575)
- [gads-hist](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics)
- [gads-access](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)
- [d4-pricing](https://dataforseo.com/pricing)
- [d4-labs](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api)
- [d4-ads](https://dataforseo.com/pricing/keywords-data/google-ads)
- [d4-serp](https://dataforseo.com/pricing/serp/google-organic-serp-api)
- [d4-ac](https://dataforseo.com/pricing/serp/google-autocomplete-serp-api)
- [d4-trends](https://dataforseo.com/pricing/keywords-data/google-trends)
- [d4-ov](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/)
- [d4-kd](https://docs.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live/)
- [d4-sv](https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/task_post/)
- [ke-credits](https://keywordseverywhere.com/credits.html)
- [ke-api](https://keywordseverywhere.com/api-documentation.html)
- [trends-blog](https://developers.google.com/search/blog/2025/07/trends-api)
- [trends-docs](https://developers.google.com/search/apis/trends)
- [bing-kw](https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi.getkeyword?view=bing-webmaster-dotnet)
- [gsc-anon](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)
- [gsc-rows](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)

[ahrefs-pricing]: https://ahrefs.com/pricing
[ahrefs-intro]: https://docs.ahrefs.com/en/api/docs/introduction
[ahrefs-units]: https://docs.ahrefs.com/en/api/docs/limits-consumption
[ahrefs-overview]: https://docs.ahrefs.com/en/api/reference/keywords-explorer/get-overview
[ahrefs-10k]: https://ahrefs.com/blog/keyword-clustering-tools/
[semrush-pricing]: https://www.semrush.com/prices/
[semrush-kb]: https://www.semrush.com/kb/5-api
[semrush-kw]: https://developer.semrush.com/api/v3/analytics/keyword-reports/
[semrush-units]: https://developer.semrush.com/api/basics/api-units-balance/
[gkp-use]: https://support.google.com/google-ads/answer/7337243
[gkp-forecast]: https://support.google.com/google-ads/answer/3022575
[gads-hist]: https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics
[gads-access]: https://developers.google.com/google-ads/api/docs/api-policy/access-levels
[d4-pricing]: https://dataforseo.com/pricing
[d4-labs]: https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api
[d4-ads]: https://dataforseo.com/pricing/keywords-data/google-ads
[d4-serp]: https://dataforseo.com/pricing/serp/google-organic-serp-api
[d4-ac]: https://dataforseo.com/pricing/serp/google-autocomplete-serp-api
[d4-trends]: https://dataforseo.com/pricing/keywords-data/google-trends
[d4-ov]: https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/
[d4-kd]: https://docs.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live/
[d4-sv]: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/task_post/
[ke-credits]: https://keywordseverywhere.com/credits.html
[ke-api]: https://keywordseverywhere.com/api-documentation.html
[trends-blog]: https://developers.google.com/search/blog/2025/07/trends-api
[trends-docs]: https://developers.google.com/search/apis/trends
[bing-kw]: https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi.getkeyword?view=bing-webmaster-dotnet
[gsc-anon]: https://developers.google.com/search/blog/2022/10/performance-data-deep-dive
[gsc-rows]: https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
