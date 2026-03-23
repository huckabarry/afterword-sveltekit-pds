import { listRecentLocalNotes } from '$lib/server/ap-notes';
import type { RequestHandler } from './$types';

function stripHtml(value: string) {
	return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function noteToItem(note: Awaited<ReturnType<typeof listRecentLocalNotes>>[number]) {
	const contentText = note.contentText.trim() || stripHtml(note.contentHtml);
	const summary = contentText.length > 180 ? `${contentText.slice(0, 177).trimEnd()}...` : contentText;

	return {
		id: note.noteId,
		url: note.objectUrl || note.noteId,
		title: note.title || summary || 'Untitled',
		content_html: note.contentHtml,
		content_text: contentText,
		summary,
		date_published: note.publishedAt,
		tags: note.category,
		authors: [
			{
				name: 'Bryan Robb',
				url: 'https://afterword.blog/'
			}
		]
	};
}

export const GET: RequestHandler = async (event) => {
	const notes = await listRecentLocalNotes(event, 50);
	const items = notes.map(noteToItem);

	return new Response(
		JSON.stringify(
			{
				version: 'https://jsonfeed.org/version/1.1',
				title: 'Afterword Posts',
				home_page_url: event.url.origin,
				feed_url: `${event.url.origin}/posts_feed`,
				description: 'Recent local posts published from Afterword.',
				authors: [
					{
						name: 'Bryan Robb',
						url: `${event.url.origin}/`
					}
				],
				items
			},
			null,
			2
		),
		{
			headers: {
				'content-type': 'application/feed+json; charset=utf-8',
				'access-control-allow-origin': '*'
			}
		}
	);
};
