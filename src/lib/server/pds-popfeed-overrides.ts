import { env } from '$env/dynamic/private';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';
import type { PopfeedItem } from '$lib/server/popfeed';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
export const PDS_POPFEED_OVERRIDE_COLLECTION = 'blog.afterword.media.popfeedOverride';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const LIST_RECORDS_NSID = 'com.atproto.repo.listRecords';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const PDS_POPFEED_OVERRIDE_CACHE_TTL_MS = 1000 * 60 * 10;
export type PopfeedImageOverrideStatus = 'approved' | 'pending' | 'hidden';

type AtprotoSession = {
	serviceUrl: string;
	did: string;
	accessJwt: string;
	identifier: string;
};

type CachedAtprotoSession = AtprotoSession & {
	expiresAt: number;
};

type RawAtprotoRecord = {
	uri?: string;
	cid?: string;
	value?: Record<string, unknown>;
};

type PopfeedOverrideCacheEntry = {
	expiresAt: number;
	overrides: Map<string, PopfeedImageOverride>;
};

export type PopfeedImageOverride = {
	uri: string;
	rkey: string;
	record: Record<string, unknown>;
	sourceUri: string;
	imageUrl: string | null;
	originalUrl: string | null;
	provider: string | null;
	syncedAt: string | null;
	status: PopfeedImageOverrideStatus;
	title: string | null;
	creativeWorkType: string | null;
	sourceImageUrl: string | null;
	queueReason: string | null;
};

export type PopfeedBookCoverReviewItem = {
	sourceUri: string;
	title: string;
	author: string | null;
	localPath: string;
	isbn: string | null;
	sourceImageUrl: string | null;
	candidateImageUrl: string | null;
	candidateProvider: string | null;
	queueReason: string;
	openLibraryUrl: string | null;
};

export type PopfeedBookCoverReviewQueue = {
	total: number;
	items: PopfeedBookCoverReviewItem[];
};

type PopfeedCoverSyncOptions = {
	items?: PopfeedItem[];
	limit?: number | null;
	offset?: number | null;
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
	offset: number;
	nextOffset: number | null;
	force: boolean;
	books: PopfeedCoverSyncStats;
	errors: Array<{ slug: string; title: string; message: string }>;
};

type PopfeedCoverReviewAction = 'approve' | 'hide';

let popfeedOverrideSessionCache: CachedAtprotoSession | null = null;
let popfeedOverrideSessionPromise: Promise<AtprotoSession> | null = null;

function getConfiguredRepoIdentifier() {
	return (
		String(
			env.ATPROTO_REPO ||
				process.env.ATPROTO_REPO ||
				env.STANDARD_SITE_IDENTIFIER ||
				env.ATPROTO_IDENTIFIER ||
				env.ATP_IDENTIFIER ||
				DEFAULT_REPO
		)
			.trim()
			.replace(/\/+$/, '') || DEFAULT_REPO
	);
}

function getConfiguredServiceUrl() {
	return String(
		env.STANDARD_SITE_PDS_URL || env.ATPROTO_PDS_URL || env.PDS_URL || env.ATP_BASE_URL || ''
	)
		.trim()
		.replace(/\/+$/, '');
}

function getConfiguredLoginIdentifiers(repoIdentifier = getConfiguredRepoIdentifier()) {
	return [
		env.STANDARD_SITE_LOGIN_IDENTIFIER,
		env.ATPROTO_LOGIN_IDENTIFIER,
		env.ATP_LOGIN_IDENTIFIER,
		env.STANDARD_SITE_EMAIL,
		env.ATPROTO_EMAIL,
		env.ATP_EMAIL,
		env.STANDARD_SITE_IDENTIFIER,
		env.ATPROTO_IDENTIFIER,
		env.ATP_IDENTIFIER,
		env.ATPROTO_REPO,
		process.env.ATPROTO_REPO,
		repoIdentifier,
		DEFAULT_REPO
	]
		.map((value) => String(value || '').trim())
		.filter(Boolean)
		.filter((value, index, values) => values.indexOf(value) === index);
}

