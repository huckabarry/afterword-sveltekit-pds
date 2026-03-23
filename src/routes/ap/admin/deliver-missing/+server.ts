import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { deliverBlogPostToFollowers } from '$lib/server/post-delivery';
import { getBlogPosts } from '$lib/server/ghost';

function getLimit(request: Request) {
	const raw = new URL(request.url).searchParams.get('limit');
	const parsed = Number.parseInt(String(raw || '5'), 10);

	if (!Number.isFinite(parsed) || parsed < 1) {
		return 5;
	}

	return Math.min(parsed, 25);
}

export async function POST(event) {
	requireDeliveryToken(event.request);

	const limit = getLimit(event.request);
	const posts = (await getBlogPosts())
		.slice(0, limit)
		.reverse();
	const deliveries = [];

	for (const post of posts) {
		const summary = await deliverBlogPostToFollowers(event, post, {
			skipDelivered: true
		});

		deliveries.push({
			post: summary.post,
			followerCount: summary.followerCount,
			delivered: summary.results.filter((result) => result.status === 'delivered').length,
			alreadyDelivered: summary.results.filter((result) => result.status === 'already-delivered').length,
			failed: summary.results.filter((result) => result.status === 'failed').length,
			skipped: summary.results.filter((result) => result.status === 'skipped').length,
			results: summary.results
		});
	}

	return new Response(
		JSON.stringify(
			{
				scannedPosts: posts.length,
				deliveries
			},
			null,
			2
		),
		{
			headers: {
				'content-type': 'application/json; charset=utf-8'
			}
		}
	);
}
