import { getStatuses } from '$lib/server/atproto';
import { getBlogPosts } from '$lib/server/ghost';

const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);
const FIELD_NOTE_TAGS = new Set(['field-notes', 'gallery', 'photography']);

export async function load() {
	const [statuses, blogPosts] = await Promise.all([getStatuses(), getBlogPosts()]);
	const topLevelStatuses = statuses.filter((post) => !post.isReply);
	const planningPosts = blogPosts.filter((post) =>
		post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug))
	);
	const fieldNotesPosts = blogPosts.filter(
		(post) =>
			post.publicTags.some((tag) => FIELD_NOTE_TAGS.has(tag.slug)) &&
			!planningPosts.some((planningPost) => planningPost.id === post.id)
	);

	return {
		statuses: topLevelStatuses.slice(0, 8),
		planningPosts: planningPosts.slice(0, 3),
		fieldNotesPosts: fieldNotesPosts.slice(0, 3)
	};
}
