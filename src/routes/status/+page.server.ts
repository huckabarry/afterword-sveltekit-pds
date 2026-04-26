import { getActivityFeed } from '$lib/server/activity-feed';

export async function load(event) {
	const parentData = await event.parent();

	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
	});

	return {
		activityFeed: await getActivityFeed(event),
		authorAvatarUrl: parentData.profile?.avatarUrl || '/assets/images/status-avatar.jpg'
	};
}
