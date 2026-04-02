import { getStatusSnapshotPage } from '$lib/server/status-snapshot';

export async function load(event) {
	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
	});

	const page = await getStatusSnapshotPage({
		platform: event.platform
	});

	return {
		statusPage: page
	};
}
