import { json } from '@sveltejs/kit';
import { createMastodonApp } from '$lib/server/mastodon-auth';

function toString(value: FormDataEntryValue | unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

export async function POST(event) {
	const form = await event.request.formData().catch(() => null);
	const body = form
		? {
				client_name: toString(form.get('client_name')),
				redirect_uris: toString(form.get('redirect_uris')),
				scopes: toString(form.get('scopes')),
				website: toString(form.get('website'))
			}
		: await event.request.json().catch(() => ({}));

	const clientName = String(body.client_name || 'Afterword App').trim();
	const redirectUris = String(body.redirect_uris || '').trim();
	const scopes = String(body.scopes || 'read write').trim() || 'read write';
	const website = String(body.website || '').trim() || null;

	if (!redirectUris) {
		return json({ error: 'redirect_uris is required' }, { status: 422 });
	}

	const redirectList = redirectUris
		.split(/\s+/)
		.map((value) => value.trim())
		.filter(Boolean);

	const app = await createMastodonApp(event, {
		name: clientName,
		redirectUris: redirectList,
		scopes,
		website
	});

	return json({
		id: app.clientId,
		name: clientName,
		website,
		redirect_uri: redirectList[0],
		client_id: app.clientId,
		client_secret: app.clientSecret,
		vapid_key: null
	});
}
