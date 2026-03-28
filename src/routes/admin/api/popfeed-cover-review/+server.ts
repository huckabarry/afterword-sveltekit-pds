import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { getPopfeedBaseItems } from '$lib/server/popfeed';
import {
	getPopfeedBookCoverReviewQueue,
	reviewPopfeedBookCoverOverride
} from '$lib/server/pds-popfeed-overrides';

function normalizeLimit(value: unknown, fallback = 24) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeAction(value: unknown) {
	const normalized = String(value || '')
		.trim()
		.toLowerCase();
	return normalized === 'approve' || normalized === 'hide' ? normalized : null;
}

export async function GET(event) {
	await requireAdminAccess(event);

	try {
		const limit = normalizeLimit(event.url.searchParams.get('limit'));
		const items = await getPopfeedBaseItems();
		const queue = await getPopfeedBookCoverReviewQueue({ items, limit });

		return json({
			ok: true,
			...queue
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error:
					error instanceof Error ? error.message : 'Unable to load the Popfeed cover review queue.'
			},
			{ status: 500 }
		);
	}
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => ({}));
	const sourceUri = String(body?.sourceUri || '').trim();
	const action = normalizeAction(body?.action);

	if (!sourceUri || !action) {
		return json(
			{
				ok: false,
				error: 'A source URI and valid review action are required.'
			},
			{ status: 400 }
		);
	}

	try {
		const items = await getPopfeedBaseItems();
		await reviewPopfeedBookCoverOverride({
			sourceUri,
			action,
			items
		});

		return json({
			ok: true,
			action,
			sourceUri
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Unable to update the Popfeed cover review.'
			},
			{ status: 500 }
		);
	}
}
