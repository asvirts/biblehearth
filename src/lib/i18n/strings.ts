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
	/** Accessible label for the chapter's in-page navigation. */
	onThisPage: string;
	/** Short labels in the chapter's in-page navigation. */
	jump: {
		fullText: string;
		outline: string;
		themes: string;
		glossary: string;
		keyVerses: string;
		caution: string;
		questions: string;
		commentary: string;
	};
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
	/** Sentence above the glossary definitions. */
	glossaryIntro: string;
	/** One related-topic link. */
	relatedTopicLink: (title: string) => string;
	/** Generated copy that appears only in a page's Markdown twin. */
	markdown: {
		scriptureNote: string;
		source: string;
		reviewed: string;
		copyright: string;
	};
	/** `<h2>` over the republished commentary stack. English-only in practice. */
	commentaries: (reference: string) => string;
	/** Lead-in to the translation links: "Read Psalm 91 in …". */
	readIn: (reference: string) => string;
	/** Lead-in to the links under a chapter already shown in full. */
	readInOther: (reference: string) => string;
	/** Provenance line at the foot of a written study. Takes the review date. */
	reviewedBy: (date: string) => string;
	/**
	 * The words on a book's study page.
	 *
	 * These say only what is true of that locale's page. English carries the
	 * republished commentaries, so its copy promises them; a translated book has a
	 * grid of chapters and whichever studies somebody has written, so its copy
	 * promises nothing more.
	 */
	book: {
		/** `<title>`. */
		title: (book: string) => string;
		/** Meta description. */
		description: (book: string, chapters: number) => string;
		/** Opening paragraph. `written` is how many chapters have a study. */
		lede: (book: string, chapters: number, written: number) => string;
		/** `<h2>` over the chapter grid. */
		chaptersIn: (book: string) => string;
		/** Note under the grid, when at least one chapter is written. */
		writtenNote: string;
		/** `<h2>` over the list of written studies. */
		writtenIn: (book: string) => string;
	};
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
	onThisPage: 'On this page',
	jump: {
		fullText: 'Full text',
		outline: 'Outline',
		themes: 'Main ideas',
		glossary: 'Words explained',
		keyVerses: 'Key verses',
		caution: 'Common misreadings',
		questions: 'Questions',
		commentary: 'Full commentary',
	},
	outline: (r) => `${r} outline, verse by verse`,
	themes: (r) => `The main ideas in ${r}`,
	glossary: (r) => `Words in ${r}, explained simply`,
	keyVerses: (r) => `Key verses in ${r}`,
	caution: (r) => `Common misreadings of ${r}`,
	faqs: (r) => `Common questions about ${r}`,
	relatedTopics: 'Related topics',
	glossaryIntro: 'Simple definitions for words that may be unfamiliar to a new reader.',
	relatedTopicLink: (title) => `Bible verses about ${title.toLowerCase()}`,
	markdown: {
		scriptureNote:
			'_Scripture text is not reproduced in this file: the translations BibleHearth serves are licensed from their publishers and require a copyright notice beside the text. Every reference below links to the verse on BibleHearth, where the passage and its notice appear together._',
		source: 'Source',
		reviewed: 'Reviewed',
		copyright:
			'Original writing © BibleHearth. Licensed Scripture is not included in this file.',
	},
	commentaries: (r) => `What the commentaries say about ${r}`,
	readIn: (r) => `Read ${r} in`,
	readInOther: (r) => `Read ${r} in another translation:`,
	reviewedBy: (date) =>
		`Summary, outline and questions written and reviewed by BibleHearth, ${date}.`,
	book: {
		title: (book) => `${book} | Summary, Chapters, and Commentary`,
		description: (book, chapters) =>
			`Study all ${chapters} ${chapters === 1 ? 'chapter' : 'chapters'} of ${book} with chapter outlines, clear explanations, and notes from three commentaries.`,
		lede: (book, chapters, written) =>
			`The book of ${book} has ${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}. Each page includes the chapter, an outline of its movement, and notes from three commentaries.${
				written
					? ` ${written} ${written === 1 ? 'chapter has' : 'chapters have'} a written summary in our own words.`
					: ''
			}`,
		chaptersIn: (book) => `Chapters in ${book}`,
		writtenNote:
			'Highlighted chapters include an original BibleHearth study. The remaining chapters still include the commentary notes.',
		writtenIn: (book) => `Written summaries in ${book}`,
	},
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
	onThisPage: 'Nesta página',
	jump: {
		fullText: 'Texto completo',
		outline: 'Roteiro',
		themes: 'Ideias principais',
		glossary: 'Palavras explicadas',
		keyVerses: 'Versículos-chave',
		caution: 'Leitura cuidadosa',
		questions: 'Perguntas',
		commentary: 'Comentário completo',
	},
	outline: (r) => `${r}: roteiro versículo por versículo`,
	themes: (r) => `${r}: as ideias principais`,
	glossary: (r) => `${r}: palavras explicadas de forma simples`,
	keyVerses: (r) => `${r}: versículos-chave`,
	caution: (r) => `${r}: como ler o texto com cuidado`,
	faqs: (r) => `${r}: perguntas frequentes`,
	relatedTopics: 'Temas relacionados',
	glossaryIntro: 'Definições simples para palavras que podem ser novas para quem está começando a ler a Bíblia.',
	relatedTopicLink: (title) => `Versículos bíblicos sobre ${title.toLowerCase()}`,
	markdown: {
		scriptureNote:
			'_O texto bíblico não é reproduzido neste arquivo: as traduções oferecidas pelo BibleHearth são licenciadas por suas editoras e exigem que o aviso de direitos autorais apareça junto ao texto. Cada referência abaixo leva ao versículo no BibleHearth, onde a passagem e o aviso aparecem juntos._',
		source: 'Fonte',
		reviewed: 'Revisado em',
		copyright:
			'Texto original © BibleHearth. As Escrituras licenciadas não estão incluídas neste arquivo.',
	},
	commentaries: (r) => `${r}: o que dizem os comentários`,
	readIn: (r) => `${r} em outras traduções:`,
	readInOther: (r) => `${r} em outras traduções:`,
	reviewedBy: (date) =>
		`Resumo, roteiro e perguntas escritos e revisados pelo BibleHearth, ${date}.`,
	// The book name leads and a colon follows, for the reason in the header note:
	// it takes an article in some books and not in others.
	book: {
		title: (book) => `${book} | Estudo bíblico e resumos dos capítulos`,
		description: (book, chapters) =>
			`${book}: ${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}. Leia os estudos já escritos, com roteiro versículo por versículo, ideias principais e perguntas frequentes.`,
		lede: (book, chapters, written) =>
			`${book}: ${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}.${
				written
					? ` ${written} ${written === 1 ? 'capítulo tem' : 'capítulos têm'} um estudo escrito por nós, em linguagem simples.`
					: ''
			}`,
		chaptersIn: (book) => `${book}: capítulos`,
		writtenNote: 'Os capítulos em destaque têm um estudo original do BibleHearth.',
		writtenIn: (book) => `${book}: estudos escritos`,
	},
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
	onThisPage: 'En esta página',
	jump: {
		fullText: 'Texto completo',
		outline: 'Recorrido',
		themes: 'Ideas principales',
		glossary: 'Palabras explicadas',
		keyVerses: 'Versículos clave',
		caution: 'Lectura cuidadosa',
		questions: 'Preguntas',
		commentary: 'Comentario completo',
	},
	outline: (r) => `${r}: recorrido versículo por versículo`,
	themes: (r) => `${r}: las ideas principales`,
	glossary: (r) => `${r}: palabras explicadas de forma sencilla`,
	keyVerses: (r) => `${r}: versículos clave`,
	caution: (r) => `${r}: cómo leer el texto con cuidado`,
	faqs: (r) => `${r}: preguntas frecuentes`,
	relatedTopics: 'Temas relacionados',
	glossaryIntro: 'Definiciones sencillas para palabras que pueden resultar nuevas al comenzar a leer la Biblia.',
	relatedTopicLink: (title) => `Versículos bíblicos sobre ${title.toLowerCase()}`,
	markdown: {
		scriptureNote:
			'_El texto bíblico no se reproduce en este archivo: las traducciones que ofrece BibleHearth tienen licencia de sus editoriales y requieren que el aviso de derechos de autor aparezca junto al texto. Cada referencia enlaza con el versículo en BibleHearth, donde la traducción y su aviso aparecen juntos._',
		source: 'Fuente',
		reviewed: 'Revisado el',
		copyright:
			'Texto original © BibleHearth. Las Escrituras con licencia no están incluidas en este archivo.',
	},
	commentaries: (r) => `${r}: lo que dicen los comentarios`,
	readIn: (r) => `${r} en otras traducciones:`,
	readInOther: (r) => `${r} en otras traducciones:`,
	reviewedBy: (date) =>
		`Resumen, recorrido y preguntas escritos y revisados por BibleHearth, ${date}.`,
	book: {
		title: (book) => `${book} | Estudio bíblico y resúmenes de los capítulos`,
		description: (book, chapters) =>
			`${book}: ${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}. Lee los estudios ya escritos, con recorrido versículo por versículo, ideas principales y preguntas frecuentes.`,
		lede: (book, chapters, written) =>
			`${book}: ${chapters} ${chapters === 1 ? 'capítulo' : 'capítulos'}.${
				written
					? ` ${written} ${written === 1 ? 'capítulo tiene' : 'capítulos tienen'} un estudio escrito por nosotros, en lenguaje sencillo.`
					: ''
			}`,
		chaptersIn: (book) => `${book}: capítulos`,
		writtenNote: 'Los capítulos destacados tienen un estudio original de BibleHearth.',
		writtenIn: (book) => `${book}: estudios escritos`,
	},
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
