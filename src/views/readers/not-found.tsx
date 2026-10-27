import PageLayout from '../../components/PageLayout';
import StatusMessage from '../../components/StatusMessage';
import type { loadNotFound } from '../../loaders/readers/not-found';

type Model = Awaited<ReturnType<typeof loadNotFound>>;

export function renderNotFound(model: Model) {
	return (
		<PageLayout
			title="Page not found · BibleHearth"
			description="That Bible page is not available on BibleHearth."
			noindex
		>
			<StatusMessage
				title="Page not found"
				message="This version, book, or chapter is not available. It may be unlicensed for this app, or the reference may be incorrect."
			/>
		</PageLayout>
	);
}
