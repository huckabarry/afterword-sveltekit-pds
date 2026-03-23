import { requireDeliveryToken } from '$lib/server/activitypub-admin';
import { getStatuses } from '$lib/server/atproto';
import { deliverStatusPostToFollowers } from '$lib/server/post-delivery';

function getLimit(request: Request) {
	const raw = new URL(request.url).searchParams.get('limit');
	const parsed = Number.parseInt(String(raw || '10'), 10);

	if (!Number.isFinite(parsed) || parsed < 1) {
		return 10;
	}

	return Math.min(parsed, 50);
}

export async function POST(event) {
	requireDeliveryToken(event.request);

	const limit = getLimit(event.request);
	const statuses = (await getStatuses()).slice(0, limit);
	const deliveries = [];

	for (const post of statuses) {
		const summary = await deliverStatusPostToFollowers(event, post, {
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
				scannedStatuses: statuses.length,
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
