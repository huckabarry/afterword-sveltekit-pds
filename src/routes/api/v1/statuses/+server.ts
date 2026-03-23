import { json } from '@sveltejs/kit';
import { requireAccessToken } from '$lib/server/mastodon-auth';
import { createAtprotoStatus } from '$lib/server/atproto-publish';
import { formatMastodonStatus, getInstanceOrigin } from '$lib/server/mastodon-api';

export async function POST(event) {
	await requireAccessToken(event);

	const form = await event.request.formData();
	const status = String(form.get('status') || '').trim();

	if (!status) {
		return json({ error: 'Status text is required' }, { status: 422 });
	}

	const created = await createAtprotoStatus(status);
	return json(
		formatMastodonStatus(getInstanceOrigin(event.url), {
			uri: created.uri,
			id: created.id,
			text: created.text,
			createdAt: created.createdAt
		}),
		{ status: 200 }
	);
}
