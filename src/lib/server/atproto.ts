const CHECKINS_BASE_URL = 'https://bsky.social/xrpc/com.atproto.repo.listRecords';
const BLOB_URL = 'https://bsky.social/xrpc/com.atproto.sync.getBlob';
const RESOLVE_HANDLE_URL = 'https://bsky.social/xrpc/com.atproto.identity.resolveHandle';
const AUTHOR_FEED_URL = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';
const CHECKIN_COLLECTION = 'blog.afterword.checkin';
const DEFAULT_REPO = 'afterword.blog';
const FEED_LIMIT = 20;

export type Checkin = {
	id: string;
	uri: string;
	cid: string;
	slug: string;
	canonicalPath: string;
	name: string;
	note: string;
	excerpt: string;
	address: string;
	locality: string;
	region: string;
	country: string;
	place: string;
	timezone: string;
	latitude: number | null;
	longitude: number | null;
	website: string;
	venueCategory: string;
	visibility: string;
	tags: string[];
	createdAt: Date;
	visitedAt: Date;
	coverImage: string | null;
	photoUrls: string[];
	mapEmbedUrl: string | null;
	appleMapsUrl: string | null;
};

export type StatusPost = {
	id: string;
	uri: string;
	slug: string;
	text: string;
	html: string;
	date: Date;
	blueskyUrl: string;
	displayName: string;
	handle: string;
	avatar: string;
	isReply: boolean;
	replyCount: number;
	repostCount: number;
	likeCount: number;
	images: Array<{
		thumb: string;
		fullsize: string;
		alt: string;
	}>;
	external: {
		uri: string;
		title: string;
		description: string;
		domain: string;
	} | null;
	replyTo?: {
		uri: string | null;
		displayName: string;
		handle: string;
		blueskyUrl: string;
	} | null;
	replies?: StatusPost[];
};

