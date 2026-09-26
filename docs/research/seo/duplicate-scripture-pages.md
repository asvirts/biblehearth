# How search engines treat large sets of near-duplicate Scripture pages

Research for [youversion/biblehearth#21](https://github.com/youversion/biblehearth/issues/21).
Gathered 2026-09-26. Google docs are quoted as they stood on that date, with each page's own
"last updated" stamp. Incumbent evidence comes from fetching the live pages that day with a
desktop-browser user agent. Anything marked **Inference** is my reading and not something a
source says.

## Answer

1. Google ranks pages one by one, but it also uses site-wide signals. It says so directly, and when it announced the 2022 system that now lives inside core ranking it put it plainly: sites with "relatively high amounts of unhelpful content" see *all* their content do worse. Only indexed pages count toward that judgement. So the real exposure is the ratio: roughly 90k indexable pages of licensed text (31k verse hubs plus about 60–73k locale reader pages) against a few hundred briefs. **Inference:** yes, weak sections can hold back the briefs.
2. Neither group is spam as written. Scaled content abuse and scraping are about intent to manipulate rankings, and the text is licensed. But Google's rater guidelines rate a page Lowest when "all or almost all" of its main content is copied with no added value, "even if the page assigns credit". Most locale reader pages fit that description, and so do verse hubs that have nothing original on them.
3. Crawl budget: Google's crawl-budget guide is written for sites of 1M+ pages, so Google's own capacity is not what limits a site of about 100k pages. Our upstream is. Googlebot ignores `Crawl-delay`. Sending 429 or 503 slows crawling for the whole host, briefs included. And `noindex` pages still get fetched. Google's own rule is that pages you don't want crawled belong in robots.txt, not behind `noindex`.
4. hreflang: a Spanish chapter can reasonably be marked as the alternate of the English chapter. Google can't judge equivalence across languages and takes your word for it. It is only a language-swap hint, though, and makes nothing more indexable. Two English translations can never be hreflang alternates of each other. Incumbents don't use hreflang across translations: bible.com uses it only for UI-language variants of *one* translation, and the other four sites use none.
5. The incumbents (Bible Gateway, Bible Hub, Bible Study Tools, Blue Letter Bible) index Scripture pages at huge scale with no `noindex`. They rely on 15–30 years of authority and pages packed with extra material. Bible.com is the one that cuts back. It canonicalizes every UI-language copy to one URL and blocks five whole locale prefixes in robots.txt. **Inference:** BibleHearth has no such authority to lean on.
6. A real gloss on a verse hub changes how the page is classified: it stops being "all or almost all copied". But a templated or thin gloss stamped onto 31k pages is exactly what scaled content abuse describes. **Inference:** apply the chapter-brief rule to verse hubs too, so a hub is indexable only when it carries real original writing. Take locale reader pages out of the index and the sitemaps, then out of the crawl.

---

## 1. Duplicated main content at scale: guidance and observed behaviour

### What BibleHearth has today (from the repo)

- **Verse hubs**, `src/pages/verse/[book]/[chapter]/[verse].astro`: self-canonical, no `noindex`, so all ~31k are
  indexable. Only the ~600 seeded from VOTD, topics and answers are in `sitemap-verses.xml`
  (`verseHubSeedPaths()` in `src/lib/seed.ts`). Main content is the verse in up to six
  licensed translations, plus links to related topics and answers where they exist.
- **Locale reader chapter and book pages**, `src/pages/bible/[version]/...`: self-canonical, indexable, and
  every chapter and book of each locale's default edition is listed in `sitemap-locale/[locale].xml`
  (`bibleSitemapPaths()` in `src/lib/sitemap.ts`). That comes to 58 locales × about 1,255 URLs.
- Reader **verse** pages, `bible/[version]/[book]/[chapter]/[verse].astro`, are already
  `noindex`.

### Google's spam policies (last updated 2026-08-28)

- **Scaled content abuse:** "many pages are generated for the primary purpose of manipulating search
  rankings and not helping users." The examples include "Scraping feeds, search results, or other
  content to generate many pages (including through automated transformations like synonymizing,
  translating, or other obfuscation techniques), where little value is provided to users" and
  "Stitching or combining content from different web pages without adding value."
- **Scraping:** "Republishing content from other sites without adding any original content or
  value, or even citing the original source", and "Reproducing content feeds from other sites
  without providing some type of unique benefit to the user."
- The March 2024 announcement says the policy applies "no matter whether content is produced
  through automation, human efforts, or some combination", and that it targets "large amounts of
  unoriginal content that provides little to no value to users, no matter how it's created."

**Inference:** both policies turn on *purpose* (manipulating rankings) and on *added value*.
Licensed, attributed Scripture served in a reader is not scraping in the policy's sense. But a
policy that doesn't apply is a lower bar than being ranked. The quality systems below judge value,
not licensing.

### Duplicate content is not a penalty in itself

Google's canonicalization doc (last updated 2026-08-20): "Some duplicate content on a site is normal
and it's not a violation of Google's spam policies." Google clusters pages whose "primary content
[is] very similar", picks one canonical, and crawls the duplicates "less frequently". Its ranking
guide describes a **deduplication** system that shows "only the most relevant results to avoid
unhelpful duplication", and an **original content** system that shows "original content
prominently in search results ... ahead of those who merely cite it."

**Inference:** for a verse or chapter query, Google picks from many sites carrying the same
translation text. A new domain carrying the same NIV or RVR1960 text as bible.com and Bible Gateway
is a candidate for being filtered out, not for being penalized.

### Site-wide effects

- **Google ranking systems guide** (last updated 2025-12-10): "Our ranking systems are designed to
  work on the page level ... Site-wide signals and classifiers are also used and contribute to our
  understanding of pages. Having some good site-wide signals does not mean that all content from a
  site will always rank highly, just as having some poor site-wide signals does not mean all the
  content from a site will rank poorly."
- The same page lists the **helpful content system** under "Retired systems": "In March 2024, it
  evolved and became part of our core ranking systems." The old `/search/help/helpful-content-faq`
  URL now redirects to this guide.
- **The August 2022 helpful content update post, still live on Google's blog.** This describes the
  site-wide classifier that was later folded into core ranking: "Any content — not just unhelpful
  content — on sites determined to have relatively high amounts of unhelpful content overall is
  less likely to perform well in Search ... removing unhelpful content could help the rankings of
  your other content." Also: "The signal is also weighted; sites with lots of unhelpful content may
  notice a stronger effect," and "some people-first content on sites classified as having
  unhelpful content could still rank well."
- **John Mueller, 2018 hangout** (via Search Engine Roundtable): "We only look at the index pages
  when it comes to understanding the quality of a website." He also argued for `rel=canonical`
  over `noindex` for *true duplicates*, because noindex drops the page's signals.
- **Mueller and Martin Splitt, 2026** (via Search Engine Journal, 2026-07-17): "If our systems are
  seriously worried about the quality of the website they will reduce the number of pages at the
  index." They tie widespread "crawled/discovered – currently not indexed" with no technical cause
  to overall site quality.
- **Self-assessment questions** in *Creating helpful content* (last updated 2025-12-10): "If the
  content draws on other sources, does it avoid simply copying or rewriting those sources, and
  instead provide substantial additional value and originality?" and "Are you producing lots of
  content on many different topics in hopes that some of it might perform well in search results?"

### Search Quality Rater Guidelines (edition of 2025-09-11)

Raters don't rank pages directly. The guidelines describe what Google's systems are tuned to reward.

- §4.6.6: "The Lowest rating applies if all or almost all of the MC on the page ... is copied,
  paraphrased, embedded, auto or AI generated, or reposted from other sources with little to no
  effort, little to no originality, and little to no added value for visitors to the website. Such
  pages should be rated Lowest, **even if the page assigns credit for the content to another source**."
- Same section: "there are many types of effort ... from directly creating the content on the page
  to **building custom page functionality**." And: "There is nothing wrong with embedding content,
  but the Lowest rating applies if there is no significant original content or added value on the
  page."
- §4.6.5 repeats the scaled content abuse definition and says to rate Lowest "when you strongly
  suspect scaled content abuse after looking at several pages on the website."

**Inference, applied to BibleHearth:**

- A locale reader chapter page is licensed text plus navigation. Its main content is "all or
  almost all" reproduced, and dozens of larger sites carry identical text. That is the Lowest/Low
  profile.
- A verse hub puts six translations side by side. The comparison layout is arguably "custom page
  functionality", which is better than a plain copy. But Bible Gateway, Bible Hub, Bible Study
  Tools and bible.com's `/bible/compare/` all offer the same thing with more content.
- The reader pages outnumber the briefs by more than 100 to 1. Only indexed pages feed the
  site-level judgement, and Google's 2022 description of that judgement is "relatively high
  amounts ... overall". **So the answer to "can weak sections drag down the original writing?" is:
  Google says it can, and BibleHearth's mix is the one that statement warns about.** Google gives no
  threshold, so the size of any effect is unknown.

## 2. Crawl budget on a site this size

From Google's *Crawl budget management for large sites* (last updated 2026-07-22):

- **Who it's for:** "Large sites (1 million+ unique pages)", "Medium or larger sites (10,000+ unique
  pages) with very rapidly changing content (daily)", and "Sites with a large portion of their total
  URLs classified by Search Console as Discovered - currently not indexed." BibleHearth qualifies
  only under the third, and only if that status shows up.
