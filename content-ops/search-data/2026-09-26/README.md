# Search data pulled 2026-09-26

## `gsc-performance/`

Google Search Console → Performance → Search results for `biblehearth.online`, exported
2026-09-26. Web search, "Last 3 months", which here covers **2026-08-18 to 2026-09-24**,
because the property has no earlier data. The UI export stops at 1,000 rows, so
`Pages.csv` and `Queries.csv` are truncated. `Queries.csv` also leaves out
anonymized queries: its rows sum to 1,957 of 5,508 impressions.

Not in this export: the Page indexing report, Crawl stats, and anything from Bing
Webmaster Tools.

### What it says

**Totals.** 5 clicks, 5,508 impressions, average position around 65. Mobile had 289
impressions at an average position of 35; desktop had 5,214 at 66.

**Impressions collapsed at the start of September.** They ran 200–600 a day from
Aug 19 to Aug 30, then fell: 271 on Aug 31, 155 on Sep 1, 69 on Sep 2, 11 on Sep 3,
and 0–6 a day since. No deploy landed between Aug 22 and Sep 16 (`git log
origin/main`), so a code change is not the obvious cause. Production 503s were a
known problem in August (commits `6ffe685`, `da4c138`).

**Impressions by page group** (`Pages.csv`, top 1,000 pages):

| Group | Pages | Impressions | Share | Clicks |
| --- | --- | --- | --- | --- |
| Verse hubs `/verse/...` | 671 | 3,378 | 65% | 5 |
| English reader `/bible/...` | 288 | 1,219 | 24% | 0 |
| Chapter studies (briefed) | 14 | 295 | 6% | 0 |
| Topics | 8 | 147 | 3% | 0 |
| Answers | 3 | 70 | 1% | 0 |
| Locale reader, books, other | 16 | 50 | 1% | 0 |

Pages with original writing earned 10% of impressions, at positions 63–85 (page 7
and beyond). The top ones were `/psalms/27` (80), `/topics/peace` (55),
`/psalms/46` (52), `/isaiah/41` (43), and `/answers/what-does-the-bible-say-about-tattoos` (40).

**Queries are mostly navigational chapter and verse lookups**, such as "isaiah 41 10",
"john 15", "psalm 23 niv", "proverbs 14". Bible Gateway and bible.com serve those
queries. Study-intent queries ("… meaning", "… commentary") account for under 5% of
the impressions in `Queries.csv`.

**Countries.** The United States has 1,801 impressions and 3 clicks. The Philippines
is second with 467 impressions.
