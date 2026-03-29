import { json } from '@sveltejs/kit';
import { getStatusPage, STATUS_PAGE_SIZE } from '$lib/server/atproto';

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
	const page = await getStatusPage(undefined, {
		cursor,
		includeThreadContext: true,
		limit
	});

	return json(page);
}
