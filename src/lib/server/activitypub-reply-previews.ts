import { getActivityPubHandle } from '$lib/server/activitypub';
import { stripHtmlToText } from '$lib/server/activitypub-replies';
import { getSiteProfile } from '$lib/server/profile';
import type { ApNoteRecord } from '$lib/server/ap-notes';

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function fetchActorPreview(actorId: string) {
	try {
		const response = await fetch(actorId, {
			headers: {
				Accept:
					'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json'
			}
		});

		if (!response.ok) {
			return { avatarUrl: null, profileUrl: actorId };
		}

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

export async function enrichReplies(
	event: { platform: App.Platform | undefined; url: URL },
	replies: ApNoteRecord[]
) {
	const profile = await getSiteProfile(event);

	return Promise.all(
		replies.map(async (reply) => {
			if (reply.origin === 'local') {
			return {
				...reply,
				actorName: reply.actorName || profile.displayName,
				actorHandle: reply.actorHandle || getActivityPubHandle(event.url.origin),
				contentText: reply.contentText || stripHtmlToText(reply.contentHtml),
				avatarUrl: profile.avatarUrl.startsWith('http')
					? profile.avatarUrl
					: `${event.url.origin}${profile.avatarUrl}`,
				profileUrl: `${event.url.origin}/`
			};
			}

			const actorPreview = await fetchActorPreview(reply.actorId);

			return {
				...reply,
				contentText: reply.contentText || stripHtmlToText(reply.contentHtml),
				avatarUrl: actorPreview.avatarUrl,
				profileUrl: actorPreview.profileUrl
			};
		})
	);
}
