import { getGallerySnapshot } from '$lib/server/gallery-snapshot';
import { getBlogPosts } from '$lib/server/ghost';
import type { PageServerLoad } from './$types';

export const prerender = false;

const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);
const FIELD_NOTE_TAGS = new Set(['field-notes', 'gallery', 'photography']);

export const load: PageServerLoad = async (event) => {
	const [posts, photos] = await Promise.all([
		getBlogPosts(),
		getGallerySnapshot(event)
	]);

	const planningPosts = posts.filter((post) =>
		post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug))
	);

	const planningIds = new Set(planningPosts.map((post) => post.id));

	const fieldNotePosts = posts.filter(
		(post) =>
			post.publicTags.some((tag) => FIELD_NOTE_TAGS.has(tag.slug)) && !planningIds.has(post.id)
	);

	event.setHeaders({
		'cache-control': 'public, max-age=60, s-maxage=240, stale-while-revalidate=600'
	});

	return {
		urbanism: planningPosts.slice(0, 5).map((post) => ({
			title: post.title,
			path: post.path,
			publishedAt: post.publishedAt.toISOString()
		})),
		fieldNotes: fieldNotePosts.slice(0, 5).map((post) => ({
			title: post.title,
			path: post.path,
			publishedAt: post.publishedAt.toISOString()
		})),
		photos: photos.slice(0, 4).map((photo) => ({
			postTitle: photo.postTitle,
			postPath: photo.postPath,
			displayUrl: photo.displayUrl,
			alt: photo.alt || photo.postTitle
		}))
	};
};
