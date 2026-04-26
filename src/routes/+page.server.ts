import { getRecentBlogPosts } from '$lib/server/ghost';
import { getSiteProfile } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [profile, recentPosts] = await Promise.all([
		getSiteProfile(event),
		getRecentBlogPosts(5)
	]);

	return {
		profile,
		posts: recentPosts.map((post) => ({
			title: post.title,
			href: post.path,
			description: post.excerpt,
			publishedAt: post.publishedAt
		}))
	};
};
