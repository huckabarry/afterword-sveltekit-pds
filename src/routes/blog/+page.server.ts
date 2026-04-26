import { getBlogPosts } from '$lib/server/ghost';
import { toTemplatePosts } from '$lib/server/template-posts';
import type { PageServerLoad } from './$types';

export const prerender = false;
const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);

export const load: PageServerLoad = async () => {
	return {
		posts: toTemplatePosts(
			(await getBlogPosts()).filter((post) =>
				post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug))
			)
		)
	};
};
