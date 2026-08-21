---
name: chapter-brief
description: Write or revise a BibleHearth chapter study page — the original article that publishes at /{book}/{chapter} and is what makes that chapter indexable. Use when asked to write up, explain, summarise or "rank for" a Bible chapter (e.g. "write an article for Psalm 28", "we need Romans 8", "add a brief for Genesis 1"), or when revising an existing file in src/content/chapters/.
---

# Writing a chapter brief

A brief is one markdown file in `src/content/chapters/`. It publishes at
`/{book}/{chapter}` — `/psalms/28` — and it is the only original writing on that
page. Everything else there belongs to somebody else: the licensed scripture,
three republished commentaries, two outbound links.

Matthew Henry is already available on several larger Bible sites. Republishing
the same commentary is useful to a reader, but it does not give a search engine
a reason to index another copy. A chapter without a brief therefore renders
`noindex` and stays out of the sitemap. **The brief is what earns the chapter its
place in the index**, and `src/pages/[book]/[chapter].astro` enforces that rule.

## Step 1 — Gather

```
npm run chapter:research -- "psalm 28"
```

Accepts `PSA.28`, `psalms/28` or `"psalm 28"`. Prints one dossier: the chapter in
full, all three commentaries in full, the questions already catalogued for that
chapter in `content-ops/questions/`, the valid `relatedTopics` slugs, and the
exact path to write to.

Read the whole dossier before writing. It keeps the summary grounded in the
chapter and helps you notice when an idea has come from a commentary instead of
the text itself.

Then read `docs/editorial-voice.md`, `src/content/chapters/psalms-23.md` as the
worked example, and the schema comments in `src/content.config.ts`. Together
they define the voice, the expected fields, and the validation contract.

## Step 2 — Find the thing that makes this chapter itself

Before filling in fields, answer one question: **what happens in this chapter
that gives it its own shape?** Write that down. It should guide the `title`, the
first sentence of `shortAnswer`, and the order of the explanation.

Psalm 23 → two pictures, shepherd then host, and the pronoun changes in the
valley. Psalm 28 → the poem turns from pleading to praise between verse 5 and
verse 6 and never says why.

If the answer is only "it is about trusting God," keep reading. Look for the
scene, argument, turn, repeated phrase, or unresolved question that makes this
chapter recognizable.

## Step 3 — Write

**Write for someone in their first month of reading the Bible.** Keep sentences
manageable and explain every church term before using it. Words such as
"propitiation," "eschatology," and "federal headship" create new questions when
the page has not defined them.

**Be plain and specific.** "God is in control" is too broad to help a newcomer.
Name what happens in the chapter, who is speaking, and what the words would have
meant to their first audience.

Use the warm explainer voice in `docs/editorial-voice.md`. Give the positive
meaning first. Do not build every paragraph as a correction, repeat the same
contrast phrase, or use punctuation to make ordinary observations sound
dramatic. Where Christians disagree, describe the main readings and the
evidence behind them. Correct a common misuse only when the misuse is real and
important to understanding the chapter.

### The fields, and what each one is for

Limits are enforced by Zod at build time. Overshooting fails the build, so count.

