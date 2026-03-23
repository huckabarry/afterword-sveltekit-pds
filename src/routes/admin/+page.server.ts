import { getActivityPubOrigin } from '$lib/server/activitypub';
import { enrichReplies } from '$lib/server/activitypub-reply-previews';
import { listRecentInboxReplies } from '$lib/server/ap-notes';
import { getStatuses } from '$lib/server/atproto';
import { listFollowers } from '$lib/server/followers';
import { getSiteProfile } from '$lib/server/profile';
import { resolveReplyContext } from '$lib/server/admin-reply-context';
import { listRecentWebmentions } from '$lib/server/webmentions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const origin = getActivityPubOrigin(event);
	const [replies, followers, webmentions, statuses, profile] = await Promise.all([
		listRecentInboxReplies(event, origin, 8),
		listFollowers(event),
		listRecentWebmentions(event, 8),
		getStatuses(),
		getSiteProfile(event)
	]);
	const enrichedReplies = await enrichReplies(event, replies);
	const repliesWithContext = await Promise.all(
		enrichedReplies.map(async (reply) => ({
			...reply,
			replyContext: reply.inReplyToObjectId ? await resolveReplyContext(event, origin, reply.inReplyToObjectId) : null,
			threadRootContext:
				reply.threadRootObjectId && reply.threadRootObjectId !== reply.inReplyToObjectId
					? await resolveReplyContext(event, origin, reply.threadRootObjectId)
					: null,
			actorAvatarUrl:
				reply.origin === 'local'
					? profile.avatarUrl.startsWith('http')
						? profile.avatarUrl
						: `${origin}${profile.avatarUrl}`
					: reply.avatarUrl,
			actorProfileUrl: reply.origin === 'local' ? `${origin}/` : reply.profileUrl
		}))
	);

	return {
		replies: repliesWithContext,
		followers,
		webmentions,
		mirroredStatuses: statuses.slice(0, 5).map((post) => ({
			...post,
			apObjectId: `${origin}/ap/status/${post.slug}`
		}))
	};
};
