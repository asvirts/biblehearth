'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type {} from '@vercel/analytics';

/** The Vercel Analytics script supplies this queue; events use delegated markup. */
export default function Analytics() {
	const { asPath } = useRouter();
	useEffect(() => {
		const send = (element: Element, name: string | null) => {
			if (!name || typeof window.va !== 'function') return;
			const data: Record<string, string> = {};
			for (const attribute of element.attributes) {
				if (attribute.name.startsWith('data-va-') && attribute.name !== 'data-va-view') {
					if (Object.keys(data).length === 2) break;
					data[attribute.name.slice('data-va-'.length)] = attribute.value;
				}
			}
			window.va('event', { name, data });
		};
		const handleClick = (event: MouseEvent) => {
			const element = event.target instanceof Element ? event.target.closest('[data-va]') : null;
			if (element) send(element, element.getAttribute('data-va'));
		};
		document.addEventListener('click', handleClick);
		const observed = document.querySelectorAll('[data-va-view]');
		const observer =
			typeof IntersectionObserver === 'undefined'
				? null
				: new IntersectionObserver((entries) => {
						for (const entry of entries) {
							if (entry.isIntersecting) {
								observer?.unobserve(entry.target);
								send(entry.target, entry.target.getAttribute('data-va-view'));
							}
						}
					});
		observed.forEach((element) => observer?.observe(element));
		return () => {
			document.removeEventListener('click', handleClick);
			observer?.disconnect();
		};
	}, [asPath]);
	return null;
}