- **Demand depends on quality:** "For Googlebot, demand varies based on a site's size, update
  frequency, page quality, and relevance." On "Perceived inventory": "If many of these URLs are
  duplicates, or you don't want them crawled ... this wastes a lot of Google crawling time on your
  site. This is the factor that you can positively control the most." And on getting more budget:
  "for Google Search, this includes things like popularity, overall user value, content uniqueness,
  and serving capacity."
- **noindex versus robots.txt:** "Block crawling of URLs using robots.txt. Some pages might be
  important to users, but you don't necessarily want them to appear on Google surfaces ... Don't use
  noindex, as Google will still request, but then drop the page when it sees a noindex meta tag or
  header in the HTTP response, wasting crawling time."
- **No reshuffling:** "Google won't shift this newly available crawl budget to other pages unless
  Google is already hitting your site's crawl capacity limit."
- **Capacity limit:** 5xx and 429 responses push the limit down ("Google crawls less"). *Reduce the
  Google crawl rate* (last updated 2025-12-18) adds: "The reduced crawl rate affects the whole
  hostname of your site ... both the crawling of the URLs that return errors, as well as the URLs
  that return content."
- **robots.txt spec:** Google does not support `crawl-delay`. BibleHearth's `public/robots.txt`
  already says so in a comment.
