import PageLayout from '../components/PageLayout';
import StatusMessage from '../components/StatusMessage';
export default function NotFound() {
	return (
		<PageLayout
			title="Page not found · BibleHearth"
			description="That Bible page is not available on BibleHearth."
			noindex
		>
			<StatusMessage
				title="Page not found"
				message="This page could not be found. Explore Bible versions, studies, topics, or answers using the navigation."
			/>
		</PageLayout>
	);
}
