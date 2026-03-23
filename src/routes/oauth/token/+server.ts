import { json } from '@sveltejs/kit';
import {
	consumeAuthorizationCode,
	createAccessToken,
	getMastodonAppByClientId
} from '$lib/server/mastodon-auth';

function corsHeaders() {
	return {
		'access-control-allow-origin': '*',
		'access-control-allow-methods': 'POST, OPTIONS',
		'access-control-allow-headers': 'authorization, content-type'
	};
}

export function OPTIONS() {
	return new Response(null, { headers: corsHeaders() });
}

export async function POST(event) {
	const form = await event.request.formData().catch(() => null);
	const grantType = String(form?.get('grant_type') || '').trim();
	const code = String(form?.get('code') || '').trim();
	const clientId = String(form?.get('client_id') || '').trim();
	const clientSecret = String(form?.get('client_secret') || '').trim();
	const redirectUri = String(form?.get('redirect_uri') || '').trim();

	if (grantType !== 'authorization_code') {
		return json({ error: 'unsupported_grant_type' }, { status: 400, headers: corsHeaders() });
	}

	const app = clientId ? await getMastodonAppByClientId(event, clientId) : null;
	if (!app || app.clientSecret !== clientSecret) {
		return json({ error: 'invalid_client' }, { status: 401, headers: corsHeaders() });
	}

	const authorization = await consumeAuthorizationCode(event, {
		code,
		clientId,
		redirectUri
	});

	if (!authorization) {
		return json({ error: 'invalid_grant' }, { status: 400, headers: corsHeaders() });
	}

	const accessToken = await createAccessToken(event, {
		clientId,
		scope: authorization.scope
	});

	return json(
		{
			access_token: accessToken,
			token_type: 'Bearer',
			scope: authorization.scope,
			created_at: Math.floor(Date.now() / 1000)
		},
		{ headers: corsHeaders() }
	);
}
