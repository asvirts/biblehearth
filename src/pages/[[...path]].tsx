import type { GetServerSideProps } from 'next';
import superjson from 'superjson';
import { views } from '../lib/page/views';
import type { PageEnvelope } from '../lib/page/envelope';
import { getPageProps } from '../lib/page/server';

export const getServerSideProps: GetServerSideProps<PageEnvelope> = getPageProps;
export default function Page({ kind, data }: PageEnvelope) {
	return views[kind](superjson.parse(data) as never);
}
