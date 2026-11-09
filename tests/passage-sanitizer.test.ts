import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { sanitizePassageHtml } from '../src/lib/bible/sanitize';

function assertInert(html: string) {
	const root = parseFragment(`<div>${sanitizePassageHtml(html)}</div>`);
	const forbidden = new Set([
		'script',
		'style',
		'svg',
		'math',
		'iframe',
		'object',
		'embed',
		'img',
		'form',
		'input',
		'base',
		'link',
		'meta',
		'template',
	]);
	const walk = (node: DefaultTreeAdapterTypes.Node) => {
		if ('tagName' in node) {
			assert.ok(!forbidden.has(node.tagName), `active tag: ${node.tagName}`);
			assert.equal(node.namespaceURI, 'http://www.w3.org/1999/xhtml');
			for (const attr of node.attrs) {
				assert.ok(!/^on/i.test(attr.name), `event handler: ${attr.name}`);
				assert.ok(
					!['style', 'src', 'srcdoc', 'id', 'name', 'data-va', 'data-va-view'].includes(attr.name),
				);
				if (attr.name === 'href') {
					assert.ok(
						attr.value.startsWith('#') ||
							['http:', 'https:'].includes(new URL(attr.value).protocol),
					);
				}
			}
		}
		if ('childNodes' in node) node.childNodes.forEach(walk);
	};
	walk(root);
	return root;
}

test('malformed and encoded provider markup stays inert after HTML parsing', () => {
	for (const input of [
		'<script>globalThis.fixture=true</script><p onclick="alert(1)">text</p>',
		'<svg><g/onload=alert(1)><a xlink:href="javascript:alert(1)">x</a></svg>',
		'<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
		'<a href="javascript:alert(1)">x</a><a href="jav&#x61;script:alert(1)">x</a>',
		'<a href="java\tscript:alert(1)">x</a><a href="data:text/html,x">x</a>',
		'<p class="x\" onmouseover=alert(1)" data-va="forged" data-va-view="forged">x</p>',
		'<div><iframe srcdoc="<script>alert(1)</script>"></iframe></div>',
		'<!-- unclosed <script><p>markup &lt;img src=x onerror=alert(1)&gt;',
		'<a href="#\" onclick=alert(1)">note</a><span v="1\" onload=alert(1)">verse</span>',
		'<table><tr><td colspan="2" style="background:url(javascript:x)">text</td></tr></table>',
	])
		assertInert(input);
});

test('Scripture verse markers, footnotes and safe links survive sanitization', () => {
	const output = sanitizePassageHtml(
		'<p class="yv-p"><span class="yv-v" v="1">Text</span><a href="#note-1" data-verse-footnote="1">note</a><a href="https://example.invalid/?a=1&b=2">source</a></p>',
	);
	assert.match(output, /class="yv-v" v="1"/);
	assert.match(output, /href="#note-1" data-verse-footnote="1"/);
	assert.match(output, /https:\/\/example.invalid\/\?a=1&amp;b=2/);
	assertInert(output);
});
