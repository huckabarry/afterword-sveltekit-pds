import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { buildMastodonStatusSource, decodeMastodonStatusId } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) {
		throw error(404, 'Unknown status');
	}

	const source = await buildMastodonStatusSource(event, objectId);
	if (!source) {
		throw error(404, 'Unknown status');
	}

	return json(source, {
		headers: {
			'cache-control': 'no-store'
		}
	});
}
