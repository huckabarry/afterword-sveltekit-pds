import { error } from '@sveltejs/kit';

export async function GET(event) {
	const bucket = event.platform?.env?.R2_BUCKET;
	if (!bucket) throw error(404, 'Media storage not configured');

	const key = event.params.key;
	const object = await bucket.get(key);
	if (!object) throw error(404, 'Media not found');

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('cache-control', 'public, max-age=31536000, immutable');

	return new Response(object.body, { headers });
}
