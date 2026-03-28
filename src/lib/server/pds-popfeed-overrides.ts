import { env } from '$env/dynamic/private';
import { inferImageDimensions, inferImageMimeType } from '$lib/server/image-metadata';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';
import type { PopfeedItem } from '$lib/server/popfeed';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
export const PDS_POPFEED_OVERRIDE_COLLECTION = 'blog.afterword.media.popfeedOverride';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const LIST_RECORDS_NSID = 'com.atproto.repo.listRecords';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const UPLOAD_BLOB_NSID = 'com.atproto.repo.uploadBlob';
const PDS_POPFEED_OVERRIDE_CACHE_TTL_MS = 1000 * 60 * 10;
const IMAGE_FETCH_USER_AGENT = 'afterword-sveltekit-pds popfeed-cover sync';

type AtprotoSession = {
	serviceUrl: string;
	did: string;
	accessJwt: string;
	identifier: string;
};

type CachedAtprotoSession = AtprotoSession & {
	expiresAt: number;
};

type AtprotoBlob = {
	ref: { $link: string };
	mimeType: string;
	size: number;
	$type?: string;
};

type RawAtprotoRecord = {
	uri?: string;
	cid?: string;
	value?: Record<string, unknown>;
};

type ImagePayload = {
	blob: AtprotoBlob;
	aspectRatio?: { width: number; height: number };
	originalUrl: string;
};

type PopfeedOverrideCacheEntry = {
	expiresAt: number;
	overrides: Map<string, PopfeedImageOverride>;
};

export type PopfeedImageOverride = {
	sourceUri: string;
	imageUrl: string | null;
	originalUrl: string | null;
	provider: string | null;
	syncedAt: string | null;
};

type PopfeedCoverSyncOptions = {
	items?: PopfeedItem[];
	limit?: number | null;
	force?: boolean;
};

type PopfeedCoverSyncStats = {
	available: number;
	attempted: number;
	imported: number;
	skipped: number;
	failed: number;
};

export type PopfeedCoverSyncResult = {
	ok: boolean;
	repo: string;
	did: string;
	serviceUrl: string;
	limit: number | null;
	force: boolean;
	books: PopfeedCoverSyncStats;
	errors: Array<{ slug: string; title: string; message: string }>;
};

let popfeedOverrideSessionCache: CachedAtprotoSession | null = null;
let popfeedOverrideSessionPromise: Promise<AtprotoSession> | null = null;

function getConfiguredRepoIdentifier() {
	return (
		String(
			env.STANDARD_SITE_IDENTIFIER ||
				env.ATPROTO_IDENTIFIER ||
				env.ATPROTO_REPO ||
				process.env.ATPROTO_REPO ||
				DEFAULT_REPO
		)
			.trim()
			.replace(/\/+$/, '') || DEFAULT_REPO
	);
}

function getConfiguredAppPassword() {
	return String(
		env.STANDARD_SITE_APP_PASSWORD || env.ATPROTO_APP_PASSWORD || env.ATP_APP_PASSWORD || ''
	).trim();
}

function getOverrideCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordPopfeedOverrideCache?: Map<string, PopfeedOverrideCacheEntry>;
	};

	if (!scope.__afterwordPopfeedOverrideCache) {
		scope.__afterwordPopfeedOverrideCache = new Map<string, PopfeedOverrideCacheEntry>();
	}

	return scope.__afterwordPopfeedOverrideCache;
}

function normalizeString(value: unknown) {
	return String(value || '').trim();
}

function normalizeOptionalString(value: unknown) {
	const normalized = normalizeString(value);
	return normalized || null;
}

function getObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getRecordKey(uri: string | undefined | null) {
	return (
		String(uri || '')
			.split('/')
			.pop() || ''
	);
}

