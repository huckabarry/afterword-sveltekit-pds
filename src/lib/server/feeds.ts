import type { RequestEvent } from '@sveltejs/kit';
import { getStatusPage } from '$lib/server/atproto';
import {
	EARLIER_WEB_STREAM_PAGE_SIZE,
	getEarlierWebStreamHydratedPage
} from '$lib/server/earlier-web';
import { getBlogPosts, stripImagesFromHtml, type BlogPost } from '$lib/server/ghost';

const SITE_WRITING_TAGS = new Set([
	'field-notes',
	'gallery',
	'photography',
	'urbanism',
	'housing',
	'transportation',
	'public-finance'
]);
const PLANNING_TAGS = new Set(['urbanism', 'housing', 'transportation', 'public-finance']);

export type FeedEntry = {
	id: string;
	url: string;
	title: string;
	summary: string;
	contentHtml: string;
	datePublished: Date;
	image?: string | null;
};

type FeedDocument = {
	version: string;
	title: string;
	description: string;
	home_page_url: string;
	feed_url: string;
	items: Array<{
		id: string;
		url: string;
		title: string;
		summary: string;
		content_html: string;
		date_published: string;
		image?: string | null;
	}>;
};

function escapeXml(value: string) {
	return String(value || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function normalizeDescription(value: string) {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(origin: string, value: string) {
	return new URL(value, origin).toString();
}

function toRssItem(entry: FeedEntry) {
	return [
		'    <item>',
		`      <title>${escapeXml(entry.title)}</title>`,
		`      <link>${escapeXml(entry.url)}</link>`,
		`      <guid>${escapeXml(entry.id || entry.url)}</guid>`,
		`      <pubDate>${entry.datePublished.toUTCString()}</pubDate>`,
		`      <description><![CDATA[${entry.contentHtml || `<p>${escapeXml(entry.summary)}</p>`}]]></description>`,
		'    </item>'
	].join('\n');
}

export function createRssFeed({
	title,
	description,
	homePageUrl,
	feedUrl,
	items
}: {
	title: string;
	description: string;
	homePageUrl: string;
	feedUrl: string;
	items: FeedEntry[];
}) {
	const channel = [
		'<rss version="2.0">',
		'  <channel>',
		`    <title>${escapeXml(title)}</title>`,
		`    <link>${escapeXml(homePageUrl)}</link>`,
		`    <description>${escapeXml(description)}</description>`,
		`    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
		...items.map(toRssItem),
		'  </channel>',
		'</rss>'
	];

	return channel.join('\n');
}

export function createJsonFeed({
	title,
	description,
	homePageUrl,
	feedUrl,
	items
}: {
	title: string;
	description: string;
	homePageUrl: string;
	feedUrl: string;
	items: FeedEntry[];
}): FeedDocument {
	return {
		version: 'https://jsonfeed.org/version/1.1',
		title,
		description,
		home_page_url: homePageUrl,
		feed_url: feedUrl,
		items: items.map((item) => ({
			id: item.id,
			url: item.url,
			title: item.title,
			summary: item.summary,
			content_html: item.contentHtml,
			date_published: item.datePublished.toISOString(),
			...(item.image ? { image: item.image } : {})
		}))
	};
}

function toBlogFeedEntries(posts: BlogPost[], origin: string) {
	return posts.map((post) => ({
		id: post.id,
		url: toAbsoluteUrl(origin, post.path),
		title: post.title,
		summary: normalizeDescription(post.excerpt),
		contentHtml: stripImagesFromHtml(post.html) || `<p>${escapeXml(post.excerpt)}</p>`,
		datePublished: post.publishedAt,
		image: post.coverImage
	}));
}

export async function getSiteWritingFeedEntries(origin: string) {
	const posts = await getBlogPosts();
	return toBlogFeedEntries(
		posts.filter((post) => post.publicTags.some((tag) => SITE_WRITING_TAGS.has(tag.slug))),
		origin
	);
}

export async function getPlanningFeedEntries(origin: string) {
	const posts = await getBlogPosts();
	return toBlogFeedEntries(
		posts.filter((post) => post.publicTags.some((tag) => PLANNING_TAGS.has(tag.slug))),
		origin
	);
}

export async function getStatusFeedEntries(origin: string) {
	const page = await getStatusPage(undefined, {
		includeThreadContext: true,
		limit: 20
	});

	return page.statuses.map((status) => ({
		id: status.uri || status.id,
		url: toAbsoluteUrl(origin, `/status/${status.slug}`),
		title: normalizeDescription(status.text).slice(0, 80) || 'Status update',
		summary: normalizeDescription(status.text),
		contentHtml: status.html || `<p>${escapeXml(status.text)}</p>`,
		datePublished: status.date,
		image: status.images[0]?.fullsize || null
	}));
}

export async function getEarlierWebFeedEntries(event: RequestEvent) {
	const page = await getEarlierWebStreamHydratedPage(event, {
		cursor: null,
		limit: EARLIER_WEB_STREAM_PAGE_SIZE
	});

	return page.posts.map((post) => ({
		id: post.id,
		url: toAbsoluteUrl(event.url.origin, post.path),
		title: post.title || normalizeDescription(post.excerpt).slice(0, 80) || 'Archive post',
		summary: normalizeDescription(post.excerpt),
		contentHtml: post.bodyHtml || `<p>${escapeXml(post.excerpt)}</p>`,
		datePublished: new Date(post.publishedAt),
		image: post.coverImage
	}));
}
