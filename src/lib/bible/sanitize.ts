const ALLOWED_TAGS = new Set([
	'a',
	'b',
	'blockquote',
	'br',
	'div',
	'em',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'hr',
	'i',
	'li',
	'ol',
	'p',
	'span',
	'strong',
	'sub',
	'sup',
	'table',
	'tbody',
	'td',
	'th',
	'thead',
	'tr',
	'ul',
]);

const VOID_TAGS = new Set(['br', 'hr']);
const GLOBAL_ATTRS = new Set(['class']);
const TAG_ATTRS: Record<string, ReadonlySet<string>> = {
	a: new Set(['class', 'href']),
	span: new Set(['class', 'v']),
	td: new Set(['class', 'colspan', 'rowspan']),
	th: new Set(['class', 'colspan', 'rowspan']),
};

const TOKEN =
	/<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)>/g;
const ATTR =
	/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function escapeText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function escapeAttr(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function isAllowedAttr(tag: string, name: string): boolean {
	if (GLOBAL_ATTRS.has(name)) {
		return true;
	}
	if (name.startsWith('data-verse-footnote')) {
		return true;
	}
	return TAG_ATTRS[tag]?.has(name) ?? false;
}

function sanitizeHref(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed.startsWith('#')) {
		return trimmed;
	}
	try {
		const url = new URL(trimmed);
		if (url.protocol === 'http:' || url.protocol === 'https:') {
			return url.href;
		}
	} catch {
		return null;
	}
	return null;
}

function serializeAttrs(tag: string, rawAttrs: string): string {
	let result = '';
	ATTR.lastIndex = 0;
	for (const match of rawAttrs.matchAll(ATTR)) {
		const name = match[1]?.toLowerCase();
		if (!name || name.startsWith('on') || !isAllowedAttr(tag, name)) {
			continue;
		}

		const value = match[2] ?? match[3] ?? match[4] ?? '';
		if (name === 'href') {
			const href = sanitizeHref(value);
			if (!href) {
				continue;
			}
			result += ` href="${escapeAttr(href)}"`;
			continue;
		}

		result += ` ${name}="${escapeAttr(value)}"`;
	}
	return result;
}

export function sanitizePassageHtml(html: string): string {
	let output = '';
	let lastIndex = 0;

	TOKEN.lastIndex = 0;
	for (const match of html.matchAll(TOKEN)) {
		const index = match.index ?? 0;
		output += escapeText(html.slice(lastIndex, index));
		lastIndex = index + match[0].length;

		if (match[0].startsWith('<!--')) {
			continue;
		}

		const tag = match[1]?.toLowerCase();
		if (!tag || !ALLOWED_TAGS.has(tag)) {
			continue;
		}

		const isClose = match[0].startsWith('</');
		if (isClose) {
			if (!VOID_TAGS.has(tag)) {
				output += `</${tag}>`;
			}
			continue;
		}

		const attrs = serializeAttrs(tag, match[2] ?? '');
		const selfClosing = Boolean(match[3]) || VOID_TAGS.has(tag);
		output += selfClosing ? `<${tag}${attrs}>` : `<${tag}${attrs}>`;
	}

	output += escapeText(html.slice(lastIndex));
	return output;
}
