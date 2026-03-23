import { createAuthorizationCode, redirectWithCode, requireMicropubPassword, validateClientId, validateRedirectUri } from '$lib/server/indieauth';

function isRedirectError(error: unknown): error is { status: number; location: string } {
	return Boolean(
		error &&
			typeof error === 'object' &&
			'status' in error &&
			'location' in error &&
			typeof (error as { status: unknown }).status === 'number'
	);
}

function pageHtml(input: {
	clientId: string;
	redirectUri: string;
	state: string;
	scope: string;
	codeChallenge: string;
	codeChallengeMethod: string;
	error?: string;
}) {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Micropub</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#1e2021; color:#ebebeb; font-family:system-ui,sans-serif; }
    main { width:min(28rem, calc(100vw - 2rem)); padding:1.4rem; border:1px solid rgba(235,235,235,.16); border-radius:1rem; background:#2c2f30; }
    h1 { margin:0 0 .4rem; font-size:1.2rem; }
    p { color:#b0b3ae; line-height:1.5; }
    label { display:block; margin:.9rem 0 .35rem; font-size:.88rem; color:#b0b3ae; }
    input { width:100%; padding:.8rem .9rem; border-radius:.7rem; border:1px solid rgba(235,235,235,.18); background:#1e2021; color:#fff; }
    button { margin-top:1rem; padding:.72rem 1rem; border:0; border-radius:999px; background:#f2f7b7; color:#111; font-weight:700; cursor:pointer; }
    code { color:#fff; }
    .error { color:#ffb0a8; }
  </style>
</head>
<body>
  <main>
    <h1>Authorize Micropub</h1>
    <p>Allow <code>${input.clientId}</code> to post to Afterword.</p>
    ${input.error ? `<p class="error">${input.error}</p>` : ''}
    <form method="POST">
      <input type="hidden" name="client_id" value="${input.clientId}">
      <input type="hidden" name="redirect_uri" value="${input.redirectUri}">
      <input type="hidden" name="state" value="${input.state}">
      <input type="hidden" name="scope" value="${input.scope}">
      <input type="hidden" name="code_challenge" value="${input.codeChallenge}">
      <input type="hidden" name="code_challenge_method" value="${input.codeChallengeMethod}">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Authorize</button>
    </form>
  </main>
</body>
</html>`;
}

function getString(form: FormData, key: string) {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

export async function GET(event) {
	const clientId = validateClientId(event.url.searchParams.get('client_id') || '');
	const redirectUri = validateRedirectUri(event.url.searchParams.get('redirect_uri') || '');
	const state = event.url.searchParams.get('state') || '';
	const scope = event.url.searchParams.get('scope') || 'create';
	const codeChallenge = event.url.searchParams.get('code_challenge') || '';
	const codeChallengeMethod = event.url.searchParams.get('code_challenge_method') || 'plain';

	return new Response(
		pageHtml({
			clientId,
			redirectUri,
			state,
			scope,
			codeChallenge,
			codeChallengeMethod
		}),
		{
			headers: {
				'content-type': 'text/html; charset=utf-8'
			}
		}
	);
}

export async function POST(event) {
	const form = await event.request.formData();
	const clientId = validateClientId(getString(form, 'client_id'));
	const redirectUri = validateRedirectUri(getString(form, 'redirect_uri'));
	const state = getString(form, 'state');
	const scope = getString(form, 'scope') || 'create';
	const codeChallenge = getString(form, 'code_challenge') || null;
	const codeChallengeMethod = getString(form, 'code_challenge_method') || 'plain';
	const password = getString(form, 'password');

	try {
		requireMicropubPassword(password);
		const code = await createAuthorizationCode(event, {
			clientId,
			redirectUri,
			scope,
			codeChallenge,
			codeChallengeMethod
		});
		redirectWithCode({
			redirectUri,
			code,
			state,
			origin: event.url.origin
		});
	} catch (err) {
		if (isRedirectError(err)) {
			throw err;
		}

		return new Response(
			pageHtml({
				clientId,
				redirectUri,
				state,
				scope,
				codeChallenge: codeChallenge || '',
				codeChallengeMethod,
				error: err instanceof Error ? err.message : 'Authorization failed'
			}),
			{
				status: 401,
				headers: {
					'content-type': 'text/html; charset=utf-8'
				}
			}
		);
	}
}
