import { json } from '@sveltejs/kit';
import { requireAccessToken } from '$lib/server/mastodon-auth';
import { getStatusBySlug } from '$lib/server/atproto';
import { createAtprotoLike } from '$lib/server/atproto-publish';
import { formatMastodonStatus, getInstanceOrigin } from '$lib/server/mastodon-api';

export async function POST(event) {
	await requireAccessToken(event);

	const post = await getStatusBySlug(event.params.id);
	if (!post) {
		return json({ error: 'Status not found' }, { status: 404 });
	}

	if (!post.uri || !post.cid) {
		return json({ error: 'Status is missing ATProto subject data' }, { status: 422 });
	}

	await createAtprotoLike({
		uri: post.uri,
		cid: post.cid
	});

	return json(
		formatMastodonStatus(getInstanceOrigin(event.url), {
			uri: post.uri,
			id: post.slug,
			text: post.text,
			createdAt: post.date.toISOString(),
			favourited: true,
			favouritesCount: post.likeCount + 1
		})
	);
}