| Field | Limit | What it has to do |
|---|---|---|
| `usfm` | `PSA.28` | The route, the reverse index and the sitemap entry all derive from it. |
| `title` | 10–95 | The `<h1>`. Lead with the reference — that is what people type — then make a claim, not a label. Nothing is appended to it, so do not spend words on "summary" or "commentary" either. |
| `seoTitle` | 25–60, optional | The `<title>`, for when `title` is too long to be one. Leave it out and `title` is used; past 60 characters the build stops and asks for it, because there is no way to shorten an authored claim mechanically without producing a fragment. Same rules, but keep only the half that *is* the claim: "Hebrews 11: The Hall of Faith Turns Over Halfway Through Verse 35" → "Hebrews 11: Where the Hall of Faith Turns". |
| `shortAnswer` | 200–750 | Rendered under the `<h1>` and reused as the meta description. Answer "what is this chapter about?" in the first sentence, then give enough context for the paragraph to stand on its own. |
| `outline` | 2–14 entries | Ranges must cover the chapter **with no gaps** — a reader using this to find a verse must never fall in a hole. `heading` (6–90) is a sentence about what happens, never a label. `note` 40–400. |
| `themes` | 2–6 | `name` 3–70, `explanation` 80–700. The ideas worth carrying out of the chapter. |
| `glossary` | ≤8 | `term` 2–50, `plain` 50–400. Explain every church word the chapter requires. **Do not use new jargon inside a definition.** |
| `keyVerses` | ≤6 | The verses people arrive looking for. `why` 60–500. Ranges allowed (`PSA.28.6-7`). Each one costs a passage fetch at render, so 3–5 is the sweet spot. |
| `caution` | 150–1500 | Correct a real, consequential misreading of the chapter. Famous passages usually need this, but do not invent a disagreement just to fill the field. |
| `faqs` | 2–8 | `q` 10–150, `a` 120–900. Real queries, phrased as typed. Each answer must **stand alone** — no "as mentioned above" — because they render as `FAQPage` structured data and get quoted in isolation. |
| `relatedTopics` | ≤6 | Slugs only from the dossier's list. Anything else fails the build. |
| `entity` | — | `name` plus `sameAs`. **Verify the URL returns 200 before writing it.** A fabricated Wikipedia link is the failure a reader remembers. |
| `figure` | omit unless a picture has been chosen | Optional. Do not hunt for one. The site currently ships without editorial images; a published brief is valid without `figure`. If you are explicitly asked to add a picture: named biblical scene → public-domain painting or engraving of that scene; otherwise a photograph or museum object (manuscript, coin, landscape the text names). Never Unsplash/Pexels/Pixabay, never an AI image, never a generic European Jesus for an epistle. File goes in `src/assets/editorial/chapters/{slug}.jpg`; add the work to `scripts/data/editorial-images.json`. Fields: `src`, `alt` (20–180), `caption` (20–240), `kind` (`art` or `photograph`), `credit` (`title`, `creator`, `date`, `holder`, `license` `cc0`/`pd`/`cc-by`/`cc-by-sa`, `licenseUrl`, `sourceUrl`). |
| `publishedAt` / `reviewedAt` | dates | Today's date, in `YYYY-MM-DD`. Drives `<lastmod>` and the Article schema. |

The markdown **body** after the frontmatter is the "If this is your first time
reading X" note. It renders after the structured sections. Use it to point out
one or two details a first-time reader may otherwise miss.

### Pictures

Omit `figure`. The site currently ships without editorial images, and a
published brief is valid without one. Do not download a Wikimedia stand-in to
fill the field.

If you are explicitly asked to add a picture for this chapter:

1. If this chapter is a scene someone actually painted (the flood, the sermon
   on the mount, Nicodemus at night), use that work from a museum or Wikimedia
   Commons. Name it in the caption.
2. If it is not — most epistles, most Proverbs — use a photograph or artifact:
   a manuscript of the letter, a landscape the chapter names, a coin, a tool.
   Not a generic apostle portrait, and not a European Jesus reused from another
   page.
3. Licenses we will use: CC0, US public domain, CC BY, CC BY-SA. Skip NC, ND,
   Getty, Unsplash, Pexels, Pixabay, and Wikimedia's AI-generated category.
4. Download a ~1600–2000px JPEG into `src/assets/editorial/chapters/{slug}.jpg`.
   Host the file. Do not hotlink.
5. Add the work to the catalogue in `scripts/download-editorial-images.mjs` so
   it can be re-fetched. Credit `sourceUrl` is the museum or Commons page, not
   our copy.

`psalms-23.md` is the worked example for the fields.

### What not to do

- Do not paste or paraphrase the commentaries. The page renders all three in full
  directly below your writing; repeating them is both visible and pointless.
- Do not quote scripture at length in the fields. The chapter is rendered in full
  on the same page, and `keyVerses` pull their own text.
- Do not write an outline of headings ("God's provision", "David's response").
  Headings are claims. See `psalms-23.md`.
- Do not soften the hard part. Imprecatory psalms ask God to break teeth; Romans
  9 says what it says. Naming the difficulty is why a reader trusts the rest.
- Do not repeat "rather than," "not X but Y," or an em dash until it becomes the
  page's default rhythm. Run `npm run copy:audit` and review every flagged file.

## Step 4 — Validate

```
npx astro sync        # runs the Zod schema over every collection
npx astro build       # must pass before shipping
```

Then render it and read it:

```
npx astro dev --background
curl -s http://localhost:4322/psalms/28 | grep -o '<h[12][^>]*>[^<]*'
```

Check by eye: the `<h1>` reads as a claim, every heading uses the reference the
way a person writes it (`Psalm 28`, never `Psalms 28`), the chapter text renders
above the outline, and the page is **not** `noindex`.

## Step 5 — Ship

The sitemap, the `/study` hub, the book page, the reader-page CTA and the
`lastmod` all pick the brief up automatically from `chapterBriefIndex()`. Nothing
to register.

After a separately authorized deployment, tell the search engines the URL
changed:

```
npm run indexnow -- /psalms/28
```

Submit only what changed. Never `--sitemap` on a routine publish: every reader
page a crawler fetches is a licensed passage fetch against a rate-limited app
key, and a mass resubmission buys a mass crawl of pages that did not change.
