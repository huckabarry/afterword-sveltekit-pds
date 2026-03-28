import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { getPopfeedBaseItems } from '$lib/server/popfeed';
import { syncPopfeedBookCoverOverrides } from '$lib/server/pds-popfeed-overrides';

function normalizeLimit(value: unknown) {
	const parsed = Number.parseInt(String(value || ''), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeBoolean(value: unknown) {
	if (typeof value === 'boolean') {
		return value;
	}

	const normalized = String(value || '')
		.trim()
		.toLowerCase();
	return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => ({}));
	const limit = normalizeLimit(body?.limit);
	const force = normalizeBoolean(body?.force);

	try {
		const items = await getPopfeedBaseItems();
		const result = await syncPopfeedBookCoverOverrides({
			items,
			limit,
			force
		});

		return json({
			ok: result.ok,
			...result
		});
	} catch (error) {
		return json(
			{
				ok: false,
				limit,
				force,
				error:
					error instanceof Error ? error.message : 'Unable to sync Popfeed book cover overrides.'
			},
			{ status: 500 }
		);
	}
}
