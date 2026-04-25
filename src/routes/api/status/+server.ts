import { json } from '@sveltejs/kit';
import { getStatusPage, STATUS_PAGE_SIZE } from '$lib/server/atproto';
import { serializeStatusFeedPage } from '$lib/server/status-api';
import { getStatusSnapshotPage } from '$lib/server/status-snapshot';

function normalizeLimit(value: string | null, fallback = STATUS_PAGE_SIZE) {
	const parsed = Number.parseInt(String(value || fallback), 10);

	if (!Number.isFinite(parsed)) {
		return fallback;
	}

	return Math.max(1, Math.min(parsed, 40));
}

function normalizeBoolean(value: string | null, fallback = false) {
	const normalized = String(value || '')
		.trim()
		.toLowerCase();

	if (!normalized) {
		return fallback;
	}

	return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export async function GET(event) {
	const cursor = String(event.url.searchParams.get('cursor') || '').trim() || null;
	const limit = normalizeLimit(event.url.searchParams.get('limit'));
	const includeReplies = normalizeBoolean(event.url.searchParams.get('includeReplies'));
	const page =
		!cursor && limit === STATUS_PAGE_SIZE && !includeReplies
			? await getStatusSnapshotPage({
					platform: event.platform
				})
			: await getStatusPage(undefined, {
					cursor,
					includeThreadContext: true,
					limit,
					freshnessMs: 1000 * 60 * 4
				});

	const filteredPage = includeReplies
		? page
		: {
				...page,
				statuses: page.statuses.filter((status) => !status.isReply)
			};

	return json(serializeStatusFeedPage(filteredPage), {
		headers: {
			'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
		}
	});
}