function getBlobUrl(serviceUrl: string, did: string, cid: string) {
	return `${serviceUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

function getBlobRefLink(value: unknown) {
	if (
		typeof value === 'object' &&
		value &&
		'ref' in value &&
		typeof value.ref === 'object' &&
		value.ref &&
		'$link' in value.ref
	) {
		return String(value.ref.$link || '').trim();
	}

	return '';
}

function resolveBlobImageUrl(imageValue: unknown, serviceUrl: string, did: string) {
	const image = getObject(imageValue);
	const blobCid = getBlobRefLink(image.image);

	if (blobCid) {
		return getBlobUrl(serviceUrl, did, blobCid);
	}

	return normalizeOptionalString(image.url) || normalizeOptionalString(image.originalUrl) || null;
}

function normalizeIdentifiers(identifiersValue: unknown) {
	const identifiers = getObject(identifiersValue);
	const allowedKeys = ['isbn10', 'isbn13', 'imdbId', 'tmdbId', 'mbId', 'mbReleaseId'];

	return Object.fromEntries(
		allowedKeys.flatMap((key) => {
			const value = normalizeString(identifiers[key]);
			return value ? [[key, value]] : [];
		})
	);
}

function looksLikeIsbnDbCover(url: string) {
	return /^https:\/\/images\.isbndb\.com\/covers\//i.test(normalizeString(url));
}

function getOpenLibraryCoverUrl(identifiers: Record<string, string>) {
	const isbn = normalizeString(identifiers.isbn13 || identifiers.isbn10);
	return isbn
		? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`
		: null;
}

