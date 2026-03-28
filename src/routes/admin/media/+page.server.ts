import { getPopfeedBaseItems } from '$lib/server/popfeed';
import { getPopfeedBookCoverReviewQueue } from '$lib/server/pds-popfeed-overrides';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const items = await getPopfeedBaseItems();

	return {
		reviewQueue: await getPopfeedBookCoverReviewQueue({
			items,
			limit: 24
		})
	};
};