function getRepos() {
	return (process.env.ATPROTO_REPOS || process.env.ATPROTO_REPO || DEFAULT_REPO)
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

function getRecordKey(uri: string | undefined | null) {
	return String(uri || '').split('/').pop() || '';
}

async function resolveDid(repo: string) {
	if (repo.startsWith('did:')) {
		return repo;
	}

	const response = await fetch(`${RESOLVE_HANDLE_URL}?handle=${encodeURIComponent(repo)}`);
	if (!response.ok) {
		throw new Error(`Unable to resolve handle ${repo}: ${response.status}`);
	}

	const data = await response.json();
	return data.did as string;
}

function getBlobUrl(did: string, cid: string) {
	return `${BLOB_URL}?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

function toCoordinate(value: unknown) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string') {
		const parsed = Number.parseFloat(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function roundCoordinate(value: number | null, decimals: number) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}

	return Number(value.toFixed(decimals));
}

function normalizeVenueCategory(value: unknown) {
	const normalized = String(value || '')
		.trim()
		.replace(/^mkpoicategory/i, '')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.trim();

	return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
}

function getDisplayCoordinates(latitude: number | null, longitude: number | null, visibility: string) {
	if (visibility === 'private') {
		return { latitude: null, longitude: null };
	}

	if (typeof latitude !== 'number' || typeof longitude !== 'number') {
		return { latitude: null, longitude: null };
	}

	if (visibility === 'approximate') {
		return {
			latitude: roundCoordinate(latitude, 3),
			longitude: roundCoordinate(longitude, 3)
		};
	}

	return { latitude, longitude };
}

function getMapEmbedUrl(latitude: number | null, longitude: number | null) {
	if (typeof latitude !== 'number' || typeof longitude !== 'number') {
		return null;
	}

	const latDelta = 0.012;
	const lonDelta = 0.02;
	const left = longitude - lonDelta;
	const right = longitude + lonDelta;
	const top = latitude + latDelta;
	const bottom = latitude - latDelta;

	return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function getAppleMapsUrl({
	name,
	latitude,
	longitude
}: {
	name: string;
	latitude: number | null;
	longitude: number | null;
}) {
	if (typeof latitude !== 'number' || typeof longitude !== 'number') {
		return null;
	}

	const query = encodeURIComponent(name || 'Check-in');
	return `https://maps.apple.com/?q=${query}&ll=${latitude},${longitude}`;
}

function normalizePlace(parts: string[]) {
	return parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

function getPhotoRefLink(value: unknown) {
	if (
		typeof value === 'object' &&
		value &&
		'ref' in value &&
		typeof value.ref === 'object' &&
		value.ref &&
		'$link' in value.ref
	) {
		return String(value.ref.$link);
	}

	return null;
}

function normalizeCheckin(
	record: {
		uri?: string;
		cid?: string;
		value?: Record<string, unknown>;
	},
	did: string
): Checkin {
	const value = record.value || {};
	const coverCid = getPhotoRefLink(value.photo);

	const photos = Array.isArray(value.photos) ? value.photos : [];
	const photoUrls = photos
		.map((item) => getPhotoRefLink(item))
		.filter(Boolean)
		.map((cid) => getBlobUrl(did, cid as string));

	const visitedAt = new Date(
		String(value.visitedAt || value.createdAt || new Date().toISOString())
	);
	const slug = String(value.slug || getRecordKey(record.uri) || '').trim();
	const canonicalPath = String(value.canonicalPath || `/check-ins/${slug}/`).trim();
	const latitude = toCoordinate(value.latitude);
	const longitude = toCoordinate(value.longitude);
	const visibility = String(value.visibility || 'public').trim() || 'public';
	const displayCoordinates = getDisplayCoordinates(latitude, longitude, visibility);
	const isPrivate = visibility === 'private';
	const place = isPrivate
		? ''
		: normalizePlace([
				String(value.locality || ''),
				String(value.region || ''),
				String(value.country || '')
			]);
	const address = isPrivate ? '' : String(value.address || '').trim();

	return {
		id: getRecordKey(record.uri),
		uri: String(record.uri || ''),
		cid: String(record.cid || ''),
		slug,
		canonicalPath,
		name: String(value.name || 'Untitled place'),
		note: String(value.note || '').trim(),
		excerpt: String(value.excerpt || '').trim(),
		address,
		locality: String(value.locality || '').trim(),
		region: String(value.region || '').trim(),
		country: String(value.country || '').trim(),
		place,
		timezone: String(value.timezone || '').trim(),
		latitude: displayCoordinates.latitude,
		longitude: displayCoordinates.longitude,
		website: String(value.website || '').trim(),
		venueCategory: normalizeVenueCategory(value.venueCategory),
		visibility,
		tags: Array.isArray(value.tags) ? value.tags.map((tag) => String(tag)) : [],
		createdAt: new Date(String(value.createdAt || new Date().toISOString())),
		visitedAt,
		coverImage: coverCid ? getBlobUrl(did, coverCid) : null,
		photoUrls,
		mapEmbedUrl: getMapEmbedUrl(displayCoordinates.latitude, displayCoordinates.longitude),
		appleMapsUrl: getAppleMapsUrl({
			name: String(value.name || 'Check-in'),
			latitude: displayCoordinates.latitude,
			longitude: displayCoordinates.longitude
		})
	};
}

function escapeHtml(value: string) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function renderTextHtml(text: string) {
	const trimmed = String(text || '').trim();

	if (!trimmed) {
		return '';
	}

	return trimmed
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

function getPostUrl(uri: string, handle: string) {
	const recordKey = getRecordKey(uri);
	return `https://bsky.app/profile/${handle}/post/${recordKey}`;
}

function getImages(post: Record<string, any>) {
	const embed = post.embed || post.record?.embed;

	if (!embed) {
		return [];
	}

	const imageViews = embed.images || embed.media?.images || [];

	return imageViews.map((image: Record<string, any>) => ({
		thumb: image.thumb || image.fullsize,
		fullsize: image.fullsize || image.thumb,
		alt: image.alt || ''
	}));
}

function getExternal(post: Record<string, any>) {
	const embed = post.embed || post.record?.embed;

	if (!embed) {
		return null;
	}

	const external = embed.external || embed.media?.external;

	if (!external || !external.uri) {
		return null;
	}

	let domain = external.uri;

	try {
		domain = new URL(external.uri).hostname.replace(/^www\./, '');
	} catch {
		// Keep the raw URI if it cannot be parsed.
	}

	return {
		uri: external.uri,
		title: external.title || domain,
		description: external.description || '',
		domain
	};
}

function getReplyParent(node: Record<string, any> | null) {
	if (!node || node.$type !== 'app.bsky.feed.defs#threadViewPost' || !node.post) {
		return null;
	}

	const parentPost = node.post;
	const author = parentPost.author || {};
	const handle = author.handle || DEFAULT_REPO;

	return {
		uri: parentPost.uri || null,
		displayName: author.displayName || handle,
		handle: `@${handle}`,
		blueskyUrl: getPostUrl(parentPost.uri, handle)
	};
}

function normalizeReply(node: Record<string, any>): StatusPost | null {
	if (!node || node.$type !== 'app.bsky.feed.defs#threadViewPost' || !node.post) {
		return null;
	}

	const post = node.post;
	const author = post.author || {};
	const record = post.record || {};
	const handle = author.handle || '';

	return {
		id: String(post.uri || ''),
		uri: String(post.uri || ''),
		slug: getRecordKey(post.uri),
		text: String(record.text || ''),
		html: renderTextHtml(String(record.text || '')),
		date: new Date(String(record.createdAt || post.indexedAt || new Date().toISOString())),
		blueskyUrl: getPostUrl(String(post.uri || ''), handle),
		displayName: author.displayName || handle,
		handle: handle ? `@${handle}` : '',
		avatar: author.avatar || '',
		isReply: Boolean(record.reply?.parent?.uri),
		replyCount: Number(post.replyCount || 0),
		repostCount: Number(post.repostCount || 0),
		likeCount: Number(post.likeCount || 0),
		images: getImages(post),
		external: getExternal(post),
		replies: (node.replies || []).map(normalizeReply).filter(Boolean) as StatusPost[]
	};
}

function normalizeStatus(item: Record<string, any>, actor: string): StatusPost | null {
	const post = item.post || {};
	const author = post.author || {};
	const record = post.record || {};
	const handle = author.handle || actor;

	if (item.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
		return null;
	}

	return {
		id: String(post.uri || ''),
		uri: String(post.uri || ''),
		slug: getRecordKey(post.uri),
		text: String(record.text || ''),
		html: renderTextHtml(String(record.text || '')),
		date: new Date(String(record.createdAt || post.indexedAt || new Date().toISOString())),
		blueskyUrl: getPostUrl(String(post.uri || ''), handle),
		displayName: author.displayName || handle,
		handle: `@${handle}`,
		avatar: author.avatar || '',
		isReply: Boolean(record.reply?.parent?.uri),
		replyCount: Number(post.replyCount || 0),
		repostCount: Number(post.repostCount || 0),
		likeCount: Number(post.likeCount || 0),
		images: getImages(post),
		external: getExternal(post),
		replyTo: null,
		replies: []
	};
}

async function fetchThreadContextForPost(post: StatusPost) {
	if (!post.replyCount && !post.uri) {
		return post;
	}

	try {
		const response = await fetch(
			`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(post.uri)}&depth=10`,
			{
				headers: { accept: 'application/json' }
			}
		);

		if (!response.ok) {
			throw new Error(`Thread request failed with ${response.status}`);
		}

		const data = (await response.json()) as { thread?: Record<string, any> };
		const replies = (data.thread?.replies || []).map(normalizeReply).filter(Boolean) as StatusPost[];
		const replyTo = getReplyParent((data.thread?.parent as Record<string, any>) || null);

		return {
			...post,
			replyTo,
			replies
		};
	} catch (error) {
		console.warn(`[bluesky] Unable to fetch thread for ${post.uri}:`, error);
		return post;
	}
}

export async function getCheckins() {
	try {
		const allRecords: Checkin[] = [];

		for (const repo of getRepos()) {
			const did = await resolveDid(repo);
			const response = await fetch(
				`${CHECKINS_BASE_URL}?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(CHECKIN_COLLECTION)}&limit=100`,
				{
					headers: { accept: 'application/json' }
				}
			);

			if (!response.ok) {
				throw new Error(`check-in request failed for ${repo} with ${response.status}`);
			}

			const data = (await response.json()) as { records?: Array<Record<string, unknown>> };
			allRecords.push(...(data.records || []).map((record) => normalizeCheckin(record, did)));
		}

		const seenPaths = new Set<string>();

		return allRecords
			.filter((item) => {
				const key = String(item.canonicalPath || item.id || '').trim();

				if (!key || seenPaths.has(key)) {
					return false;
				}

				seenPaths.add(key);
				return true;
			})
			.sort((a, b) => b.visitedAt.getTime() - a.visitedAt.getTime());
	} catch (error) {
		console.warn('[checkins] Unable to fetch records:', error);
		return [];
	}
}

export async function getStatuses(actor = DEFAULT_REPO) {
	try {
		const response = await fetch(
			`${AUTHOR_FEED_URL}?actor=${encodeURIComponent(actor)}&limit=${FEED_LIMIT}`,
			{
				headers: { accept: 'application/json' }
			}
		);

		if (!response.ok) {
			throw new Error(`Bluesky feed request failed with ${response.status}`);
		}

		const data = (await response.json()) as { feed?: Array<Record<string, any>> };

		const posts = (data.feed || [])
			.map((item) => normalizeStatus(item, actor))
			.filter((post): post is StatusPost => Boolean(post));

		return Promise.all(posts.map((post) => fetchThreadContextForPost(post)));
	} catch (error) {
		console.warn('[bluesky] Unable to fetch author feed:', error);
		return [];
	}
}

export async function getCheckinBySlug(slug: string) {
	const checkins = await getCheckins();
	return checkins.find((item) => item.slug === slug) || null;
}

export async function getStatusBySlug(slug: string) {
	const statuses = await getStatuses();
	return statuses.find((item) => item.slug === slug) || null;
}
