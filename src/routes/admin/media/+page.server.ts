import { getMusicCacheStatus } from '$lib/server/music-cache-status';
import { getMusicArchiveDigest } from '$lib/server/music';
import { getMusicSnapshotFromR2 } from '$lib/server/music-r2';
import { getPopfeedBaseItems } from '$lib/server/popfeed';
import { getPopfeedBookCoverReviewQueue } from '$lib/server/pds-popfeed-overrides';
import { requireAdminSession } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	const items = await getPopfeedBaseItems();
	const [musicStatus, musicSnapshot] = await Promise.all([
		getMusicCacheStatus(event),
		getMusicSnapshotFromR2(event)
	]);
	const currentArchiveDigest = getMusicArchiveDigest();

	return {
		musicCache: {
			...musicStatus,
			currentArchiveDigest,
			snapshotGeneratedAt: musicSnapshot?.generatedAt || null,
			snapshotArchiveDigest: musicSnapshot?.archiveDigest || null,
			snapshotTrackCount: musicSnapshot?.tracks.length || 0,
			snapshotAlbumCount: musicSnapshot?.albums.length || 0,
			snapshotIsCurrent:
				Boolean(musicSnapshot?.archiveDigest) && musicSnapshot?.archiveDigest === currentArchiveDigest
		},
		reviewQueue: await getPopfeedBookCoverReviewQueue({
			items,
			limit: 24
		})
	};
};