- **Gary Illyes**, Search Off the Record, March 2024 (via SEJ): "If you want to increase how much we
  crawl, then you somehow have to convince search that your stuff is worth fetching", and
  "As soon as we get the signals back from search indexing that the quality of the content has
  increased across this many URLs, we would just start turning up demand."
- **noindex has to be seen:** from *Block indexing with noindex*: "If the page is blocked by a
  robots.txt file ... the crawler will never see the noindex rule, and the page can still appear in
  search results."

**Inference, applied to BibleHearth:**

- Google's side isn't the constraint. About 100k URLs is far below the scale Google worries about.
  The constraint is ours: each reader or hub crawl is a metered, rate-limited passage fetch.
- If we throttle Googlebot with 429 or 503 to protect the app key, Google slows the whole host,
  including new briefs.
- Listing ~73k reader URLs in sitemaps asks Google to fetch them. Low-value inventory also lowers
  demand, per the quality link above.
- The cheapest way to stop the spend is robots.txt. The order matters, though: `noindex` first, so
  the pages that are already indexed drop out, then `Disallow`. Otherwise the URLs can stay indexed
  with no content. This is the same trade-off CLAUDE.md already notes for markdown twins.
- Dropping URLs from a sitemap does not stop Google crawling them. It still crawls any URL it knows
  about or finds through links.

## 3. hreflang between Bible translations

From *Tell Google about localized versions of your page* (last updated 2026-09-21):

- Recommended for pages where "you keep the main content in a single language and translate only
  the template", for "small regional variations", and where "your site content is fully translated
  into multiple languages."
- "Localized versions of a page are only considered duplicates if the main content of the page
  remains untranslated."
- "Use hreflang to tell Google about the variations of your content, so that we can understand that
  these pages are localized variations of the same content."
- "Each language version must list itself as well as all other language versions ... If two pages
  don't both point to each other, the tags will be ignored."

From the canonicalization docs: "Different language versions of a single page are considered
duplicates only if the primary content is in the same language." And from *Specify a canonical*:
with hreflang, "specify a canonical page in the same language."

Spokesperson statements:

