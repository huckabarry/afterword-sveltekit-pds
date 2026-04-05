import { fail } from '@sveltejs/kit';
import { getBlogPostBySlug, getBlogPostsByAnyTag } from '$lib/server/ghost';
import { getSiteProfile } from '$lib/server/profile';
import {
	cleanupDuplicateAfterwordPublications,
	ensurePublicationRecord,
	getStandardSitePublicationAtUri,
	migrateGhostBackedStandardSiteDocuments,
	syncGhostPostToStandardSite
} from '$lib/server/standard-site';
import { requireAdminSession } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	const [publicationAtUri, posts] = await Promise.all([
		getStandardSitePublicationAtUri(),
		getBlogPostsByAnyTag(['field-notes', 'urbanism'])
	]);

	const postStatuses = posts
		.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
		.map((post) => ({
			slug: post.slug,
			title: post.title,
			path: post.path,
			publishedAt: post.publishedAt.toISOString(),
			documentAtUri: null,
			matchingTags: post.publicTags
				.filter((tag) => tag.slug === 'field-notes' || tag.slug === 'urbanism')
				.map((tag) => tag.label)
		}));

	return {
		publicationAtUri,
		posts: postStatuses
	};
};

export const actions: Actions = {
	syncPublication: async (event) => {
		await requireAdminSession(event);

		try {
			const profile = await getSiteProfile(event);
			const result = await ensurePublicationRecord(event, profile);
			const cleanup = await cleanupDuplicateAfterwordPublications(event);
			return {
				success: true,
				message: `Publication record synced.${cleanup.deletedCount ? ` Removed ${cleanup.deletedCount} duplicate Afterword publication record${cleanup.deletedCount === 1 ? '' : 's'}.` : ''}`,
				uri: result.uri
			};
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to sync publication record.'
			});
		}
	},
	syncPost: async (event) => {
		await requireAdminSession(event);

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
	},
	migrateGhostBackedPosts: async (event) => {
		await requireAdminSession(event);

		try {
			const profile = await getSiteProfile(event);
			await ensurePublicationRecord(event, profile);
			const cleanup = await cleanupDuplicateAfterwordPublications(event);
			const migration = await migrateGhostBackedStandardSiteDocuments(event, profile);
			return {
				success: true,
				message: `Migrated ${migration.count} Ghost-backed standard.site documents to your Afterword publication.${cleanup.deletedCount ? ` Removed ${cleanup.deletedCount} duplicate Afterword publication record${cleanup.deletedCount === 1 ? '' : 's'}.` : ''}`
			};
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Unable to migrate Ghost-backed documents.'
			});
		}
	}
};
