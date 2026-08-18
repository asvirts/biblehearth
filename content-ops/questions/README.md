# Chapter question catalog

One file per book: `<BOOK_USFM>.json`. Questions are keyed by chapter number and
each one is a candidate for a single page in `src/content/answers/`.

## What earns a slot

The test is whether the question has a **specific answer that lives in the
text**. A page can only rank if it says something a reader could not have
guessed from the chapter title.

Good — anchored to a phrase, a name, a number, or a command:

- What are the good works God prepared in advance in Ephesians 2:10?
- Who is the prince of the power of the air?
- What does "he led a host of captives" mean?
- Why does no armor cover the back in Ephesians 6?

Rejected — the whole chapter as the subject, or a label with no puzzle in it:

- What does Ephesians 2 mean?
- Summary of Ephesians 2
- What is the main theme of Ephesians 2?
- What can we learn from Ephesians 2?

Those last four are already served by the `chapters` collection. Duplicating
them here splits our own pages against each other.

A chapter with nothing contested in it gets two entries, or one. Padding a
genealogy out to eight questions manufactures pages that will never rank and
dilutes the internal links pointing at the ones that would.

## Fields

| field      | meaning |
| ---------- | ------- |
| `q`        | The question as someone types it into Google. Sentence case, ends in `?`. |
| `slug`     | The `/answers/<slug>` route. Unique across the whole catalog. Omits the book name only when the phrase is already unmistakable. |
| `passage`  | The verses the answer turns on — `EPH.2.10`, `GEN.6.1-4`. Never a bare chapter. |
| `kind`     | See below. Drives which article template fits. |
| `priority` | `1` write first, `2` write once the 1s are done, `3` real question, thin demand. |

### `kind`

- `phrase` — a specific wording in the text needs unpacking
- `identity` — who or what is this person, group, or being
- `doctrine` — the verse is load-bearing for a doctrine people argue about
- `ethics` — God commands or allows something that troubles readers
- `tension` — appears to conflict with another passage
- `number` — a number, date, or measurement
- `practice` — what a reader is supposed to actually do
- `history` — historical, geographical, or archaeological
- `claim` — a widely repeated pulpit claim that may or may not hold up

### `priority`

**This field is currently unreliable and should not be used to rank work.** The
first pass assigned `1` to 87% of entries, which means it separates almost
nothing. `npm run questions:audit` prints the distribution and says so.

It was meant to read:

1. People search this in volume and the answer is genuinely contested or
   non-obvious. Ephesians 2:10's good works. The sons of God in Genesis 6.
2. Steady long-tail demand, or high demand with a settled answer.
3. Someone reading closely would ask it. Write it when the book gets a pass.

Getting there needs measured volume, not a second guess. Export the CSV, pull
real numbers, and rewrite the field from the data.

## Sourcing

These are candidates generated from the text and from the questions these
passages are known to raise — **not** measured search volume. Nothing here has
been checked against a keyword tool, a SERP, or a People-Also-Ask box. Treat
every row as a hypothesis about demand until it has a number attached.

`npm run questions:audit` checks structure, duplicate slugs, and passage bounds.
`npm run questions:export` writes a CSV for pasting into a keyword tool.
