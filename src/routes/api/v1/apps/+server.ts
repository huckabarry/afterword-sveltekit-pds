import { json } from '@sveltejs/kit';
import { registerClientApp } from '$lib/server/mastodon-auth';

export async function POST(event) {
	const form = await event.request.formData();
	const clientName = String(form.get('client_name') || '').trim() || 'Afterword Client';
	const redirectUris = String(form.get('redirect_uris') || '').trim();
	const scopes = String(form.get('scopes') || 'read write').trim() || 'read write';
	const website = String(form.get('website') || '').trim() || null;

	const registered = await registerClientApp(event, {
		clientName,
		redirectUris,
		scopes,
		website
	});

	return json({
		id: String(registered.id),
		name: clientName,
		website,
		redirect_uri: redirectUris,
		client_id: registered.clientId,
		client_secret: registered.clientSecret,
		vapid_key: null
	});
}
