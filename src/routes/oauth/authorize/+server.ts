import { error } from '@sveltejs/kit';
import { createAuthorizationCode, getClientAppByCredentials, requireAdminPasswordConfigured, validateAdminPassword } from '$lib/server/mastodon-auth';

function html(body: string, status = 200) {
	return new Response(body, {
		status,
		headers: {
			'content-type': 'text/html; charset=utf-8'
		}
	});
}

function getParams(url: URL) {
	return {
		clientId: url.searchParams.get('client_id')?.trim() || '',
		redirectUri: url.searchParams.get('redirect_uri')?.trim() || '',
		scope: url.searchParams.get('scope')?.trim() || 'read write',
		state: url.searchParams.get('state')?.trim() || '',
		responseType: url.searchParams.get('response_type')?.trim() || 'code'
	};
}

function renderForm(params: ReturnType<typeof getParams>, message = '') {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize App</title>
  <style>
    body { font-family: sans-serif; background:#1e2021; color:#ebebeb; margin:0; padding:2rem; }
    main { max-width: 34rem; margin: 0 auto; }
    input, button { width:100%; padding:.8rem; margin-top:.6rem; border-radius:.4rem; border:1px solid rgba(255,255,255,.2); }
    input { background:#2c2f30; color:#ebebeb; }
    button { background:#f2f7b7; color:#1e2021; font-weight:700; cursor:pointer; }
    p { color:#b0b3ae; }
    .error { color:#ffb4ab; }
  </style>
</head>
<body>
  <main>
    <h1>Authorize app</h1>
    <p>This client is requesting access to post as Bryan Robb on Afterword.</p>
    ${message ? `<p class="error">${message}</p>` : ''}
    <form method="post">
      <input type="hidden" name="client_id" value="${params.clientId}">
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}">
      <input type="hidden" name="scope" value="${params.scope}">
      <input type="hidden" name="state" value="${params.state}">
      <input type="hidden" name="response_type" value="${params.responseType}">
      <label>Password</label>
      <input type="password" name="password" autocomplete="current-password">
      <button type="submit">Authorize</button>
    </form>
  </main>
</body>
</html>`;
}

export async function GET(event) {
	requireAdminPasswordConfigured();
	const params = getParams(event.url);

	if (!params.clientId || !params.redirectUri || params.responseType !== 'code') {
		throw error(400, 'Invalid authorization request');
	}

	const app = await getClientAppByCredentials(event, params.clientId, null);
	if (!app) {
		throw error(400, 'Unknown client');
	}

	return html(renderForm(params));
}

export async function POST(event) {
	requireAdminPasswordConfigured();
	const form = await event.request.formData();
	const params = {
		clientId: String(form.get('client_id') || '').trim(),
		redirectUri: String(form.get('redirect_uri') || '').trim(),
		scope: String(form.get('scope') || 'read write').trim(),
		state: String(form.get('state') || '').trim(),
		responseType: String(form.get('response_type') || 'code').trim()
	};
	const password = String(form.get('password') || '');

	const app = await getClientAppByCredentials(event, params.clientId, null);
	if (!app || params.responseType !== 'code') {
		throw error(400, 'Invalid authorization request');
	}

	if (!validateAdminPassword(password)) {
		return html(renderForm(params, 'Incorrect password'), 401);
	}

	const code = await createAuthorizationCode(event, {
		appId: app.id,
		redirectUri: params.redirectUri,
		scopes: params.scope
	});

	const redirectUrl = new URL(params.redirectUri);
	redirectUrl.searchParams.set('code', code);
	if (params.state) redirectUrl.searchParams.set('state', params.state);

	return new Response(null, {
		status: 302,
		headers: {
			location: redirectUrl.toString()
		}
	});
}
