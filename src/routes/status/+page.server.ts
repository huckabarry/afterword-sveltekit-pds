import { getStatusSnapshotPage } from '$lib/server/status-snapshot';

export async function load(event) {
	const parentData = await event.parent();

	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
	});

	const page = await getStatusSnapshotPage({
		platform: event.platform
	});

	return {
		statusPage: page,
		authorAvatarUrl: parentData.profile?.avatarUrl || '/assets/images/status-avatar.jpg'
	};
}
