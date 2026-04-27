export type SimplePost = {
	slug: string;
	title: string;
	date: string;
	excerpt: string;
	body: string[];
};

export const simpleSite = {
	title: 'Afterword',
	description: 'A tiny, very fast blog.'
};

export const simplePosts: SimplePost[] = [
	{
		slug: 'the-future-of-portland-transit-hangs-in-the-balance',
		title: 'The Future of Portland Transit Hangs in the Balance',
		date: '2025-05-06',
		excerpt: 'A quick post for testing the feel of a minimal blog.',
		body: [
			'Portland transit has a way of turning every budget story into a much larger civic argument.',
			'This is just local test copy, but it is enough to make the page feel like a real post instead of a demo.'
		]
	},
	{
		slug: 'the-myth-of-the-walkable-corner-store',
		title: 'The Myth of the Walkable Corner Store',
		date: '2025-01-29',
		excerpt: 'Some ideas persist because they describe a nice feeling.',
		body: [
			'Some urbanist ideas are more emotionally satisfying than structurally true.',
			'This one hangs around because it points toward a real desire, even when the built pattern beneath it is less convincing.'
		]
	},
	{
		slug: 'rereading-jane-jacobs',
		title: 'Rereading Jane Jacobs',
		date: '2024-11-28',
		excerpt: 'A familiar book, a different reader.',
		body: [
			'Returning to a book ten years later is one of the few dependable ways to measure changes in your own thinking.',
			'Sometimes the book has changed too, or at least the version of it you are able to hear.'
		]
	}
];

export function getSimplePost(slug: string) {
	return simplePosts.find((post) => post.slug === slug);
}

export function isSimpleSiteHost(hostname: string) {
	return hostname === 'svelte.afterword.blog';
}