- **Mueller, January 2022 hangout** (via SER): "We basically use the hreflang to understand which of
  these URLs are equivalent from your point of view ... it's impossible for us to understand that
  this specific content is equivalent for another country or another language."
- **Mueller, johnmu.com, 2015:** "Make sure any rel=canonical you specify matches one of the URLs you
  use for the hreflang pairs", and "Don't use a rel=canonical across languages/countries."
- **Mueller, August 2020 hangout** (via Four Dots recap): different-language versions sometimes need
  no hreflang at all, "because people are automatically searching in your language."

**Inference:**

- **Spanish vs English chapter.** The Spanish chapter (RVR1960, Spanish UI) and the English chapter
  are different main content, so they are not duplicates. They are the same chapter in another
  language, which is the "fully translated" case. Google leaves the equivalence judgement to the
  publisher. So a hreflang cluster of the 58 locale-default editions of a chapter would be a
  legitimate claim. It would help Google send a Spanish searcher to the Spanish URL.
- **But hreflang is not an indexing signal.** It doesn't make a page more original or more likely
  to be indexed, and each cluster would be 58 bidirectional links per page across ~73k pages. If
  the reader pages leave the index (§1), hreflang on them becomes pointless.
- **Two English translations are never hreflang alternates.** hreflang describes language and
  region variants, and two `en` translations are neither. They are different texts in one
  language. Listing two URLs under the same code in one cluster has no meaning. They aren't
  canonical duplicates either, since the wording differs. Every incumbent below keeps each English
  translation self-canonical.

## 4. How incumbents handle it (fetched 2026-09-26)

| Site | Pages sampled | robots meta / X-Robots-Tag | Canonical | hreflang | html `lang` on non-English text |
|---|---|---|---|---|---|
| **bible.com** | `/bible/111/JHN.3.NIV`, `/bible/111/JHN.3.16.NIV`, `/bible/1/JHN.3.16.KJV`, `/es/bible/149/JHN.3.RVR1960`, `/bible/compare/JHN.3.16` | none | Self on the version's home-locale URL. UI-language copies canonicalize back: `/af/bible/111/JHN.3` → `/bible/111/JHN.3.NIV`; `/es/bible/111/JHN.3.16` → `/bible/111/JHN.3.16.NIV`; `/bible/149/JHN.3.RVR1960` → `/es/bible/149/JHN.3.RVR1960` | 82 links per page (incl. `en-GB`, `x-default`). All point to the **same version** under another UI locale, e.g. `hrefLang="es" → /es/bible/111/JHN.3`. Never to a different translation | `es` on `/es/` pages |
| **Bible Gateway** | `passage/?search=John 3&version=NIV`, `John 3:16` NIV, `NIV;ESV;KJV`, `Juan 3` RVR1960, `/verse/en/John 3:16`, `/verse/es/Juan 3:16` | none | Self on every page, including multi-version and single-verse queries | none | `en` even on RVR1960 |
| **Bible Hub** | `/john/3-16.htm`, `/john/3.htm`, `/niv/john/3.htm`, `/niv/john/3-16.htm`, `/commentaries/john/3-16.htm` | none | Self on parallel/hub pages. **No canonical at all** on per-version pages (`/niv/...`) | none. Spanish is a separate domain, `bibliaparalela.com` | no `lang` attribute |
| **Bible Study Tools** | `/john/3-16.html`, `/john/3.html`, `/esv/john/3-16.html`, `/kjv/john/3.html`, `/rvr/juan/3.html`, `/rvr/juan/3-16.html` | `max-image-preview:large` only | Self. The default version is consolidated: `/niv/john/3-16.html` **301s** to `/john/3-16.html`. Other versions are self-canonical | none | `en` on RVR pages |
| **Blue Letter Bible** | `/kjv/jhn/3/16/s_1000016`, `/kjv/jhn/3/1/`, `/niv/jhn/3/16/`, `/esv/jhn/3/1/s_1000001`, `/rvr60/jhn/3/1/` | none | Verse URLs canonicalize **to the chapter** of the same version (`/niv/jhn/3/16/` → `/niv/jhn/3/1/`). Each version's chapter is self-canonical | none | `en` on RVR60 |

robots.txt (fetched the same day):

