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
	const contentType = event.request.headers.get('content-type') || '';
	let body: Record<string, unknown> = {};

	if (contentType.includes('application/json')) {
		body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
	} else {
		const form = await event.request.formData().catch(() => null);
		body = form
			? {
					grant_type: form.get('grant_type'),
					grantType: form.get('grantType'),
					code: form.get('code'),
					client_id: form.get('client_id'),
					clientId: form.get('clientId'),
					client_secret: form.get('client_secret'),
					clientSecret: form.get('clientSecret'),
					redirect_uri: form.get('redirect_uri'),
					redirectUri: form.get('redirectUri')
				}
			: {};
	}

	const grantType = String(body.grant_type || body.grantType || '').trim();
	const code = String(body.code || '').trim();
	const clientId = String(body.client_id || body.clientId || '').trim();
	const clientSecret = String(body.client_secret || body.clientSecret || '').trim();
	const redirectUri = String(body.redirect_uri || body.redirectUri || '').trim();

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
		appId: app.id,
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
