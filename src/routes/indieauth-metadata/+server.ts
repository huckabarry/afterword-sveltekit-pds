function json(body: unknown) {
	return new Response(JSON.stringify(body, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'access-control-allow-origin': '*'
		}
	});
}

export async function GET(event) {
	const origin = event.url.origin;

	return json({
		issuer: `${origin}/`,
		authorization_endpoint: `${origin}/indieauth/authorize`,
		token_endpoint: `${origin}/indieauth/token`,
		micropub: `${origin}/micropub`,
		scopes_supported: ['create', 'update', 'delete', 'media'],
		response_types_supported: ['code'],
		code_challenge_methods_supported: ['S256', 'plain']
	});
}
