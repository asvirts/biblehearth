export default function Header({ path = '/' }: { path?: string }) {
	return (
		<>
			<header className="site-header">
				<div className="wrap header-inner">
					<a className="wordmark" href="/">
						{/*
				Inlined rather than loaded from /favicon.svg, and hidden from the
				accessibility tree: the link is already named by the text beside it, so
				the mark is decorative and naming it again would only make a screen
				reader say "BibleHearth" twice. An empty alt attribute says that
				correctly, but auditors read it as a missing one and flagged it on
				every page on the site. No image element, nothing to flag, and one
				fewer request in the bargain.

				A JSX-style comment, not an HTML one, so the explanation stays next to
				the code without being served to every reader.
			*/}
						<svg
							className="wordmark-mark"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 64 64"
							width="36"
							height="36"
							aria-hidden="true"
							focusable="false"
						>
							<rect width="64" height="64" rx="14" fill="#F7F1E8" />
							<rect x="13" y="10" width="38" height="44" rx="6" fill="#2C2416" />
							<path
								fill="#F7F1E8"
								d="M21.5 48V27c0-7 4.4-11.5 10.5-11.5S42.5 20 42.5 27v21H21.5z"
							/>
							<path
								fill="#B54A2C"
								d="M24 38.5c0-6.5 5.2-10.2 8-16.5 2.8 6.3 8 10 8 16.5a8 8 0 1 1-16 0z"
							/>
							<path
								fill="#E8B45A"
								d="M28.2 39.2c0-3.6 2.6-5.6 3.8-9 1.2 3.4 3.8 5.4 3.8 9a3.8 3.8 0 1 1-7.6 0z"
							/>
						</svg>
						BibleHearth
					</a>
					<nav className="nav" aria-label="Primary">
						{/*
				Study leads, and is in the primary nav at all because it is the hub
				for the writing that makes this site indexable. Every chapter study
				hangs off /study, and until now the only site-wide link to it was one
				line in the footer — so the section carrying all of our original
				work had the weakest internal linking on the site, while /versions,
				which is a list of other people's translations, sat in the header.

				`startsWith('/study')` alone would miss the studies themselves: they
				live at the site root (/john/3, not /study/john/3), so a reader on a
				chapter study would see no nav item marked current. There is no
				prefix that identifies them — 66 book slugs at the root is the
				route's whole shape — so this matches nothing beyond the hub and its
				own path rather than guessing.
			*/}
						<a href="/study" aria-current={path === '/study' ? 'page' : undefined}>
							Study
						</a>
						<a href="/topics" aria-current={path.startsWith('/topics') ? 'page' : undefined}>
							Topics
						</a>
						<a href="/answers" aria-current={path.startsWith('/answers') ? 'page' : undefined}>
							Answers
						</a>
						<a href="/versions" aria-current={path.startsWith('/versions') ? 'page' : undefined}>
							Versions
						</a>
					</nav>
				</div>
			</header>
		</>
	);
}
