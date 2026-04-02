import { getCheckinsSnapshot } from '$lib/server/checkins-snapshot';

export async function load(event) {
	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
	});

	return {
		checkins: await getCheckinsSnapshot(event)
	};
}
