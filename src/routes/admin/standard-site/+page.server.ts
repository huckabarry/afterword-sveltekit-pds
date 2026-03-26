import { fail } from '@sveltejs/kit';
import { getBlogPostBySlug, getRecentBlogPosts } from '$lib/server/ghost';
import { getSiteProfile } from '$lib/server/profile';
import {
	ensurePublicationRecord,
	getStandardSitePublicationAtUri,
	syncGhostPostToStandardSite
} from '$lib/server/standard-site';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [publicationAtUri, posts] = await Promise.all([
		getStandardSitePublicationAtUri(),
		getRecentBlogPosts(8)
	]);

	const postStatuses = posts.slice(0, 8).map((post) => ({
		slug: post.slug,
		title: post.title,
		path: post.path,
		publishedAt: post.publishedAt.toISOString(),
		documentAtUri: null
	}));

	return {
		publicationAtUri,
		posts: postStatuses
	};
};

export const actions: Actions = {
	syncPublication: async (event) => {
		try {
			const profile = await getSiteProfile(event);
			const result = await ensurePublicationRecord(event, profile);
			return {
				success: true,
				message: 'Publication record synced.',
				uri: result.uri
			};
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to sync publication record.'
			});
		}
	},
	syncPost: async (event) => {
		const form = await event.request.formData();
		const slug = String(form.get('slug') || '').trim();

		if (!slug) {
			return fail(400, {
				error: 'A Ghost post slug is required.'
			});
		}

		try {
			const [profile, post] = await Promise.all([getSiteProfile(event), getBlogPostBySlug(slug)]);

			if (!post) {
				return fail(404, {
					error: 'Ghost post not found.',
					slug
				});
			}

			const result = await syncGhostPostToStandardSite(event, post, profile);
			return {
				success: true,
				message: `Synced "${post.title}" to Standard Site.`,
				slug,
				uri: result.uri
			};
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to sync Ghost post.',
				slug
			});
		}
	}
};
