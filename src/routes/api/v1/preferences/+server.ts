import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	return json({
		'post_content_type': 'text/plain',
		'posting:default:visibility': 'public',
		'posting:default:sensitive': false,
		'posting:default:language': 'en',
		'reading:expand:media': 'default',
		'reading:expand:spoilers': false
	});
}
