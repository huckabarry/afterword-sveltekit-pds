import { error } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPosts, type BlogPost } from '$lib/server/ghost';
import { listDirectRepliesToObject } from '$lib/server/ap-notes';
import { listVerifiedWebmentionsForTarget } from '$lib/server/webmentions';
import { getInteractionSummary } from '$lib/server/interactions';
import { getNoteObjectId } from '$lib/server/activitypub';

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function fetchActorPreview(actorId: string) {
	try {
		const response = await fetch(actorId, {
			headers: {
				Accept:
					'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json'
			}
		});

		if (!response.ok) return { avatarUrl: null, profileUrl: actorId };

		const actor = (await response.json()) as Record<string, unknown>;
		const icon =
			actor.icon && typeof actor.icon === 'object'
				? (actor.icon as Record<string, unknown>)
				: null;

		return {
			avatarUrl: getString(icon?.url) || null,
			profileUrl: getString(actor.url) || actorId
		};
	} catch {
		return {
			avatarUrl: null,
			profileUrl: actorId
		};
	}
}

export async function load(event) {
	const { params } = event;
	const [post, posts] = await Promise.all([getBlogPostBySlug(params.slug), getBlogPosts()]);

	if (!post) {
		throw error(404, 'Blog post not found');
	}

	const currentIndex = posts.findIndex((entry: BlogPost) => entry.slug === params.slug);
	const objectId = getNoteObjectId(event.url.origin, post.slug);
	const [webmentions, fediverse, apReplies] = await Promise.all([
		listVerifiedWebmentionsForTarget(event, `${event.url.origin}${post.path}`),
		getInteractionSummary(event, objectId),
		listDirectRepliesToObject(event, objectId)
	]);
	const replies = await Promise.all(
		apReplies
			.filter((reply) => reply.origin === 'remote')
			.map(async (reply) => {
				const actorPreview = await fetchActorPreview(reply.actorId);
				return {
					...reply,
					avatarUrl: actorPreview.avatarUrl,
					profileUrl: actorPreview.profileUrl
				};
			})
	);

	return {
		post,
		previousPost: currentIndex >= 0 ? posts[currentIndex + 1] || null : null,
		nextPost: currentIndex >= 0 ? posts[currentIndex - 1] || null : null,
		webmentions,
		fediverse,
		replies
	};
}
