import { getActivityPubOrigin } from '$lib/server/activitypub';
import { listLocalNotes } from '$lib/server/ap-notes';
import { getStatuses } from '$lib/server/atproto';
import { getSiteProfile } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const origin = getActivityPubOrigin(event);
	const profile = await getSiteProfile(event);
	const mirroredStatuses = (await getStatuses()).slice(0, 30).map((post) => ({
		...post,
		apObjectId: `${origin}/ap/status/${post.slug}`
	}));

	return {
		posts: (await listLocalNotes(event, 200)).map((post) => ({
			...post,
			actorName: profile.displayName,
			actorHandle: `@${new URL(origin).hostname}`,
			actorAvatarUrl: profile.avatarUrl.startsWith('http')
				? profile.avatarUrl
				: `${origin}${profile.avatarUrl}`
		})),
		mirroredStatuses,
		deleted: event.url.searchParams.get('deleted') === '1',
		saved: event.url.searchParams.get('saved') === '1'
	};
};
