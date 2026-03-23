import { json } from '@sveltejs/kit';
import { exchangeAuthorizationCode } from '$lib/server/mastodon-auth';

export async function POST(event) {
	const form = await event.request.formData();
	const grantType = String(form.get('grant_type') || '').trim();
	const clientId = String(form.get('client_id') || '').trim();
	const clientSecret = String(form.get('client_secret') || '').trim();
	const code = String(form.get('code') || '').trim();
	const redirectUri = String(form.get('redirect_uri') || '').trim();

	if (grantType !== 'authorization_code') {
		return json({ error: 'unsupported_grant_type' }, { status: 400 });
	}

	const token = await exchangeAuthorizationCode(event, {
		clientId,
		clientSecret,
		code,
		redirectUri
	});

	return json({
		access_token: token.accessToken,
		token_type: 'Bearer',
		scope: token.scope,
		created_at: Math.floor(Date.now() / 1000)
	});
}