async function fetchCollectionRecords(serviceUrl: string, did: string, collection: string) {
	const records: RawAtprotoRecord[] = [];
	let cursor = '';

	for (;;) {
		const params = new URLSearchParams({
			repo: did,
			collection,
			limit: '100'
		});

		if (cursor) {
			params.set('cursor', cursor);
		}

		const response = await fetch(`${serviceUrl}/xrpc/${LIST_RECORDS_NSID}?${params.toString()}`, {
			headers: {
				accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`${collection} request failed with ${response.status}`);
		}

		const payload = (await response.json()) as {
			cursor?: string;
			records?: RawAtprotoRecord[];
		};

		records.push(...(payload.records || []));
		cursor = normalizeString(payload.cursor);

		if (!cursor) {
			return records;
		}
	}
}

function normalizeOverrideRecord(
	record: RawAtprotoRecord,
	serviceUrl: string,
	did: string
): PopfeedImageOverride | null {
	const value = getObject(record.value);
	const sourceUri = normalizeString(value.sourceUri);

	if (!sourceUri) {
		return null;
	}

	const imageUrl = resolveBlobImageUrl(value.image, serviceUrl, did);

	if (!imageUrl) {
		return null;
	}

	return {
		sourceUri,
		imageUrl,
		originalUrl: normalizeOptionalString(getObject(value.image).originalUrl),
		provider: normalizeOptionalString(getObject(value.image).provider),
		syncedAt: normalizeOptionalString(getObject(value.provenance).syncedAt)
	};
}

async function getOverrideSnapshot() {
	const repo = getConfiguredRepoIdentifier();
	const cache = getOverrideCache();
	const cached = cache.get(repo);

	if (cached && cached.expiresAt > Date.now()) {
		return {
			repo,
			did: await resolveAtprotoDid(repo),
			serviceUrl: (await resolveAtprotoService(repo)).serviceUrl,
			overrides: cached.overrides
		};
	}

	const { did, serviceUrl } = await resolveAtprotoService(repo);
	const records = await fetchCollectionRecords(serviceUrl, did, PDS_POPFEED_OVERRIDE_COLLECTION);
	const overrides = new Map(
		records
			.map((record) => normalizeOverrideRecord(record, serviceUrl, did))
			.filter((record): record is PopfeedImageOverride => Boolean(record))
			.map((record) => [record.sourceUri, record] as const)
	);

	cache.set(repo, {
		expiresAt: Date.now() + PDS_POPFEED_OVERRIDE_CACHE_TTL_MS,
		overrides
	});

	return {
		repo,
		did,
		serviceUrl,
		overrides
	};
}

async function createSession(): Promise<AtprotoSession> {
	const identifier = getConfiguredRepoIdentifier();
	const password = getConfiguredAppPassword();

	if (!identifier || !password) {
		throw new Error(
			'Popfeed override credentials are incomplete. Set STANDARD_SITE_IDENTIFIER and STANDARD_SITE_APP_PASSWORD.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await resolveAtprotoService(identifier);

	if (
		popfeedOverrideSessionCache &&
		popfeedOverrideSessionCache.expiresAt > Date.now() &&
		popfeedOverrideSessionCache.serviceUrl === serviceUrl &&
		popfeedOverrideSessionCache.identifier === identifier
	) {
		return popfeedOverrideSessionCache;
	}

	if (popfeedOverrideSessionPromise) {
		return await popfeedOverrideSessionPromise;
	}

	popfeedOverrideSessionPromise = (async () => {
		const response = await fetch(`${serviceUrl}/xrpc/${CREATE_SESSION_NSID}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				identifier,
				password
			})
		});

		if (!response.ok) {
			throw new Error(`ATProto session creation failed with ${response.status}`);
		}

		const payload = (await response.json()) as { did?: string; accessJwt?: string };
		const did = normalizeString(payload.did) || resolvedDid;
		const accessJwt = normalizeString(payload.accessJwt);

		if (!did || !accessJwt) {
			throw new Error('ATProto session did not return a DID and access token');
		}

		const session: CachedAtprotoSession = {
			serviceUrl,
			did,
			accessJwt,
			identifier,
			expiresAt: Date.now() + 1000 * 60 * 20
		};
		popfeedOverrideSessionCache = session;
		return session;
	})();

	try {
		return await popfeedOverrideSessionPromise;
	} finally {
		popfeedOverrideSessionPromise = null;
	}
}

async function uploadBlob(
	session: AtprotoSession,
	buffer: ArrayBuffer,
	mimeType: string
): Promise<AtprotoBlob> {
	const response = await fetch(`${session.serviceUrl}/xrpc/${UPLOAD_BLOB_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': mimeType
		},
		body: buffer
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto uploadBlob failed: ${response.status} ${text}`);
	}

	const payload = (await response.json()) as { blob?: AtprotoBlob };

	if (!payload?.blob?.ref?.$link) {
		throw new Error('ATProto uploadBlob did not return a blob ref');
	}

	return payload.blob;
}

async function putRecord(
	session: AtprotoSession,
	collection: string,
	rkey: string,
	record: Record<string, unknown>
) {
	const response = await fetch(`${session.serviceUrl}/xrpc/${PUT_RECORD_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			repo: session.did,
			collection,
			rkey,
			record,
			validate: false
		})
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`ATProto putRecord failed for ${collection}/${rkey}: ${response.status} ${text}`
		);
	}

	return (await response.json()) as { uri?: string; cid?: string };
}

async function uploadRemoteImage(
	session: AtprotoSession,
	url: string,
	imageCache: Map<string, ImagePayload | null>
) {
	const normalized = normalizeString(url);

	if (!normalized) {
		return null;
	}

	if (imageCache.has(normalized)) {
		return imageCache.get(normalized) || null;
	}

	const response = await fetch(normalized, {
		headers: {
			accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
			'user-agent': IMAGE_FETCH_USER_AGENT
		}
	});

	if (!response.ok) {
		imageCache.set(normalized, null);
		throw new Error(`Unable to fetch override image: ${response.status} ${normalized}`);
	}

	const mimeTypeHeader = normalizeString(response.headers.get('content-type')).split(';')[0] || '';
	const mimeType =
		mimeTypeHeader && mimeTypeHeader.startsWith('image/')
			? mimeTypeHeader
			: inferImageMimeType(normalized);
	const buffer = await response.arrayBuffer();

	if (!buffer.byteLength) {
		imageCache.set(normalized, null);
		return null;
	}

	const payload = {
		blob: await uploadBlob(session, buffer, mimeType),
		aspectRatio: inferImageDimensions(buffer, mimeType),
		originalUrl: normalized
	} satisfies ImagePayload;

	imageCache.set(normalized, payload);
	return payload;
}

function buildOverrideRecord(
	item: PopfeedItem,
	image: ImagePayload,
	provider: string
): Record<string, unknown> {
	return {
		$type: PDS_POPFEED_OVERRIDE_COLLECTION,
		sourceUri: item.uri,
		sourceCollection: 'social.popfeed.feed.listItem',
		creativeWorkType: item.type,
		title: item.title,
		...(Object.keys(normalizeIdentifiers(item.identifiers)).length
			? { identifiers: normalizeIdentifiers(item.identifiers) }
			: {}),
		image: {
			image: {
				...image.blob,
				$type: image.blob.$type || 'blob'
			},
			...(image.aspectRatio ? { aspectRatio: image.aspectRatio } : {}),
			originalUrl: image.originalUrl,
			provider,
			alt: item.mainCredit ? `${item.title} by ${item.mainCredit}` : item.title
		},
		provenance: {
			syncedAt: new Date().toISOString(),
			...(item.sourcePosterImage || item.posterImage
				? { sourceImageUrl: item.sourcePosterImage || item.posterImage }
				: {})
		}
	};
}

function isMissingOverrideImageError(error: unknown) {
	return (
		error instanceof Error && /Unable to fetch override image:\s*(404|410)\b/.test(error.message)
	);
}

export async function getPopfeedImageOverrides() {
	return (await getOverrideSnapshot()).overrides;
}

export function clearPopfeedImageOverrideCache(repo = getConfiguredRepoIdentifier()) {
	getOverrideCache().delete(repo);
}

export async function syncPopfeedBookCoverOverrides({
	items = [],
	limit = null,
	force = false
}: PopfeedCoverSyncOptions): Promise<PopfeedCoverSyncResult> {
	const books = items.filter((item) => item.type === 'book');
	const selectedBooks =
		typeof limit === 'number' && Number.isFinite(limit) && limit >= 0
			? books.slice(0, limit)
			: books;
	const existingOverrides = await getPopfeedImageOverrides();
	const session = await createSession();
	const imageCache = new Map<string, ImagePayload | null>();
	const repo = getConfiguredRepoIdentifier();
	const result: PopfeedCoverSyncResult = {
		ok: true,
		repo,
		did: session.did,
		serviceUrl: session.serviceUrl,
		limit: typeof limit === 'number' && Number.isFinite(limit) && limit >= 0 ? limit : null,
		force,
		books: {
			available: books.length,
			attempted: 0,
			imported: 0,
			skipped: 0,
			failed: 0
		},
		errors: []
	};

	for (const item of selectedBooks) {
		const sourceCoverUrl = normalizeString(item.sourcePosterImage || item.posterImage);
		const openLibraryCoverUrl = getOpenLibraryCoverUrl(item.identifiers);
		const hasExistingOverride = existingOverrides.has(item.uri);
		const needsReplacement = !sourceCoverUrl || looksLikeIsbnDbCover(sourceCoverUrl);

		if (!force && hasExistingOverride) {
			result.books.skipped += 1;
			continue;
		}

		if (!force && !needsReplacement) {
			result.books.skipped += 1;
			continue;
		}

		if (!openLibraryCoverUrl) {
			result.books.skipped += 1;
			continue;
		}

		result.books.attempted += 1;

		try {
			const image = await uploadRemoteImage(session, openLibraryCoverUrl, imageCache);

			if (!image) {
				result.books.skipped += 1;
				continue;
			}

			await putRecord(
				session,
				PDS_POPFEED_OVERRIDE_COLLECTION,
				getRecordKey(item.uri) || item.slug,
				buildOverrideRecord(item, image, 'openlibrary')
			);
			result.books.imported += 1;
		} catch (error) {
			if (isMissingOverrideImageError(error)) {
				result.books.skipped += 1;
				continue;
			}

			result.ok = false;
			result.books.failed += 1;
			result.errors.push({
				slug: item.slug,
				title: item.title,
				message: error instanceof Error ? error.message : 'Unable to import override image.'
			});
		}
	}

	clearPopfeedImageOverrideCache(repo);
	return result;
}
