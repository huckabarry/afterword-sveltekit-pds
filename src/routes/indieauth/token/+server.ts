import { exchangeAuthorizationCode, getAccessTokenRecord, getMe, requireMicropubToken, validateClientId, validateMe, validateRedirectUri } from '$lib/server/indieauth';

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*',
			'access-control-allow-headers': 'Authorization, Content-Type',
			'access-control-allow-methods': 'GET, POST, OPTIONS'
		}
	});
}

function getFormValue(form: URLSearchParams, key: string) {
	return form.get(key)?.trim() || '';
}

export async function GET(event) {
	const token = await requireMicropubToken(event);
	return json({
		me: token.me,
		client_id: token.clientId,
		scope: token.scope
	});
}

export async function OPTIONS() {
	return json({});
}

export async function POST(event) {
	const body = await event.request.text();
	const form = new URLSearchParams(body);
	const grantType = getFormValue(form, 'grant_type') || 'authorization_code';

	if (grantType !== 'authorization_code') {
		return json({ error: 'unsupported_grant_type' }, 400);
	}

	const code = getFormValue(form, 'code');
	const clientId = validateClientId(getFormValue(form, 'client_id'));
	const redirectUri = validateRedirectUri(getFormValue(form, 'redirect_uri'));
	const codeVerifier = getFormValue(form, 'code_verifier') || null;
	const me = validateMe(getFormValue(form, 'me') || getMe(event.url.origin), event.url.origin);

	const token = await exchangeAuthorizationCode(event, {
		code,
		clientId,
		redirectUri,
		codeVerifier,
		me
	});

	return json({
		access_token: token.accessToken,
		token_type: 'Bearer',
		scope: token.scope,
		me: token.me
	});
}
