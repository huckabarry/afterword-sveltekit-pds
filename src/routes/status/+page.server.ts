import { getSanityRouteIntro } from '$lib/server/sanity-site';
import { getStatusSnapshotPage } from '$lib/server/status-snapshot';

export async function load(event) {
	const parentData = await event.parent();

	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
	});

	const [page, intro] = await Promise.all([
		getStatusSnapshotPage({
			platform: event.platform
		}),
		getSanityRouteIntro('status')
	]);

	return {
		intro: intro || {
			title: 'Status Updates',
			description: 'Short public notes and updates from Bryan Robb.',
			paragraphs: ['A running stream of shorter notes, links, images, and passing observations.']
		},
		statusPage: page,
		authorAvatarUrl: parentData.profile?.avatarUrl || '/assets/images/status-avatar.jpg'
	};
}
