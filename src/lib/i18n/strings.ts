import { DEFAULT_LOCALE, type Locale } from './locales';

/**
 * The words this site says in its own voice, per language.
 *
 * Not the writing — that lives in `src/content/` and is translated per file.
 * These are the section headings and labels around it: "Common questions about
 * Salmo 91" was rendering in English above a Portuguese article, which is the
 * kind of thing that reads as a machine-translated page even when every word of
 * the actual content was written deliberately.
 *
 * A chapter reference is interpolated rather than concatenated, because the
 * reference does not sit in the same place in every language. English puts it
 * first in "Psalm 91 outline, verse by verse" and last in "Common questions
 * about Psalm 91". A template string per language is the only version of this
 * that does not read like it was assembled.
 *
 * The Romance tables lead with the reference and a colon, and that is a grammar
 * fix rather than a style choice. Spanish and Portuguese contract the definite
 * article into the preposition — "recorrido **del** Salmo 91", "roteiro **do**
 * Salmo 91" — and whether a book takes an article at all varies by book: it is
 * "do Salmo" but "de Gênesis". Getting that right per book would need a gender
 * and article column for 66 books in every Romance locale; putting the reference
 * in front of a colon needs none of it and is correct for every book. It also
 * happens to put the searched phrase at the start of the heading.
 *
 * **English is the fallback, and that is deliberate rather than lazy.** A locale
 * with no entry here also has no briefs — and a chapter with no brief renders
 * `noindex` and is absent from the sitemap, so nobody reaches it from search.
 * The strings for a language arrive with its first brief, which is the same rule
 * the rest of this project runs on: a page earns its polish when somebody writes
 * for it. Inventing headings for 55 languages nobody on the team reads would put
 * a grammatical error at the top of every section of every page in them.
 */
type Strings = {
	/** Breadcrumb: the site root. */
	home: string;
	/** Breadcrumb: the study hub. */
	studyHub: string;
	/** `<h2>` over the verse-by-verse outline. Takes the chapter reference. */
	outline: (reference: string) => string;
	/** `<h2>` over the themes. */
	themes: (reference: string) => string;
	/** `<h2>` over the glossary. */
	glossary: (reference: string) => string;
	/** `<h2>` over the key verses. */
	keyVerses: (reference: string) => string;
	/** `<h2>` over the misuse warning. */
	caution: (reference: string) => string;
	/** `<h2>` over the FAQs. */
	faqs: (reference: string) => string;
	/** `<h2>` over the related-topic links. */
	relatedTopics: string;
	/** `<h2>` over the republished commentary stack. English-only in practice. */
	commentaries: (reference: string) => string;
	/** Lead-in to the translation links: "Read Psalm 91 in …". */
	readIn: (reference: string) => string;
	/**
	 * The note under an `<h1>` where the two psalm numbering traditions differ.
	 *
	 * Only ever rendered in a locale that numbers from the Septuagint, so only
	 * those locales need it — but it lives here rather than in psalms.ts because
	 * it is a sentence, and psalms.ts has no business holding Russian prose.
	 */
	psalmNumbering: (hebrew: number) => string;
	/** The same, where the Greek splits one Hebrew psalm into two. */
	psalmNumberingShared: (hebrew: number, septuagint: number) => string;
};

const EN: Strings = {
	home: 'Home',
	studyHub: 'Bible study',
	outline: (r) => `${r} outline, verse by verse`,
	themes: (r) => `The main ideas in ${r}`,
	glossary: (r) => `Words in ${r}, explained simply`,
	keyVerses: (r) => `Key verses in ${r}`,
	caution: (r) => `What ${r} is often made to say, and does not`,
	faqs: (r) => `Common questions about ${r}`,
	relatedTopics: 'Related topics',
	commentaries: (r) => `What the commentaries say about ${r}`,
	readIn: (r) => `Read ${r} in`,
	psalmNumbering: (hebrew) => `Psalm ${hebrew} in Hebrew numbering.`,
	psalmNumberingShared: (hebrew, septuagint) =>
		`Part of Psalm ${hebrew} in Hebrew numbering (Septuagint ${septuagint}).`,
};

/**
 * Brazilian Portuguese — the first locale with writing behind it.
 *
 * "Salmo", singular, throughout, because that is what the reference itself says
 * and what 2.5 million searches a month are for. See the CHAPTER_FORM and
 * SEARCH_SLUG tables in lib/bible/books.
 */
const PT: Strings = {
	home: 'Início',
	studyHub: 'Estudo bíblico',
	outline: (r) => `${r}: roteiro versículo por versículo`,
	themes: (r) => `${r}: as ideias principais`,
	glossary: (r) => `${r}: palavras explicadas de forma simples`,
	keyVerses: (r) => `${r}: versículos-chave`,
	caution: (r) => `${r}: o que se costuma dizer que o texto afirma, e não afirma`,
	faqs: (r) => `${r}: perguntas frequentes`,
	relatedTopics: 'Temas relacionados',
	commentaries: (r) => `${r}: o que dizem os comentários`,
	readIn: (r) => `${r} em outras traduções:`,
	psalmNumbering: (hebrew) => `Salmo ${hebrew} na numeração hebraica.`,
	psalmNumberingShared: (hebrew, septuagint) =>
		`Parte do Salmo ${hebrew} na numeração hebraica (Septuaginta ${septuagint}).`,
};

/**
 * Spanish.
 *
 * "Salmo" singular throughout, which here needs no override at all — the
 * Spanish publisher already titles the book "Salmo", so the reference and the
 * 426,000-a-month query agree with each other without help.
 */
const ES: Strings = {
	home: 'Inicio',
	studyHub: 'Estudio bíblico',
	outline: (r) => `${r}: recorrido versículo por versículo`,
	themes: (r) => `${r}: las ideas principales`,
	glossary: (r) => `${r}: palabras explicadas de forma sencilla`,
	keyVerses: (r) => `${r}: versículos clave`,
	caution: (r) => `${r}: lo que se suele decir que dice, y no dice`,
	faqs: (r) => `${r}: preguntas frecuentes`,
	relatedTopics: 'Temas relacionados',
	commentaries: (r) => `${r}: lo que dicen los comentarios`,
	readIn: (r) => `${r} en otras traducciones:`,
	psalmNumbering: (hebrew) => `Salmo ${hebrew} en la numeración hebrea.`,
	psalmNumberingShared: (hebrew, septuagint) =>
		`Parte del Salmo ${hebrew} en la numeración hebrea (Septuaginta ${septuagint}).`,
};

const TABLES: Readonly<Record<string, Strings>> = {
	en: EN,
	pt: PT,
	es: ES,
	// Castellano shares every string here, on the same terms as pt-pt below.
	'es-es': ES,
	// European Portuguese shares every string here. The two diverge on
	// vocabulary this table does not happen to use, so pointing at the same
	// object is honest rather than a shortcut; give it its own when it needs one.
	'pt-pt': PT,
};

export function strings(locale: Locale = DEFAULT_LOCALE): Strings {
	return TABLES[locale.code] ?? TABLES[DEFAULT_LOCALE.code]!;
}
