import { getCheckins, getStatusesLite } from '$lib/server/atproto';
import { getBlogPosts, getPublicTags } from '$lib/server/ghost';

const STATIC_PATHS = [
	'/',
	'/about',
	'/blog',
	'/books',
	'/check-ins',
	'/colophon',
	'/contact',
	'/field-notes',
	'/hello',
	'/listening',
	'/map-styles',
	'/media',
	'/movies',
	'/music',
	'/now',
	'/photos',
	'/planning',
	'/share',
	'/shows',
	'/status',
	'/tags'
];

function escapeXml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function normalizePath(path: string) {
	if (!path) return '/';
	return path.startsWith('/') ? path : `/${path}`;
}

function toUrlEntry(origin: string, path: string, lastmod?: Date | null) {
	const parts = [
		`  <url>`,
		`    <loc>${escapeXml(new URL(normalizePath(path), origin).toString())}</loc>`
	];

	if (lastmod && !Number.isNaN(lastmod.getTime())) {
		parts.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`);
	}

	parts.push('  </url>');
	return parts.join('\n');
}

export async function GET({ url }) {
	const origin = url.origin;
	const [posts, statuses, checkins, tags] = await Promise.all([
		getBlogPosts(),
		getStatusesLite(),
		getCheckins(),
		getPublicTags()
	]);

	const entries = [
		...STATIC_PATHS.map((path) => toUrlEntry(origin, path)),
		...posts.map((post) => toUrlEntry(origin, post.path, post.updatedAt || post.publishedAt)),
		...statuses.map((status) => toUrlEntry(origin, `/status/${status.slug}`, status.date)),
		...checkins.map((checkin) =>
			toUrlEntry(origin, normalizePath(checkin.canonicalPath), checkin.visitedAt)
		),
		...tags.map((tag) => toUrlEntry(origin, tag.path))
	];

	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries,
		'</urlset>'
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=0, s-maxage=3600'
		}
	});
}
