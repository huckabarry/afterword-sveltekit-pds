import { getGalleryManifestSummary } from '$lib/server/photo-manifest';
import {
	DEFAULT_MOVE_TARGET_ACTOR_URL,
	DEFAULT_MOVE_TARGET_HANDLE,
	getSiteProfile
} from '$lib/server/profile';
import { countWebmentions } from '$lib/server/webmentions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [profile, photoSummary, webmentionCount] = await Promise.all([
		getSiteProfile(event),
		getGalleryManifestSummary(event),
		countWebmentions(event)
	]);

	return {
		profile: {
			displayName: profile.displayName
		},
		stats: {
			totalPhotos: photoSummary.totalPhotos,
			syncedPhotos: photoSummary.syncedToR2,
			webmentionCount
		},
		activityPubMove: {
			oldActorUrl: `${event.url.origin}/ap/actor`,
			targetHandle: DEFAULT_MOVE_TARGET_HANDLE,
			targetActorUrl: DEFAULT_MOVE_TARGET_ACTOR_URL
		}
	};
};
