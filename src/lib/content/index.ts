import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createElement, type ReactElement } from 'react';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { z } from 'zod';
import { collections } from '../../content.config';

/** The validated frontmatter and original markdown body of an editorial entry. */
export type CollectionName = keyof typeof collections;
export type CollectionEntry<T extends CollectionName> = {
	id: string;
	collection: T;
	data: z.output<(typeof collections)[T]>;
	body: string;
};
export type CollectionReference<T extends CollectionName = CollectionName> = {
	collection: T;
	id: string;
};

const contentRoot = path.join(process.cwd(), 'src', 'content');
const pending = new Map<CollectionName, Promise<CollectionEntry<any>[]>>();

async function markdownFiles(directory: string, base = directory): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const full = path.join(directory, entry.name);
			return entry.isDirectory()
				? markdownFiles(full, base)
				: entry.isFile() && entry.name.endsWith('.md')
					? [path.relative(base, full)]
					: [];
		}),
	);
	return files.flat().sort();
}

async function loadCollection<T extends CollectionName>(
	collection: T,
): Promise<CollectionEntry<T>[]> {
	const directory = path.join(contentRoot, collection);
	const files = await markdownFiles(directory);
	return Promise.all(
		files.map(async (relative) => {
			const filePath = path.join(directory, relative);
			const parsed = matter(await readFile(filePath, 'utf8'));
			if (parsed.data.figure && typeof parsed.data.figure.src === 'string') {
				// Frontmatter paths refer to source-controlled editorial assets. Copying to
				// public/editorial is a build step; do not accept references outside the
				// editorial asset tree, and do not expose arbitrary files as images.
				const source = path.resolve(path.dirname(filePath), parsed.data.figure.src);
				const assets = path.join(process.cwd(), 'src', 'assets', 'editorial');
				if (!source.startsWith(`${assets}${path.sep}`))
					throw new Error(`Unsafe editorial image in ${filePath}`);
				await stat(source);
				const sharp = (await import('sharp')).default;
				const metadata = await sharp(source).metadata();
				if (!metadata.width || !metadata.height)
					throw new Error(`Invalid editorial image in ${filePath}`);
				parsed.data.figure.src = {
					src: `/editorial/${path.relative(assets, source).split(path.sep).join('/')}`,
					width: metadata.width,
					height: metadata.height,
					format: metadata.format,
				};
			}
			const result = collections[collection].safeParse(parsed.data);
			if (!result.success) throw new Error(`Invalid content ${filePath}: ${result.error.message}`);
			return {
				id: relative.replace(/\.md$/, '').split(path.sep).join('/'),
				collection,
				data: result.data,
				body: parsed.content,
			} as CollectionEntry<T>;
		}),
	);
}

/**
 * Keep one validated snapshot per server process in production. In development,
 * reload to ensure authored changes show without restarting the dev server.
 */
export async function getCollection<T extends CollectionName>(
	collection: T,
	filter?: (entry: CollectionEntry<T>) => boolean,
): Promise<CollectionEntry<T>[]> {
	let promise = process.env.NODE_ENV === 'development' ? undefined : pending.get(collection);
	if (!promise) {
		promise = loadCollection(collection);
		if (process.env.NODE_ENV !== 'development') {
			pending.set(collection, promise);
			promise.catch(() => pending.delete(collection));
		}
	}
	const entries = (await promise) as CollectionEntry<T>[];
	return filter ? entries.filter(filter) : [...entries];
}

export async function getEntry<T extends CollectionName>(
	collection: T,
	id: string,
): Promise<CollectionEntry<T> | undefined> {
	return (await getCollection(collection)).find((entry) => entry.id === id);
}

export async function getEntries<T extends CollectionName>(
	refs: CollectionReference<T>[],
): Promise<CollectionEntry<T>[]> {
	const groups = new Map<T, CollectionEntry<T>[]>();
	await Promise.all(
		[...new Set(refs.map((ref) => ref.collection))].map(async (collection) => {
			groups.set(collection, await getCollection(collection));
		}),
	);
	return refs.flatMap(({ collection, id }) => {
		const entry = groups.get(collection)?.find((item) => item.id === id);
		return entry ? [entry] : [];
	});
}

/** Body markdown is authored by the project, not fetched scripture. */
export async function render(entry: { body?: string }): Promise<{ Content: () => ReactElement }> {
	const html = await marked.parse(entry.body ?? '');
	return { Content: () => createElement('div', { dangerouslySetInnerHTML: { __html: html } }) };
}
