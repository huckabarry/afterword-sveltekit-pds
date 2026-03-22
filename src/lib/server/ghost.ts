import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_GHOST_URL = 'https://lowvelocity.org';
const INCLUDED_TAGS = new Set([
	'field-notes',
	'gallery',
	'hash-gallery',
	'photography',
	'urbanism',
	'housing',
	'transportation',
	'public-finance',
	'book-reviews',
	'hash-field-notes',
	'hash-waypoints',
	'hash-section-blog'
]);
const EXCLUDED_TAGS = new Set(['status', 'afterword', 'now', 'listening', 'books']);

export type BlogPost = {
	id: string;
	title: string;
	excerpt: string;
	html: string;
	sourceUrl: string;
	path: string;
	slug: string;
	publishedAt: Date;
	updatedAt: Date;
	coverImage: string | null;
	tags: string[];
	primaryTag: string | null;
};

export type PhotoItem = {
	id: string;
	postId: string;
	postTitle: string;
	postPath: string;
	postSourceUrl: string;
	postPublishedAt: Date;
	imageUrl: string;
	alt: string;
	index: number;
};

function getGhostUrl() {
	return String(process.env.GHOST_URL || process.env.GHOST_ADMIN_URL || DEFAULT_GHOST_URL)
		.trim()
		.replace(/\/+$/, '')
		.replace(/\/ghost$/i, '');
}

function slugify(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/['".,!?()[\]{}:;]+/g, '')
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'post'
	);
}

function stripHtml(value: string) {
	return String(value || '')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function absolutizeHtml(html: string, siteUrl: string) {
	return String(html || '')
		.replace(/<link\b[^>]*rel=["']preload["'][^>]*>/gi, '')
		.replace(/\b(href|src)=("|')([^"'#][^"']*|\/[^"']*)\2/gi, (match, attr, quote, url) => {
			return `${attr}=${quote}${new URL(url, siteUrl).toString()}${quote}`;
		})
		.trim();
}

function extractCoverImage(post: Record<string, any>) {
	const featureImage = String(post.feature_image || '').trim();

	if (featureImage) {
		return featureImage;
	}

	const html = String(post.html || '');
	return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null;
}

function normalizeSourceUrl(value: string) {
	try {
		const url = new URL(String(value || ''));
		return `${url.origin}${url.pathname.replace(/\/+$/, '') || '/'}`;
	} catch {
		return '';
	}
}

function rewriteInternalLinks(html: string, sourceMap: Map<string, string>, siteUrl: string) {
	return String(html || '').replace(/\bhref=(["'])([^"'#]+)\1/gi, (match, quote, href) => {
		let absolute: URL;

		try {
			absolute = new URL(href, siteUrl);
		} catch {
			return match;
		}

		const normalized = normalizeSourceUrl(absolute.toString());
		const localPath = sourceMap.get(normalized);

		if (!localPath) {
			return match;
		}

		return `href=${quote}${localPath}${quote}`;
	});
}

function normalizePost(post: Record<string, any>, siteUrl: string): BlogPost {
	const title = String(post.title || '').trim() || 'Untitled';
	const slug = String(post.slug || '').trim() || slugify(title);
	const excerpt = stripHtml(post.excerpt || post.custom_excerpt || post.html || '');
	const html = absolutizeHtml(post.html || '', siteUrl);
	const sourceUrl = String(post.url || '').trim() || `${siteUrl}/${slug}/`;
	const publishedAt = new Date(post.published_at || post.updated_at || Date.now());
	const updatedAt = new Date(post.updated_at || post.published_at || Date.now());

	return {
		id: String(post.id || slug),
		title,
		excerpt,
		html,
		sourceUrl,
		path: `/blog/${slug}`,
		slug,
		publishedAt,
		updatedAt,
		coverImage: extractCoverImage(post),
		tags: Array.isArray(post.tags)
			? post.tags.map((tag: Record<string, any>) => String(tag.slug || '').trim()).filter(Boolean)
			: [],
		primaryTag: (post.primary_tag && String(post.primary_tag.slug || '').trim()) || null
	};
}

function shouldIncludeGalleryPost(post: BlogPost) {
	const tags = new Set((post.tags || []).filter(Boolean));
	return tags.has('gallery') || tags.has('hash-gallery') || tags.has('photography');
}

function extractPhotoItems(post: BlogPost): PhotoItem[] {
	const imagePattern = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>|<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>|<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
	const seen = new Set<string>();
	const items: PhotoItem[] = [];
	let match: RegExpExecArray | null = null;
	let index = 0;

	while ((match = imagePattern.exec(post.html))) {
		const imageUrl = match[1] || match[4] || match[5] || '';
		const alt = match[2] || match[3] || post.title;

		if (!imageUrl || seen.has(imageUrl)) {
			continue;
		}

		seen.add(imageUrl);
		items.push({
			id: `${post.id}:${index}`,
			postId: post.id,
			postTitle: post.title,
			postPath: post.path,
			postSourceUrl: post.sourceUrl,
			postPublishedAt: post.publishedAt,
			imageUrl,
			alt,
			index
		});
		index += 1;
	}

	if (post.coverImage && !seen.has(post.coverImage)) {
		items.unshift({
			id: `${post.id}:cover`,
			postId: post.id,
			postTitle: post.title,
			postPath: post.path,
			postSourceUrl: post.sourceUrl,
			postPublishedAt: post.publishedAt,
			imageUrl: post.coverImage,
			alt: post.title,
			index: -1
		});
	}

	return items;
}

function shouldIncludePost(post: BlogPost) {
	const tags = new Set((post.tags || []).filter(Boolean));

	if ([...tags].some((tag) => EXCLUDED_TAGS.has(tag))) {
		return false;
	}

	return [...tags].some((tag) => INCLUDED_TAGS.has(tag));
}

function resolveCachePath() {
	const localCache = path.join(process.cwd(), 'data', 'ghost-posts.json');

	if (fs.existsSync(localCache)) {
		return localCache;
	}

	return null;
}

function loadCachedPosts() {
	const cachePath = resolveCachePath();

	if (!cachePath) {
		return [] as Record<string, unknown>[];
	}

	try {
		const data = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as { posts?: unknown };
		return Array.isArray(data.posts) ? (data.posts as Record<string, unknown>[]) : [];
	} catch {
		return [] as Record<string, unknown>[];
	}
}

export async function getBlogPosts(): Promise<BlogPost[]> {
	const siteUrl = getGhostUrl();
	const rawPosts = loadCachedPosts();

	const posts = rawPosts
		.map((post: Record<string, unknown>) => normalizePost(post, siteUrl))
		.filter((post: BlogPost) => post.title && post.excerpt && post.html)
		.filter(shouldIncludePost)
		.sort((a: BlogPost, b: BlogPost) => b.publishedAt.getTime() - a.publishedAt.getTime());

	const sourceMap = new Map<string, string>(
		posts.map((post: BlogPost) => [normalizeSourceUrl(post.sourceUrl), post.path])
	);

	return posts.map((post: BlogPost) => ({
		...post,
		html: rewriteInternalLinks(post.html, sourceMap, siteUrl)
	}));
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
	const posts = await getBlogPosts();
	return posts.find((post: BlogPost) => post.slug === slug) || null;
}

export async function getPhotoItems(): Promise<PhotoItem[]> {
	const posts = await getBlogPosts();

	return posts
		.filter((post: BlogPost) => shouldIncludeGalleryPost(post))
		.flatMap((post: BlogPost) => extractPhotoItems(post));
}
