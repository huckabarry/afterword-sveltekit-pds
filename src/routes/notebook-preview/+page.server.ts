import { getEarlierWebSeriesPosts } from '$lib/server/earlier-web';
import { getJournalEntries } from '$lib/server/journal';

export const prerender = false;

export async function load(event) {
	const [archivePosts, journalEntries] = await Promise.all([
		getEarlierWebSeriesPosts(event, {
			minBodyLength: 500,
			limit: 160
		}),
		getJournalEntries(80).catch(() => [])
	]);

	const posts = [
		...archivePosts.map((post) => ({
			id: post.id,
			title: post.title,
			path: post.path,
			publishedAt: post.publishedAt,
			bodyHtml: post.bodyHtml,
			showTitle: post.title.trim().length > 0,
			sourceLabel: 'Earlier Web' as const
		})),
		...journalEntries.map((entry) => ({
			id: entry.id,
			title: entry.title,
			path: entry.path,
			publishedAt: entry.publishedAt,
			bodyHtml: `${entry.introHtml}${entry.introHtml && entry.bodyHtml ? '\n' : ''}${entry.bodyHtml}`,
			showTitle: true,
			sourceLabel: 'Journal' as const,
			tags: entry.tags
		}))
	].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

	return {
		posts
	};
}
