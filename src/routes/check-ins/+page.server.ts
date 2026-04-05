import { getCheckinsSnapshot } from '$lib/server/checkins-snapshot';
import { filterPublicCheckins } from '$lib/server/checkin-visibility';
import { getSanityRouteIntro } from '$lib/server/sanity-site';

export async function load(event) {
	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
	});

	const [checkins, intro] = await Promise.all([
		getCheckinsSnapshot(event),
		getSanityRouteIntro('check-ins')
	]);

	return {
		intro: intro || {
			title: 'Check-ins',
			description: 'Places saved along the way, with notes, maps, and context.',
			paragraphs: [
				'Places I’ve saved along the way, with notes, maps, and a little context for why they mattered.'
			]
		},
		checkins: filterPublicCheckins(checkins)
	};
}
