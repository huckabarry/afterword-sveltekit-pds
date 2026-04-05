import { getCheckinsSnapshot } from '$lib/server/checkins-snapshot';
import { filterPublicCheckins } from '$lib/server/checkin-visibility';

export async function load(event) {
	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
	});

	return {
		checkins: filterPublicCheckins(await getCheckinsSnapshot(event))
	};
}
