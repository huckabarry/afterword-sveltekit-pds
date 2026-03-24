import { json } from '@sveltejs/kit';
import { revokeAccessToken } from '$lib/server/mastodon-auth';

export async function POST(event) {
	const form = await event.request.formData().catch(() => null);
	const token = String(form?.get('token') || '').trim();
	const clientId = String(form?.get('client_id') || '').trim() || null;

	if (token) {
		await revokeAccessToken(event, {
			token,
			clientId
		});
	}

	return json({});
}
