import { activityJson, getActivityPubOrigin, getActorId, getOutboxPage } from '$lib/server/activitypub';

const PAGE_SIZE = 10;

export async function GET(event) {
	const origin = getActivityPubOrigin(event);
	const actorId = getActorId(origin);
	const requestedPage = Number.parseInt(event.url.searchParams.get('page') || '1', 10);
	const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const { totalItems, totalPages, items } = await getOutboxPage(origin, page, PAGE_SIZE);
	const outboxId = `${origin}/ap/outbox`;

	if (!event.url.searchParams.has('page')) {
		return activityJson({
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: outboxId,
			type: 'OrderedCollection',
			totalItems,
			first: `${outboxId}?page=1`,
			last: `${outboxId}?page=${totalPages}`
		});
	}

	return activityJson({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${outboxId}?page=${page}`,
		type: 'OrderedCollectionPage',
		partOf: outboxId,
		next: page < totalPages ? `${outboxId}?page=${page + 1}` : undefined,
		prev: page > 1 ? `${outboxId}?page=${page - 1}` : undefined,
		orderedItems: items,
		totalItems,
		attributedTo: actorId
	});
}

