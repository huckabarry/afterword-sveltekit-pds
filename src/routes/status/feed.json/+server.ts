import { json } from '@sveltejs/kit';
import { getStatusPage, STATUS_PAGE_SIZE } from '$lib/server/atproto';
import { getStatusSnapshotPage } from '$lib/server/status-snapshot';

function normalizeLimit(value: string | null, fallback = STATUS_PAGE_SIZE) {
	const parsed = Number.parseInt(String(value || fallback), 10);

	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.max(1, Math.min(parsed, 40));
}

export async function GET(event) {
	const cursor = String(event.url.searchParams.get('cursor') || '').trim() || null;
	const limit = normalizeLimit(event.url.searchParams.get('limit'));
	const page =
		!cursor && limit === STATUS_PAGE_SIZE
			? await getStatusSnapshotPage({
					platform: event.platform
				})
			: await getStatusPage(undefined, {
					cursor,
					includeThreadContext: true,
					limit,
					freshnessMs: 1000 * 60 * 4
				});

	const filteredPage = {
		...page,
		statuses: page.statuses.filter((status) => !status.isReply)
	};

	return json(filteredPage, {
		headers: {
			'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
		}
	});
}