function formatSessionCreationError(
	identifiers: string[],
	lastStatus: number | null,
	lastIdentifier: string | null
) {
	const tried = identifiers.join(', ');

	if (lastStatus === 401) {
		return `ATProto session creation failed with 401 for ${lastIdentifier || 'the configured identifiers'}. Tried: ${tried}. If this app password authenticates with an email, set STANDARD_SITE_LOGIN_IDENTIFIER to that login value.`;
	}

	if (lastStatus) {
		return `ATProto session creation failed with ${lastStatus} for ${lastIdentifier || 'the configured identifiers'}. Tried: ${tried}.`;
	}

	return `ATProto session creation failed for the configured identifiers. Tried: ${tried}.`;
}

function getConfiguredAppPassword() {
	return String(
		env.STANDARD_SITE_APP_PASSWORD || env.ATPROTO_APP_PASSWORD || env.ATP_APP_PASSWORD || ''
	).trim();
}

async function getConfiguredRepoIdentity() {
	const repoIdentifier = getConfiguredRepoIdentifier();
	const configuredServiceUrl = getConfiguredServiceUrl();

	try {
		return {
			repoIdentifier,
			...(await resolveAtprotoService(repoIdentifier))
		};
	} catch (error) {
		if (!configuredServiceUrl) {
			throw error;
		}

		return {
			repoIdentifier,
			did: await resolveAtprotoDid(repoIdentifier),
			serviceUrl: configuredServiceUrl
		};
	}
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

function isOpenLibraryCoverUrl(url: string) {
	return /^https:\/\/covers\.openlibrary\.org\//i.test(normalizeString(url));
}

export function isUntrustedBookCoverUrl(url: string | null | undefined) {
	const normalized = normalizeString(url);
	return (
		Boolean(normalized) && (looksLikeIsbnDbCover(normalized) || isOpenLibraryCoverUrl(normalized))
	);
}

export function getOpenLibraryBookSearchUrl(identifiers: Record<string, string>) {
	const isbn = normalizeString(identifiers.isbn13 || identifiers.isbn10);
	return isbn ? `https://openlibrary.org/search?isbn=${encodeURIComponent(isbn)}` : null;
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

	const creativeWorkType = normalizeOptionalString(value.creativeWorkType);
	const image = getObject(value.image);
	const provider = normalizeOptionalString(image.provider);
	const explicitStatus = normalizeString(value.status).toLowerCase();
	const status =
		explicitStatus === 'approved' || explicitStatus === 'pending' || explicitStatus === 'hidden'
			? (explicitStatus as PopfeedImageOverrideStatus)
			: creativeWorkType === 'book' && provider === 'openlibrary'
				? 'pending'
				: 'approved';
	const imageUrl = resolveBlobImageUrl(value.image, serviceUrl, did);

	if (!imageUrl && status !== 'hidden') {
		return null;
	}

	return {
		uri: normalizeString(record.uri),
		rkey: getRecordKey(record.uri),
		record: value,
		sourceUri,
		imageUrl: imageUrl || null,
		originalUrl: normalizeOptionalString(image.originalUrl),
		provider,
		syncedAt: normalizeOptionalString(getObject(value.provenance).syncedAt),
		status,
		title: normalizeOptionalString(value.title),
		creativeWorkType,
		sourceImageUrl: normalizeOptionalString(getObject(value.provenance).sourceImageUrl),
		queueReason: normalizeOptionalString(getObject(value.review).queueReason)
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
	const repoIdentifier = getConfiguredRepoIdentifier();
	const identifiers = getConfiguredLoginIdentifiers(repoIdentifier);
	const password = getConfiguredAppPassword();

	if (!repoIdentifier || !identifiers.length || !password) {
		throw new Error(
			'Popfeed override credentials are incomplete. Set STANDARD_SITE_APP_PASSWORD plus a repo or login identifier.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await getConfiguredRepoIdentity();

	if (
		popfeedOverrideSessionCache &&
		popfeedOverrideSessionCache.expiresAt > Date.now() &&
		popfeedOverrideSessionCache.serviceUrl === serviceUrl &&
		identifiers.includes(popfeedOverrideSessionCache.identifier)
	) {
		return popfeedOverrideSessionCache;
	}

	if (popfeedOverrideSessionPromise) {
		return await popfeedOverrideSessionPromise;
	}

	popfeedOverrideSessionPromise = (async () => {
		let lastError: Error | null = null;
		let lastStatus: number | null = null;
		let lastIdentifier: string | null = null;

		for (const identifier of identifiers) {
			try {
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
					lastStatus = response.status;
					lastIdentifier = identifier;
					lastError = new Error(
						formatSessionCreationError(identifiers, lastStatus, lastIdentifier)
					);
					continue;
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
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('ATProto session creation failed');
			}
		}

		throw (
			lastError || new Error(formatSessionCreationError(identifiers, lastStatus, lastIdentifier))
		);
	})();

	try {
		return await popfeedOverrideSessionPromise;
	} finally {
		popfeedOverrideSessionPromise = null;
	}
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

function buildOverrideRecord(
	item: PopfeedItem,
	{
		status,
		queueReason,
		existing,
		clearImage = false
	}: {
		status: PopfeedImageOverrideStatus;
		queueReason?: string | null;
		existing?: Record<string, unknown> | null;
		clearImage?: boolean;
	}
): Record<string, unknown> {
	const existingRecord = getObject(existing);
	const existingImage = getObject(existingRecord.image);
	const existingReview = getObject(existingRecord.review);
	const nextImage = !clearImage && Object.keys(existingImage).length ? existingImage : null;
	const previousQueueReason = normalizeOptionalString(existingReview.queueReason);
	const reviewQueueReason = normalizeOptionalString(queueReason) || previousQueueReason;
	const now = new Date().toISOString();

	return {
		$type: PDS_POPFEED_OVERRIDE_COLLECTION,
		sourceUri: item.uri,
		sourceCollection: 'social.popfeed.feed.listItem',
		creativeWorkType: item.type,
		title: item.title,
		status,
		...(Object.keys(normalizeIdentifiers(item.identifiers)).length
			? { identifiers: normalizeIdentifiers(item.identifiers) }
			: {}),
		...(nextImage ? { image: nextImage } : {}),
		provenance: {
			syncedAt: now,
			...(item.sourcePosterImage || item.posterImage
				? { sourceImageUrl: item.sourcePosterImage || item.posterImage }
				: {})
		},
		review: {
			...(reviewQueueReason ? { queueReason: reviewQueueReason } : {}),
			...(status === 'pending'
				? { queuedAt: normalizeOptionalString(existingReview.queuedAt) || now }
				: {}),
			...(status !== 'pending' ? { reviewedAt: now } : {})
		}
	};
}

export async function getPopfeedImageOverrides() {
	return (await getOverrideSnapshot()).overrides;
}

export function clearPopfeedImageOverrideCache(repo = getConfiguredRepoIdentifier()) {
	getOverrideCache().delete(repo);
}

export async function getPopfeedBookCoverReviewQueue({
	items = [],
	limit = null
}: {
	items?: PopfeedItem[];
	limit?: number | null;
}): Promise<PopfeedBookCoverReviewQueue> {
	const books = items.filter((item) => item.type === 'book');
	const normalizedLimit =
		typeof limit === 'number' && Number.isFinite(limit) && limit >= 0 ? limit : null;
	const overrides = await getPopfeedImageOverrides();
	const queued = books.filter((item) => {
		const override = overrides.get(item.uri);
		if (override?.status === 'approved' && override.imageUrl) {
			return false;
		}
		if (override?.status === 'hidden') {
			return false;
		}

		const sourceImageUrl = normalizeOptionalString(item.sourcePosterImage || item.posterImage);
		return Boolean(
			(override?.status === 'pending' && override.imageUrl) ||
			isUntrustedBookCoverUrl(sourceImageUrl) ||
			!sourceImageUrl
		);
	});
	const slice = typeof normalizedLimit === 'number' ? queued.slice(0, normalizedLimit) : queued;

	return {
		total: queued.length,
		items: slice.map((item) => {
			const override = overrides.get(item.uri);
			const isbn = normalizeOptionalString(item.identifiers.isbn13 || item.identifiers.isbn10);
			return {
				sourceUri: item.uri,
				title: item.title,
				author: normalizeOptionalString(item.mainCredit),
				localPath: item.localPath,
				isbn,
				sourceImageUrl: normalizeOptionalString(item.sourcePosterImage || item.posterImage),
				candidateImageUrl: override?.status === 'pending' ? override.imageUrl : null,
				candidateProvider: override?.status === 'pending' ? override.provider : null,
				queueReason:
					override?.queueReason ||
					(override?.status === 'pending' && override.imageUrl
						? 'Best fix: replace the poster in Popfeed. This queued fallback is only here if you need a temporary replacement.'
						: item.posterImage
							? 'Current Popfeed cover is untrusted, so the site hides it until you replace the poster in Popfeed.'
							: 'No trusted cover is available yet. Add a poster in Popfeed, then refresh this queue.'),
				openLibraryUrl: getOpenLibraryBookSearchUrl(item.identifiers)
			};
		})
	};
}

export async function reviewPopfeedBookCoverOverride({
	sourceUri,
	action,
	items = []
}: {
	sourceUri: string;
	action: PopfeedCoverReviewAction;
	items?: PopfeedItem[];
}) {
	const normalizedSourceUri = normalizeString(sourceUri);

	if (!normalizedSourceUri) {
		throw new Error('A Popfeed source URI is required.');
	}

	if (action !== 'approve' && action !== 'hide') {
		throw new Error('Unsupported cover review action.');
	}

	const item = items.find((entry) => entry.uri === normalizedSourceUri);

	if (!item) {
		throw new Error('Unable to find the matching Popfeed item for this cover review.');
	}

	const overrides = await getPopfeedImageOverrides();
	const existing = overrides.get(normalizedSourceUri);

	if (action === 'approve' && !existing?.imageUrl) {
		throw new Error('There is no queued candidate image to approve for this book.');
	}

	const session = await createSession();
	await putRecord(
		session,
		PDS_POPFEED_OVERRIDE_COLLECTION,
		existing?.rkey || getRecordKey(item.uri) || item.slug,
		buildOverrideRecord(item, {
			status: action === 'approve' ? 'approved' : 'hidden',
			existing: existing?.record || null
		})
	);

	clearPopfeedImageOverrideCache();
}

export async function syncPopfeedBookCoverOverrides({
	items = [],
	limit = null,
	offset = null,
	force = false
}: PopfeedCoverSyncOptions): Promise<PopfeedCoverSyncResult> {
	const books = items.filter((item) => item.type === 'book');
	const normalizedLimit =
		typeof limit === 'number' && Number.isFinite(limit) && limit >= 0 ? limit : null;
	const normalizedOffset =
		typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 ? offset : 0;
	const selectedBooks =
		typeof normalizedLimit === 'number'
			? books.slice(normalizedOffset, normalizedOffset + normalizedLimit)
			: normalizedOffset > 0
				? books.slice(normalizedOffset)
				: books;
	const existingOverrides = await getPopfeedImageOverrides();
	const session = await createSession();
	const repo = getConfiguredRepoIdentifier();
	const result: PopfeedCoverSyncResult = {
		ok: true,
		repo,
		did: session.did,
		serviceUrl: session.serviceUrl,
		limit: normalizedLimit,
		offset: normalizedOffset,
		nextOffset:
			typeof normalizedLimit === 'number' &&
			normalizedLimit > 0 &&
			normalizedOffset + normalizedLimit < books.length
				? normalizedOffset + normalizedLimit
				: null,
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
		const existingOverride = existingOverrides.get(item.uri);
		const hasLockedDecision =
			existingOverride?.status === 'approved' || existingOverride?.status === 'hidden';
		const hasPendingCandidate = existingOverride?.status === 'pending';
		const needsReplacement = !sourceCoverUrl || isUntrustedBookCoverUrl(sourceCoverUrl);

		if (hasLockedDecision) {
			result.books.skipped += 1;
			continue;
		}

		if (!force && hasPendingCandidate) {
			result.books.skipped += 1;
			continue;
		}

		if (!needsReplacement) {
			result.books.skipped += 1;
			continue;
		}

		result.books.attempted += 1;

		try {
			await putRecord(
				session,
				PDS_POPFEED_OVERRIDE_COLLECTION,
				existingOverride?.rkey || getRecordKey(item.uri) || item.slug,
				buildOverrideRecord(item, {
					status: 'pending',
					queueReason: sourceCoverUrl
						? 'Current Popfeed cover is untrusted. Replace the poster in Popfeed, then refresh this queue.'
						: 'No trusted poster is available. Add one in Popfeed, then refresh this queue.',
					existing: existingOverride?.record || null,
					clearImage: true
				})
			);
			result.books.imported += 1;
		} catch (error) {
			result.ok = false;
			result.books.failed += 1;
			result.errors.push({
				slug: item.slug,
				title: item.title,
				message: error instanceof Error ? error.message : 'Unable to queue book cover review.'
			});
		}
	}

	clearPopfeedImageOverrideCache(repo);
	return result;
}
