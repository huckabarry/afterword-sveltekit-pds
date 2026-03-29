import { getStatusPage, STATUS_PAGE_SIZE } from '$lib/server/atproto';

export async function load() {
	const page = await getStatusPage(undefined, {
		includeThreadContext: true,
		limit: STATUS_PAGE_SIZE
	});

	return {
		statusPage: page
	};
}
