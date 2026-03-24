import { redirect } from '@sveltejs/kit';
import {
	authorizeAdminPassword,
	createAuthorizationCode,
	getMastodonAppByClientId,
	isAuthorizedAdmin,
	redirectUriAllowed
} from '$lib/server/mastodon-auth';

function renderAuthorizePage(input: {
	clientName: string;
	redirectUri: string;
	clientId: string;
	scope: string;
	state: string;
	error?: string;
	authorized: boolean;
}) {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Authorize ${input.clientName}</title>
	<style>
		body { font-family: ui-sans-serif, system-ui, sans-serif; background:#111315; color:#f4f4ef; margin:0; }
		.wrap { max-width: 32rem; margin: 5rem auto; padding: 2rem; background:#1d2023; border-radius: 1.5rem; }
		h1 { margin: 0 0 1rem; font-size: 2rem; }
		p { color:#c8cac3; line-height:1.5; }
		label { display:block; margin: 1rem 0 0.5rem; color:#c8cac3; font-weight:600; }
		input { width:100%; box-sizing:border-box; padding:0.9rem 1rem; border-radius:999px; border:1px solid #383c40; background:#141618; color:#fff; }
		button { margin-top:1.25rem; padding:0.9rem 1.2rem; border-radius:999px; border:none; background:#f1ef7a; color:#111; font-weight:700; cursor:pointer; }
		.error { color:#ffb8b8; }
		.meta { font-size: 0.95rem; color:#a6aaa3; }
	</style>
</head>
<body>
	<div class="wrap">
		<p class="meta">Afterword authorization</p>
		<h1>Authorize ${input.clientName}</h1>
		<p>This app is requesting access to your Afterword account with scope <strong>${input.scope}</strong>.</p>
		<p class="meta">Redirect URI: ${input.redirectUri}</p>
		${input.error ? `<p class="error">${input.error}</p>` : ''}
		<form method="POST">
			<input type="hidden" name="client_id" value="${input.clientId}" />
			<input type="hidden" name="redirect_uri" value="${input.redirectUri}" />
			<input type="hidden" name="scope" value="${input.scope}" />
			<input type="hidden" name="state" value="${input.state}" />
			${
				input.authorized
					? '<p>You are already signed in. Approve to continue.</p>'
					: '<label for="password">Admin password</label><input id="password" name="password" type="password" autocomplete="current-password" required />'
			}
			<button type="submit">Authorize app</button>
		</form>
	</div>
</body>
</html>`;
}

export async function GET(event) {
	const clientId = String(event.url.searchParams.get('client_id') || '').trim();
	const redirectUri = String(event.url.searchParams.get('redirect_uri') || '').trim();
	const scope = String(event.url.searchParams.get('scope') || 'read write').trim() || 'read write';
	const state = String(event.url.searchParams.get('state') || '').trim();

	const app = clientId ? await getMastodonAppByClientId(event, clientId) : null;
	const errorMessage =
		!app
			? 'Unknown client'
			: !redirectUri || !redirectUriAllowed(app, redirectUri)
				? 'Redirect URI is not allowed'
				: '';

	return new Response(
		renderAuthorizePage({
			clientName: app?.name || 'Unknown app',
			redirectUri,
			clientId,
			scope,
			state,
			error: errorMessage || undefined,
			authorized: await isAuthorizedAdmin({ cookies: event.cookies, request: new Request('http://local') })
		}),
		{ headers: { 'content-type': 'text/html; charset=utf-8' } }
	);
}

export async function POST(event) {
	const form = await event.request.formData();
	const clientId = String(form.get('client_id') || '').trim();
	const redirectUri = String(form.get('redirect_uri') || '').trim();
	const scope = String(form.get('scope') || 'read write').trim() || 'read write';
	const state = String(form.get('state') || '').trim();
	const submittedPassword = String(form.get('password') || '').trim();
	const app = clientId ? await getMastodonAppByClientId(event, clientId) : null;

	if (!app || !redirectUri || !redirectUriAllowed(app, redirectUri)) {
		return new Response(
			renderAuthorizePage({
				clientName: app?.name || 'Unknown app',
				redirectUri,
				clientId,
				scope,
				state,
				error: 'Authorization request is invalid.',
				authorized: false
			}),
			{ status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
		);
	}

	const authorized = (await isAuthorizedAdmin({ cookies: event.cookies, request: new Request('http://local') }))
		|| (submittedPassword ? await authorizeAdminPassword({ cookies: event.cookies }, submittedPassword) : false);

	if (!authorized) {
		return new Response(
			renderAuthorizePage({
				clientName: app.name,
				redirectUri,
				clientId,
				scope,
				state,
				error: 'Password was incorrect.',
				authorized: false
			}),
			{ status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } }
		);
	}

	const code = await createAuthorizationCode(event, {
		appId: app.id,
		redirectUri,
		scope
	});

	const target = new URL(redirectUri);
	target.searchParams.set('code', code);
	if (state) {
		target.searchParams.set('state', state);
	}

	throw redirect(302, target.toString());
}