- **bible.com:** `Disallow: /bible/*/*/notes`, `/search/users`, `/search/plans` (and locale-prefixed
  forms), plus **whole locale prefixes `/usi/`, `/aml/`, `/as/`, `/eo/`, `/uz/`**. (A browser user
  agent gets a JavaScript challenge page instead of the file. `curl`'s default agent gets the real
  file.)
- **Bible Gateway:** blocks `/user`, `/feedback` and a set of `/bible/<letter>*` legacy paths, with
  `Crawl-delay: 15`. Its sitemaps list **303,454 URLs**: 229,783 chapter passages across 231
  versions, and 73,439 `/verse/{en,es}/` hubs. No single-verse passage URLs are listed.
- **Bible Hub:** no robots.txt (404), so everything is crawlable.
- **Bible Study Tools:** `disallow: /search/` only.
- **Blue Letter Bible:** blocks `/reader/`, `/study/tsk/` (Treasury of Scripture Knowledge),
  `/commentaries/charles_spurgeon/`, `/commentaries/Chuck_Smith/` and assorted legacy paths.
  `Crawl-Delay: 1` for Bingbot. Sitemaps are per version (`SiteMap-BiblePassages-{niv,esv,rvr60,...}.xml`).

What the verse pages carry besides Scripture:

- **Bible Hub:** `/john/3-16.htm` runs about 5,500 words (parallel translations, cross references,
  Treasury of Scripture, commentary excerpts). `/nahum/2-5.htm` runs about 3,800.
- **Bible Study Tools:** verse pages have "Meaning and Commentary" (the Nahum 2:5 text reads as
  John Gill's public-domain exposition, though that's inference), cross references, sermons and
  articles.
- **Bible Gateway:** `/verse/en/` hubs run about 3,000–3,800 words of page text, much of it the
  version menu.

**Inference:**

- Three sites index everything and add bulk: Bible Gateway, Bible Hub and Bible Study Tools. None
  of them uses `noindex` on Scripture, and none uses hreflang.
- Two sites consolidate. Blue Letter Bible folds verses into chapters. Bible.com folds its 80-odd
  UI-language copies of each translation into one canonical per translation and blocks some thin
  locales outright.
- None of them is evidence that a new domain can index tens of thousands of licensed-text pages.
  They are the sites the deduplication system picks *from*.
- Bible.com is the closest analogue to BibleHearth: same API owner, localized UI over licensed
  translations. It is also the most conservative about which localized URLs it lets compete.

## 5. Does original commentary on a verse hub change the picture?

- The policies and rater guidelines all hinge on original content or added value. Scraping is
  "without adding any original content or value". The Lowest rating needs "all or almost all" of
  the main content copied, and "no significant original content or added value". The
  self-assessment asks for "substantial additional value and originality". A hub whose main content
  includes an original gloss is no longer "all or almost all copied".
- The same documents say scale is judged "no matter how it's created". Raters are told to judge
  scaled abuse "after looking at several pages on the website". The spam policy names "Using
  generative AI tools ... to generate many pages without adding value" and "Stitching or combining
  content ... without adding value."
