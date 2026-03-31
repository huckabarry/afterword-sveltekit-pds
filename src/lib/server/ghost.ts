import { env } from '$env/dynamic/private';

const DEFAULT_GHOST_URL = 'https://lowvelocity.org';
const ghostFallbackFiles = import.meta.glob('/data/ghost-posts-lite.json', {
	import: 'default',
	eager: true
}) as Record<string, { posts?: unknown }>;
const ghostNowFallbackFiles = import.meta.glob('/data/ghost-now-lite.json', {
	import: 'default',
	eager: true
}) as Record<string, { posts?: unknown }>;
const LIVE_GHOST_CACHE_TTL_MS = 1000 * 60 * 5;
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
const INTERNAL_TAG_PREFIX = 'hash-';
const GHOST_FILTER = `status:published+tag:[${[...INCLUDED_TAGS].join(',')}]`;
const NOW_FILTER = 'status:published+tag:now';
const livePostsCache = new Map<string, { expiresAt: number; posts: Record<string, unknown>[] }>();

export type GhostTag = {
	slug: string;
	label: string;
	path: string;
};

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
	coverImageWidth: number | null;
	coverImageHeight: number | null;
	coverImageCaption: string | null;
	tags: string[];
	primaryTag: string | null;
	publicTags: GhostTag[];
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
	width: number | null;
	height: number | null;
};

export type GhostStandardSiteWriteback = {
	documentAtUri: string;
	publicationAtUri: string;
	publicUrl?: string | null;
	syncedAt?: string;
};

export function clearGhostLivePostsCache() {
	livePostsCache.clear();
}

export function stripImagesFromHtml(html: string) {
	return String(html || '')
		.replace(/<figure\b[^>]*>[\s\S]*?<img[\s\S]*?<\/figure>/gi, '')
		.replace(/<img\b[^>]*>/gi, '')
		.replace(/<p>\s*(?:<br\s*\/?>|\s|&nbsp;)*<\/p>/gi, '')
		.trim();
}

function getGhostUrl() {
	return String(env.GHOST_URL || env.GHOST_ADMIN_URL || DEFAULT_GHOST_URL)
		.trim()
		.replace(/\/+$/, '')
		.replace(/\/ghost$/i, '');
}

function getGhostAdminKey() {
	return String(env.GHOST_ADMIN_KEY || '').trim();
}

