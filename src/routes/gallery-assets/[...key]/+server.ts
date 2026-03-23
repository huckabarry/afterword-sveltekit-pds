import { error } from '@sveltejs/kit';

export async function GET(event) {
	const bucket = event.platform?.env.R2_BUCKET;

	if (!bucket) {
		throw error(500, 'R2_BUCKET is not configured');
	}

	const key = event.params.key;

	if (!key) {
		throw error(404, 'Asset not found');
	}

	const object = await bucket.get(key);

	if (!object) {
		throw error(404, 'Asset not found');
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('cache-control', headers.get('cache-control') || 'public, max-age=31536000, immutable');

	return new Response(object.body, {
		headers
	});
}