- The original content system rewards pages that are the source ("ahead of those who merely cite
  it"). A gloss that restates Matthew Henry or Gill, which Bible Hub and Bible Study Tools already
  host, is not original in that sense.

**Inference:**

- A short gloss moves a hub from "copied" to "mixed". What decides the outcome is whether the gloss
  is genuinely specific to that verse, not how long it is.
- A formulaic sentence generated for all 31k hubs would probably make things worse. It would be
  the scaled pattern at scale, on a site whose indexed pages are counted in the site-level
  judgement.
- The repo already does this for chapters: no brief means `noindex`, no sitemap entry and no full
  text (`chapterBriefIndex()`). Applying the same rule to hubs means a hub is indexable only when
  it has an original gloss. That lines BibleHearth up with Google's page-level and site-level
  guidance.
- The 600 sitemap hubs that link to topics and answers are the natural first candidates.

---

## Sources

Google Search Central (primary):

- Spam policies for Google web search (updated 2026-08-28): https://developers.google.com/search/docs/essentials/spam-policies
- What web creators should know about our March 2024 core update and new spam policies: https://developers.google.com/search/blog/2024/03/core-update-spam-policies
- What creators should know about Google's August 2022 helpful content update: https://developers.google.com/search/blog/2022/08/helpful-content-update
- A guide to Google Search ranking systems (updated 2025-12-10; the target of the old helpful-content FAQ URL): https://developers.google.com/search/docs/appearance/ranking-systems-guide
- Creating helpful, reliable, people-first content (updated 2025-12-10): https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- What is canonicalization (updated 2026-08-20): https://developers.google.com/search/docs/crawling-indexing/canonicalization
- How to specify a canonical URL (updated 2026-07-10): https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Crawl budget management for large sites (updated 2026-07-22): https://developers.google.com/crawling/docs/crawl-budget
- Reduce the Google crawl rate (updated 2025-12-18): https://developers.google.com/crawling/docs/crawlers-fetchers/reduce-crawl-rate
- How Google interprets the robots.txt specification: https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- Block Search indexing with noindex: https://developers.google.com/search/docs/crawling-indexing/block-indexing
- Tell Google about localized versions of your page (updated 2026-09-21): https://developers.google.com/search/docs/specialty/international/localized-versions
- Managing multi-regional and multilingual sites (updated 2025-12-10): https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- Search Quality Rater Guidelines (2025-09-11 edition): https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf

Google spokespeople. Mostly secondary reports of hangouts and podcasts; the quotes are theirs:

- Mueller, "We only look at the index pages..." (2018-04-18): https://www.seroundtable.com/google-site-quality-indexed-pages-25593.html
- Mueller and Splitt on quality and non-indexed pages (2026-07-17): https://www.searchenginejournal.com/google-explains-seo-connection-of-site-quality-to-non-indexed-pages/582683/
- Illyes on crawl scheduling and quality (2024-04-02): https://www.searchenginejournal.com/googles-crawling-priorities-insights-from-analyst-gary-illyes/512876/
- Mueller, hreflang equivalence across languages (2022-01-20): https://www.seroundtable.com/google-understand-content-equivalent-language-hreflang-32782.html
- Mueller, hreflang and canonical (2015-11-07, his own site): https://johnmu.com/hreflang-canonical/
- Mueller, "you don't always need hreflang" (August 2020 hangout recap): https://fourdots.com/blog/google-webmaster-hangout-recap-august-4-7-2020-7614
- Secondary summary of the retired March 2024 helpful-content FAQ (the Wayback Machine was unreachable, so I couldn't read the original): https://www.pageonepower.com/linkarati/google-faq-page-helpful-conten

Incumbents (fetched 2026-09-26):

- https://www.bible.com/robots.txt · https://www.bible.com/bible/111/JHN.3.NIV · https://www.bible.com/bible/111/JHN.3.16.NIV · https://www.bible.com/es/bible/149/JHN.3.RVR1960 · https://www.bible.com/af/bible/111/JHN.3 · https://www.bible.com/bible/compare/JHN.3.16
- https://www.biblegateway.com/robots.txt · https://www.biblegateway.com/site-map/map-index.xml · https://www.biblegateway.com/passage/?search=John%203&version=NIV · https://www.biblegateway.com/verse/en/John%203%3A16 · https://www.biblegateway.com/passage/?search=Juan%203&version=RVR1960
- https://biblehub.com/robots.txt (404) · https://biblehub.com/john/3-16.htm · https://biblehub.com/john/3.htm · https://biblehub.com/niv/john/3.htm · https://bibliaparalela.com/john/3-16.htm
- https://www.biblestudytools.com/robots.txt · https://www.biblestudytools.com/john/3-16.html · https://www.biblestudytools.com/niv/john/3-16.html · https://www.biblestudytools.com/esv/john/3-16.html · https://www.biblestudytools.com/rvr/juan/3.html
- https://www.blueletterbible.org/robots.txt · https://www.blueletterbible.org/sitemapindex.xml · https://www.blueletterbible.org/kjv/jhn/3/16/s_1000016 · https://www.blueletterbible.org/niv/jhn/3/16/ · https://www.blueletterbible.org/rvr60/jhn/3/1/

BibleHearth code referenced: `src/pages/verse/[book]/[chapter]/[verse].astro`,
`src/pages/bible/[version]/[book]/[chapter]/index.astro`,
`src/pages/bible/[version]/[book]/[chapter]/[verse].astro`, `src/pages/sitemap-locale/[locale].xml.ts`,
`src/pages/sitemap-verses.xml.ts`, `src/lib/sitemap.ts`, `src/lib/seed.ts`, `public/robots.txt`.