function getGhostContentKey() {
	return String(env.GHOST_CONTENT_API_KEY || '').trim();
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

function parsePositiveInt(value: unknown) {
	const parsed = Number.parseInt(String(value ?? ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getImageTagAttribute(tag: string, attribute: string) {
	const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const quotedMatch = tag.match(new RegExp(`\\b${escaped}=["']([^"']+)["']`, 'i'));
	if (quotedMatch?.[1]) {
		return quotedMatch[1];
	}

	const unquotedMatch = tag.match(new RegExp(`\\b${escaped}=([^\\s>]+)`, 'i'));
	return unquotedMatch?.[1] || '';
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

function formatTagLabel(slug: string) {
	return String(slug || '')
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function toPublicTag(slug: string): GhostTag | null {
	const normalized = String(slug || '').trim();

	if (!normalized || normalized.startsWith(INTERNAL_TAG_PREFIX) || EXCLUDED_TAGS.has(normalized)) {
		return null;
	}

	return {
		slug: normalized,
		label: formatTagLabel(normalized),
		path: `/tags/${normalized}`
	};
}

function normalizePost(post: Record<string, any>, siteUrl: string): BlogPost {
	const title = String(post.title || '').trim() || 'Untitled';
	const slug = String(post.slug || '').trim() || slugify(title);
	const excerpt = stripHtml(post.excerpt || post.custom_excerpt || post.html || '') || title;
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
		coverImageWidth: parsePositiveInt(post.feature_image_width),
		coverImageHeight: parsePositiveInt(post.feature_image_height),
		coverImageCaption: stripHtml(post.feature_image_caption || '') || null,
		tags: Array.isArray(post.tags)
			? post.tags.map((tag: Record<string, any>) => String(tag.slug || '').trim()).filter(Boolean)
			: [],
		primaryTag: (post.primary_tag && String(post.primary_tag.slug || '').trim()) || null,
		publicTags: []
	};
}

function shouldIncludeGalleryPost(post: BlogPost) {
	const tags = new Set((post.tags || []).filter(Boolean));
	return tags.has('gallery') || tags.has('hash-gallery') || tags.has('photography');
}

function extractPhotoItems(post: BlogPost): PhotoItem[] {
	const imagePattern = /<img\b[^>]*>/gi;
	const seen = new Set<string>();
	const items: PhotoItem[] = [];
	let match: RegExpExecArray | null = null;
	let index = 0;

	while ((match = imagePattern.exec(post.html))) {
		const tag = match[0] || '';
		const imageUrl = getImageTagAttribute(tag, 'src');
		const alt = getImageTagAttribute(tag, 'alt') || post.title;
		const width = parsePositiveInt(getImageTagAttribute(tag, 'width'));
		const height = parsePositiveInt(getImageTagAttribute(tag, 'height'));

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
			index,
			width,
			height
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
			index: -1,
			width: post.coverImageWidth,
			height: post.coverImageHeight
		});
	}

	return items;
}

export function getPostImages(post: BlogPost): PhotoItem[] {
	return extractPhotoItems(post);
}

function shouldIncludePost(post: BlogPost) {
	const tags = new Set((post.tags || []).filter(Boolean));

	if ([...tags].some((tag) => EXCLUDED_TAGS.has(tag))) {
		return false;
	}

	return [...tags].some((tag) => INCLUDED_TAGS.has(tag));
}

function loadFallbackPosts() {
	try {
		const data = ghostFallbackFiles['/data/ghost-posts-lite.json'] || {};
		return Array.isArray(data.posts) ? (data.posts as Record<string, unknown>[]) : [];
	} catch {
		return [] as Record<string, unknown>[];
	}
}

function loadNowFallbackPosts() {
	try {
		const data = ghostNowFallbackFiles['/data/ghost-now-lite.json'] || {};
		return Array.isArray(data.posts) ? (data.posts as Record<string, unknown>[]) : [];
	} catch {
		return [] as Record<string, unknown>[];
	}
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeText(value: string) {
	return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function hexToBytes(hex: string) {
	const normalized = hex.trim();
	if (!normalized || normalized.length % 2 !== 0) {
		throw new Error('Invalid Ghost admin secret');
	}

	const bytes = new Uint8Array(normalized.length / 2);
	for (let i = 0; i < normalized.length; i += 2) {
		bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
	}
	return bytes;
}

async function createGhostAdminToken(key: string) {
	const [id, secret] = key.split(':');

	if (!id || !secret) {
		throw new Error('Invalid Ghost admin key');
	}

	const now = Math.floor(Date.now() / 1000);
	const header = {
		alg: 'HS256',
		kid: id,
		typ: 'JWT'
	};
	const payload = {
		iat: now,
		exp: now + 5 * 60,
		aud: '/admin/'
	};

	const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
	const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
	const signingInput = `${encodedHeader}.${encodedPayload}`;

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		hexToBytes(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign(
		'HMAC',
		cryptoKey,
		new TextEncoder().encode(signingInput)
	);

	return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function fetchPostsFromAdminApi(siteUrl: string, filter: string, maxPages = 100, limit = 100) {
	const key = getGhostAdminKey();

	if (!key || !siteUrl) {
		return null;
	}

	const token = await createGhostAdminToken(key);
	const posts: Record<string, unknown>[] = [];

	for (let page = 1; page <= maxPages; page += 1) {
		const params = new URLSearchParams({
			formats: 'html',
			include: 'tags,authors',
			limit: String(limit),
			page: String(page),
			filter
		});
		const response = await fetch(`${siteUrl}/ghost/api/admin/posts/?${params.toString()}`, {
			headers: {
				Accept: 'application/json',
				Authorization: `Ghost ${token}`
			}
		});

		if (!response.ok) {
			throw new Error(`Ghost Admin API request failed with ${response.status}`);
		}

		const payload = (await response.json()) as { posts?: Record<string, unknown>[] };
		const batch = Array.isArray(payload.posts) ? payload.posts : [];

		if (!batch.length) {
			break;
		}

		posts.push(...batch);

		if (batch.length < limit) {
			break;
		}
	}

	return posts;
}

async function fetchPostFromAdminApi(siteUrl: string, postId: string) {
	const key = getGhostAdminKey();

	if (!key || !siteUrl || !postId) {
		return null;
	}

	const token = await createGhostAdminToken(key);
	const params = new URLSearchParams({
		formats: 'html',
		include: 'tags,authors'
	});
	const response = await fetch(`${siteUrl}/ghost/api/admin/posts/${postId}/?${params.toString()}`, {
		headers: {
			Accept: 'application/json',
			Authorization: `Ghost ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Ghost Admin API post lookup failed with ${response.status}`);
	}

	const payload = (await response.json()) as { posts?: Record<string, unknown>[] };
	return Array.isArray(payload.posts) && payload.posts.length ? payload.posts[0] : null;
}

function escapeHtmlAttribute(value: string) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function buildStandardSiteMetaTag(name: string, value: string) {
	return `<meta name="${name}" content="${escapeHtmlAttribute(value)}">`;
}

function mergeAfterwordStandardSiteHead(existingHead: string, metadata: GhostStandardSiteWriteback) {
	const markers = [
		'afterword:standard-site-document',
		'afterword:standard-site-publication',
		'afterword:leaflet-url',
		'afterword:last-synced-at'
	];
	const lines = String(existingHead || '')
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line) => {
			const normalized = line.toLowerCase();
			return !markers.some((marker) => normalized.includes(`name="${marker}"`));
		});

	lines.push(buildStandardSiteMetaTag('afterword:standard-site-document', metadata.documentAtUri));
	lines.push(buildStandardSiteMetaTag('afterword:standard-site-publication', metadata.publicationAtUri));
	if (metadata.publicUrl) {
		lines.push(buildStandardSiteMetaTag('afterword:leaflet-url', metadata.publicUrl));
	}
	lines.push(
		buildStandardSiteMetaTag(
			'afterword:last-synced-at',
			String(metadata.syncedAt || new Date().toISOString())
		)
	);

	return lines.filter(Boolean).join('\n').trim();
}

export async function writeStandardSiteMetadataToGhost(
	post: Pick<BlogPost, 'id'>,
	metadata: GhostStandardSiteWriteback
) {
	const siteUrl = getGhostUrl();
	const key = getGhostAdminKey();

	if (!siteUrl || !key || !post.id) {
		return { updated: false, reason: 'ghost-admin-unavailable' as const };
	}

	const current = await fetchPostFromAdminApi(siteUrl, post.id);
	if (!current) {
		throw new Error('Ghost post not found for write-back.');
	}

	const currentUpdatedAt = String(current.updated_at || '').trim();
	if (!currentUpdatedAt) {
		throw new Error('Ghost post update requires updated_at.');
	}

	const nextHead = mergeAfterwordStandardSiteHead(String(current.codeinjection_head || ''), metadata);
	if (nextHead === String(current.codeinjection_head || '').trim()) {
		return { updated: false, reason: 'unchanged' as const };
	}

	const token = await createGhostAdminToken(key);
	const response = await fetch(`${siteUrl}/ghost/api/admin/posts/${post.id}/`, {
		method: 'PUT',
		headers: {
			Accept: 'application/json',
			Authorization: `Ghost ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			posts: [
				{
					id: post.id,
					updated_at: currentUpdatedAt,
					codeinjection_head: nextHead
				}
			]
		})
	});

	if (!response.ok) {
		throw new Error(`Ghost Admin API post update failed with ${response.status}`);
	}

	return { updated: true as const };
}

async function fetchPostsFromContentApi(siteUrl: string, filter: string, limit: number | 'all' = 'all') {
	const key = getGhostContentKey();

	if (!key || !siteUrl) {
		return null;
	}

	const params = new URLSearchParams({
		key,
		filter,
		include: 'tags,authors',
		formats: 'html',
		limit: String(limit)
	});
	const response = await fetch(`${siteUrl}/ghost/api/content/posts/?${params.toString()}`, {
		headers: {
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Ghost Content API request failed with ${response.status}`);
	}

	const payload = (await response.json()) as { posts?: Record<string, unknown>[] };
	return Array.isArray(payload.posts) ? payload.posts : [];
}

async function loadLivePosts(siteUrl: string, filter: string) {
	const cached = livePostsCache.get(filter);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.posts;
	}

	try {
		const posts =
			(await fetchPostsFromAdminApi(siteUrl, filter)) || (await fetchPostsFromContentApi(siteUrl, filter));
		if (posts && posts.length) {
			livePostsCache.set(filter, {
				expiresAt: Date.now() + LIVE_GHOST_CACHE_TTL_MS,
				posts
			});
			return posts;
		}
	} catch (error) {
		console.warn(
			`[ghost] Live Ghost API fetch failed: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	return [];
}

async function loadRecentLivePosts(siteUrl: string, filter: string, limit: number) {
	try {
		const posts =
			(await fetchPostsFromAdminApi(siteUrl, filter, 1, limit)) ||
			(await fetchPostsFromContentApi(siteUrl, filter, limit));
		return posts || [];
	} catch (error) {
		console.warn(
			`[ghost] Recent Ghost API fetch failed: ${error instanceof Error ? error.message : String(error)}`
		);
		return [];
	}
}

export async function getBlogPosts(): Promise<BlogPost[]> {
	const siteUrl = getGhostUrl();
	const livePosts = await loadLivePosts(siteUrl, GHOST_FILTER);
	const rawPosts = livePosts.length ? livePosts : loadFallbackPosts();

	const posts = rawPosts
		.map((post: Record<string, unknown>) => normalizePost(post, siteUrl))
		.filter((post: BlogPost) => post.title && post.html)
		.filter(shouldIncludePost)
		.sort((a: BlogPost, b: BlogPost) => b.publishedAt.getTime() - a.publishedAt.getTime());

	const sourceMap = new Map<string, string>(
		posts.map((post: BlogPost) => [normalizeSourceUrl(post.sourceUrl), post.path])
	);

	return posts.map((post: BlogPost) => ({
		...post,
		html: rewriteInternalLinks(post.html, sourceMap, siteUrl),
		publicTags: post.tags
			.map((tag: string) => toPublicTag(tag))
			.filter((tag: GhostTag | null): tag is GhostTag => Boolean(tag))
	}));
}

export async function getRecentBlogPosts(limit = 8): Promise<BlogPost[]> {
	const siteUrl = getGhostUrl();
	const livePosts = await loadRecentLivePosts(siteUrl, GHOST_FILTER, limit);
	const rawPosts = livePosts.length ? livePosts : loadFallbackPosts().slice(0, limit);

	const posts = rawPosts
		.map((post: Record<string, unknown>) => normalizePost(post, siteUrl))
		.filter((post: BlogPost) => post.title && post.html)
		.filter(shouldIncludePost)
		.sort((a: BlogPost, b: BlogPost) => b.publishedAt.getTime() - a.publishedAt.getTime())
		.slice(0, limit);

	const sourceMap = new Map<string, string>(
		posts.map((post: BlogPost) => [normalizeSourceUrl(post.sourceUrl), post.path])
	);

	return posts.map((post: BlogPost) => ({
		...post,
		html: rewriteInternalLinks(post.html, sourceMap, siteUrl),
		publicTags: post.tags
			.map((tag: string) => toPublicTag(tag))
			.filter((tag: GhostTag | null): tag is GhostTag => Boolean(tag))
	}));
}

export async function getRecentTaggedPosts(tagSlugs: string[], limit = 6): Promise<BlogPost[]> {
	const normalizedTags = [...new Set(
		(tagSlugs || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)
	)];

	if (!normalizedTags.length) {
		return [];
	}

	const siteUrl = getGhostUrl();
	const filter = `status:published+tag:[${normalizedTags.join(',')}]`;
	const livePosts = await loadRecentLivePosts(siteUrl, filter, Math.max(limit * 2, limit));
	const fallbackPool = normalizedTags.includes('now')
		? [...loadNowFallbackPosts(), ...loadFallbackPosts()]
		: loadFallbackPosts();
	const fallbackPosts = [...new Map(fallbackPool.map((post) => [String((post as { id?: string }).id || ''), post])).values()];
	const rawPosts = livePosts.length ? livePosts : fallbackPosts;

	const posts = rawPosts
		.map((post: Record<string, unknown>) => normalizePost(post, siteUrl))
		.filter((post: BlogPost) => post.title && post.html)
		.filter((post: BlogPost) => post.tags.some((tag) => normalizedTags.includes(tag)))
		.sort((a: BlogPost, b: BlogPost) => b.publishedAt.getTime() - a.publishedAt.getTime())
		.slice(0, limit);

	const sourceMap = new Map<string, string>(
		posts.map((post: BlogPost) => [normalizeSourceUrl(post.sourceUrl), post.path])
	);

	return posts.map((post: BlogPost) => ({
		...post,
		html: rewriteInternalLinks(post.html, sourceMap, siteUrl),
		publicTags: post.tags
			.map((tag: string) => toPublicTag(tag))
			.filter((tag: GhostTag | null): tag is GhostTag => Boolean(tag))
	}));
}

export async function getLatestNowPost(): Promise<BlogPost | null> {
	const siteUrl = getGhostUrl();
	const livePosts = await loadLivePosts(siteUrl, NOW_FILTER);
	const rawPosts = livePosts.length ? livePosts : loadNowFallbackPosts();

	const posts = rawPosts
		.map((post: Record<string, unknown>) => normalizePost(post, siteUrl))
		.filter((post: BlogPost) => {
			const tags = new Set((post.tags || []).filter(Boolean));
			return tags.has('now');
		})
		.sort((a: BlogPost, b: BlogPost) => b.publishedAt.getTime() - a.publishedAt.getTime());

	return posts[0] || null;
}

export async function getPublicTags() {
	const posts = await getBlogPosts();
	const tags = new Map<string, GhostTag>();

	for (const post of posts) {
		for (const tag of post.publicTags) {
			if (!tags.has(tag.slug)) {
				tags.set(tag.slug, tag);
			}
		}
	}

	return [...tags.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export async function getBlogPostsByTag(tagSlug: string) {
	const normalized = String(tagSlug || '').trim().toLowerCase();
	const posts = await getBlogPosts();
	return posts.filter((post) => post.publicTags.some((tag) => tag.slug === normalized));
}

export async function getBlogPostsByAnyTag(tagSlugs: string[]) {
	const normalized = new Set(
		(tagSlugs || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean)
	);
	const posts = await getBlogPosts();
	if (!normalized.size) return [];

	return posts.filter((post) => post.publicTags.some((tag) => normalized.has(tag.slug)));
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
	const posts = await getBlogPosts();
	return posts.find((post: BlogPost) => post.slug === slug) || null;
}

export async function getAllPhotoItems(): Promise<PhotoItem[]> {
	const posts = await getBlogPosts();

	return posts.flatMap((post: BlogPost) => extractPhotoItems(post));
}

export async function getPhotoItems(): Promise<PhotoItem[]> {
	const posts = await getBlogPosts();

	return posts
		.filter((post: BlogPost) => shouldIncludeGalleryPost(post))
		.flatMap((post: BlogPost) => extractPhotoItems(post));
}
