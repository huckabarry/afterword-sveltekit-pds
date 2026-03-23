import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import {
	deleteWebmention,
	listRecentWebmentions,
	updateWebmentionStatus
} from '$lib/server/webmentions';

export async function GET(event) {
	await requireAdminAccess(event);

	const webmentions = await listRecentWebmentions(event, 100);
	return json({
		webmentions: webmentions.map((mention) => ({
			id: mention.id,
			sourceUrl: mention.sourceUrl,
			targetUrl: mention.targetUrl,
			sourceDomain: mention.sourceDomain,
			sourceTitle: mention.sourceTitle,
			status: mention.status,
			verifiedAt: mention.verifiedAt,
			createdAt: mention.createdAt
		}))
	});
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const intent = String(body?.intent || '').trim();
	const id = Number(body?.id || 0);

	if (!intent || !id) {
		return json({ ok: false, error: 'Missing webmention action.' }, { status: 400 });
	}

	if (intent === 'update') {
		const status = String(body?.status || '').trim();
		if (!status) {
			return json({ ok: false, error: 'Missing webmention status.' }, { status: 400 });
		}

		await updateWebmentionStatus(event, id, status);
		return json({ ok: true });
	}

	if (intent === 'delete') {
		await deleteWebmention(event, id);
		return json({ ok: true });
	}

	return json({ ok: false, error: 'Unknown webmention action.' }, { status: 400 });
}
