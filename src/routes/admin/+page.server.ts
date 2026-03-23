import { getActivityPubOrigin } from '$lib/server/activitypub';
import { listRecentInboxReplies } from '$lib/server/ap-notes';
import { getStatuses } from '$lib/server/atproto';
import { listFollowers } from '$lib/server/followers';
import { listRecentWebmentions } from '$lib/server/webmentions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const origin = getActivityPubOrigin(event);
	const [replies, followers, webmentions, statuses] = await Promise.all([
		listRecentInboxReplies(event, origin, 8),
		listFollowers(event),
		listRecentWebmentions(event, 8),
		getStatuses()
	]);

	return {
		replies,
		followers,
		webmentions,
		mirroredStatuses: statuses.slice(0, 5).map((post) => ({
			...post,
			apObjectId: `${origin}/ap/status/${post.slug}`
		}))
	};
};
