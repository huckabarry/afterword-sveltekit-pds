import { error, json } from '@sveltejs/kit';
import { getStatusBySlug } from '$lib/server/atproto';
import { serializeStatusPostDetail } from '$lib/server/status-api';

export async function GET(event) {
	const post = await getStatusBySlug(event.params.slug);

	if (!post) {
		throw error(404, 'Status post not found');
	}

	return json(serializeStatusPostDetail(post), {
		headers: {
			'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
		}
	});
}
