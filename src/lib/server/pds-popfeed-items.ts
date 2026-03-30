import { env } from '$env/dynamic/private';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';
import type { PopfeedItem, PopfeedItemType, PopfeedLink } from '$lib/server/popfeed';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
export const PDS_POPFEED_ITEM_COLLECTION = 'blog.afterword.media.popfeedItem';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const LIST_RECORDS_NSID = 'com.atproto.repo.listRecords';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const PDS_POPFEED_ITEM_CACHE_TTL_MS = 1000 * 60 * 10;

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

type CanonicalPopfeedCacheEntry = {
	expiresAt: number;
	items: PopfeedItem[];
};

type CanonicalPopfeedRecord = {
	uri: string;
	rkey: string;
	cid: string;
	record: Record<string, unknown>;
	item: PopfeedItem;
};

let popfeedItemSessionCache: CachedAtprotoSession | null = null;
let popfeedItemSessionPromise: Promise<AtprotoSession> | null = null;

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

function getCanonicalCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordCanonicalPopfeedCache?: Map<string, CanonicalPopfeedCacheEntry>;
	};

	if (!scope.__afterwordCanonicalPopfeedCache) {
		scope.__afterwordCanonicalPopfeedCache = new Map<string, CanonicalPopfeedCacheEntry>();
	}

	return scope.__afterwordCanonicalPopfeedCache;
}

function getRecordKey(uri: string | undefined | null) {
	return (
		String(uri || '')
			.split('/')
			.pop() || ''
	);
}

function slugify(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/['".,!?()[\]{}:;]+/g, '')
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'item'
	);
}

function normalizeString(value: unknown) {
	return String(value || '').trim();
}

function normalizeOptionalString(value: unknown) {
	const normalized = normalizeString(value);
	return normalized || null;
}

function normalizeDate(value: unknown) {
	const normalized = normalizeString(value);

	if (!normalized) {
		return null;
	}

	const parsed = new Date(normalized);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStringArray(value: unknown) {
	return Array.isArray(value)
		? value.map((entry) => String(entry || '').trim()).filter(Boolean)
		: [];
}

function normalizeIdentifiers(value: unknown) {
	if (!value || typeof value !== 'object') {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).flatMap(([key, entry]) => {
			const normalized = String(entry || '').trim();
			return normalized ? [[key, normalized]] : [];
		})
	);
}

function titleCase(value: string) {
	return String(value || '')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function naturalListTypeLabel(value: string) {
	switch (String(value || '').trim().toLowerCase()) {
		case 'read_books':
			return 'Read';
		case 'to_read_books':
			return 'Want to Read';
		case 'currently_reading_books':
			return 'Currently Reading';
		case 'watched_movies':
		case 'watched_tv_shows':
			return 'Watched';
		case 'movie_watchlist':
			return 'Watchlist';
		case 'default':
			return 'Logged';
		default:
			return titleCase(value);
	}
}

function getActivityMetadata(value: string) {
	switch (String(value || '').trim().toLowerCase()) {
		case 'read_books':
			return {
				label: 'Finished reading',
				dateLabel: 'Finished'
			};
		case 'currently_reading_books':
			return {
				label: 'Started reading',
				dateLabel: 'Started'
			};
		case 'to_read_books':
			return {
				label: 'Added to reading list',
				dateLabel: 'Added'
			};
		case 'watched_movies':
		case 'watched_tv_shows':
			return {
				label: 'Watched',
				dateLabel: 'Watched'
			};
		case 'movie_watchlist':
			return {
				label: 'Added to watchlist',
				dateLabel: 'Added'
			};
		case 'ratings':
		case 'rated':
			return {
				label: 'Rated',
				dateLabel: 'Rated'
			};
		case 'favorites':
		case 'favourites':
			return {
				label: 'Added to favorites',
				dateLabel: 'Added'
			};
		default: {
			const fallback = naturalListTypeLabel(value);
			return {
				label: fallback,
				dateLabel: 'Updated'
			};
		}
	}
}

function getSection(type: PopfeedItemType) {
	switch (type) {
		case 'book':
			return {
				section: 'books' as const,
				sectionLabel: 'Books' as const
			};
		case 'tv_show':
			return {
				section: 'shows' as const,
				sectionLabel: 'Shows' as const
			};
		default:
			return {
				section: 'movies' as const,
				sectionLabel: 'Movies' as const
			};
	}
}

function getPopfeedLinks(type: PopfeedItemType, identifiers: Record<string, string>) {
	const links: PopfeedLink[] = [];

	if (type !== 'book') {
		const tmdbId = identifiers.tmdbId;
		if (tmdbId) {
			links.push({
				label: 'TMDB',
				url: `https://www.themoviedb.org/${type === 'tv_show' ? 'tv' : 'movie'}/${encodeURIComponent(tmdbId)}`
			});
		}

		const imdbId = identifiers.imdbId;
		if (imdbId) {
			links.push({
				label: 'IMDb',
				url: `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/`
			});
		}
	}

	return links;
}

function formatDisplayDate(date: Date) {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

function getCanonicalDate(record: Record<string, unknown>) {
	return (
		normalizeDate(record.activityAt) ||
		normalizeDate(record.completedAt) ||
		normalizeDate(record.startedAt) ||
		normalizeDate(record.addedAt) ||
		normalizeDate(record.releaseDate) ||
		new Date(0)
	);
}

function normalizeCanonicalRecord(raw: RawAtprotoRecord): CanonicalPopfeedRecord | null {
	const value = (raw.value as Record<string, unknown>) || {};
	const type = normalizeString(value.creativeWorkType) as PopfeedItemType;

	if (type !== 'book' && type !== 'movie' && type !== 'tv_show') {
		return null;
	}

	const sourceUri = normalizeString(value.sourceUri);

	if (!sourceUri) {
		return null;
	}

	const { section, sectionLabel } = getSection(type);
	const title = normalizeString(value.title) || 'Untitled';
	const mainCredit = normalizeString(value.mainCredit);
	const mainCreditRole = normalizeString(value.mainCreditRole);
	const genres = normalizeStringArray(value.genres);
	const listType = normalizeString(value.listType);
	const listTypeLabel = naturalListTypeLabel(listType);
	const activity = getActivityMetadata(listType);
	const identifiers = normalizeIdentifiers(value.identifiers);
	const activityAt = normalizeDate(value.activityAt);
	const completedAt = normalizeDate(value.completedAt);
	const startedAt = normalizeDate(value.startedAt);
	const addedAt = normalizeDate(value.addedAt);
	const releaseDate = normalizeDate(value.releaseDate);
	const date = getCanonicalDate(value);
	const displayDate = formatDisplayDate(date);
	const slug = `${slugify(title)}-${getRecordKey(sourceUri)}`;

	const item: PopfeedItem = {
		id: getRecordKey(sourceUri),
		uri: sourceUri,
		cid: normalizeString(raw.cid),
		slug,
		type,
		section,
		sectionLabel,
		localPath: `/${section}/${slug}`,
		title,
		mainCredit,
		mainCreditRole,
		genres,
		listUri: normalizeString(value.listUri),
		listName: normalizeString(value.listName),
		listDescription: normalizeString(value.listDescription),
		listType,
		listTypeLabel,
		activityLabel: activity.label,
		activityDateLabel: activity.dateLabel,
		addedAt,
		activityAt,
		startedAt,
		completedAt,
		releaseDate,
		date,
		displayDate,
		activityDisplayDate: activityAt ? formatDisplayDate(activityAt) : addedAt ? formatDisplayDate(addedAt) : null,
		posterImage: normalizeOptionalString(value.posterImage),
		sourcePosterImage: normalizeOptionalString(value.sourcePosterImage) || normalizeOptionalString(value.posterImage),
		backdropUrl: normalizeOptionalString(value.backdropUrl),
		identifiers,
		links: getPopfeedLinks(type, identifiers)
	};

	return {
		uri: normalizeString(raw.uri),
		rkey: getRecordKey(sourceUri),
		cid: normalizeString(raw.cid),
		record: value,
		item
	};
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
			headers: { accept: 'application/json' }
		});

		if (!response.ok) {
			throw new Error(`${collection} request failed with ${response.status}`);
		}

		const data = (await response.json()) as {
			cursor?: string;
			records?: RawAtprotoRecord[];
		};

		records.push(...(data.records || []));
		cursor = normalizeString(data.cursor);

		if (!cursor) {
			return records;
		}
	}
}

function formatSessionCreationError(
	identifiers: string[],
	lastStatus: number | null,
	lastIdentifier: string | null
) {
	const tried = identifiers.join(', ');

	if (lastStatus === 401) {
		return `ATProto session creation failed with 401 for ${lastIdentifier || 'the configured identifiers'}. Tried: ${tried}.`;
	}

	if (lastStatus) {
		return `ATProto session creation failed with ${lastStatus} for ${lastIdentifier || 'the configured identifiers'}. Tried: ${tried}.`;
	}

	return `ATProto session creation failed for the configured identifiers. Tried: ${tried}.`;
}

async function createSession(): Promise<AtprotoSession> {
	const repoIdentifier = getConfiguredRepoIdentifier();
	const identifiers = getConfiguredLoginIdentifiers(repoIdentifier);
	const password = getConfiguredAppPassword();

	if (!repoIdentifier || !identifiers.length || !password) {
		throw new Error(
			'Popfeed item sync credentials are incomplete. Set STANDARD_SITE_APP_PASSWORD plus a repo or login identifier.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await getConfiguredRepoIdentity();

	if (
		popfeedItemSessionCache &&
		popfeedItemSessionCache.expiresAt > Date.now() &&
		popfeedItemSessionCache.serviceUrl === serviceUrl &&
		identifiers.includes(popfeedItemSessionCache.identifier)
	) {
		return popfeedItemSessionCache;
	}

	if (popfeedItemSessionPromise) {
		return await popfeedItemSessionPromise;
	}

	popfeedItemSessionPromise = (async () => {
		let lastError: Error | null = null;
		let lastStatus: number | null = null;
		let lastIdentifier: string | null = null;

		for (const identifier of identifiers) {
			try {
				const response = await fetch(`${serviceUrl}/xrpc/${CREATE_SESSION_NSID}`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ identifier, password })
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
				popfeedItemSessionCache = session;
				return session;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('ATProto session creation failed');
			}
		}

		throw lastError || new Error(formatSessionCreationError(identifiers, lastStatus, lastIdentifier));
	})();

	try {
		return await popfeedItemSessionPromise;
	} finally {
		popfeedItemSessionPromise = null;
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
		throw new Error(`ATProto putRecord failed for ${collection}/${rkey}: ${response.status} ${text}`);
	}

	return (await response.json()) as { uri?: string; cid?: string };
}

function isCompletionListType(listType: string) {
	return listType === 'watched_movies' || listType === 'watched_tv_shows' || listType === 'read_books';
}

function isStartListType(listType: string) {
	return listType === 'currently_reading_books';
}

function buildCanonicalRecord(source: PopfeedItem, existing: CanonicalPopfeedRecord | null) {
	const now = new Date().toISOString();
	const existingRecord = existing?.record || {};
	const listChanged = normalizeString(existingRecord.listType) !== source.listType;
	const sourceAddedAt = source.addedAt?.toISOString() || null;
	let startedAt = normalizeOptionalString(existingRecord.startedAt);
	let completedAt = normalizeOptionalString(existingRecord.completedAt);
	let activityAt = normalizeOptionalString(existingRecord.activityAt);

	if (!existing) {
		if (isStartListType(source.listType)) {
			startedAt = sourceAddedAt || now;
		}

		if (isCompletionListType(source.listType)) {
			completedAt = sourceAddedAt || now;
		}

		activityAt = completedAt || startedAt || sourceAddedAt || now;
	} else if (listChanged) {
		if (isStartListType(source.listType)) {
			startedAt = now;
		}

		if (isCompletionListType(source.listType)) {
			completedAt = now;
		}

		activityAt = completedAt || startedAt || sourceAddedAt || now;
	} else {
		activityAt = activityAt || completedAt || startedAt || sourceAddedAt || now;
	}

	const record = {
		$type: PDS_POPFEED_ITEM_COLLECTION,
		sourceUri: source.uri,
		sourceCollection: 'social.popfeed.feed.listItem',
		sourceCid: source.cid,
		title: source.title,
		creativeWorkType: source.type,
		mainCredit: source.mainCredit || null,
		mainCreditRole: source.mainCreditRole || null,
		genres: source.genres,
		listUri: source.listUri || null,
		listName: source.listName || null,
		listDescription: source.listDescription || null,
		listType: source.listType,
		identifiers: normalizeIdentifiers(source.identifiers),
		addedAt: sourceAddedAt,
		startedAt,
		completedAt,
		activityAt,
		releaseDate: source.releaseDate?.toISOString() || null,
		posterImage: source.posterImage || null,
		sourcePosterImage: source.sourcePosterImage || source.posterImage || null,
		backdropUrl: source.backdropUrl || null,
		createdAt: normalizeOptionalString(existingRecord.createdAt) || now,
		updatedAt: !existing || listChanged ? now : normalizeOptionalString(existingRecord.updatedAt) || now
	} satisfies Record<string, unknown>;

	return record;
}

function shouldUpdateCanonicalRecord(
	existing: CanonicalPopfeedRecord | null,
	record: Record<string, unknown>
) {
	if (!existing) {
		return true;
	}

	const left = JSON.stringify(existing.record);
	const right = JSON.stringify(record);
	return left !== right;
}

async function getCanonicalSnapshot() {
	const repo = getConfiguredRepoIdentifier();
	const cache = getCanonicalCache();
	const cached = cache.get(repo);

	if (cached && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	try {
		const { did, serviceUrl } = await resolveAtprotoService(repo);
		const records = await fetchCollectionRecords(serviceUrl, did, PDS_POPFEED_ITEM_COLLECTION);
		const items = records
			.map(normalizeCanonicalRecord)
			.filter((record): record is CanonicalPopfeedRecord => Boolean(record))
			.map((record) => record.item);

		cache.set(repo, {
			expiresAt: Date.now() + PDS_POPFEED_ITEM_CACHE_TTL_MS,
			items
		});

		return items;
	} catch (error) {
		console.warn('[popfeed] Unable to fetch canonical popfeed items:', error);
		return [];
	}
}

export async function getCanonicalPopfeedItems(sourceItems: PopfeedItem[]): Promise<PopfeedItem[]> {
	const repo = getConfiguredRepoIdentifier();
	const cache = getCanonicalCache();
	const cached = cache.get(repo);

	if (cached && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	try {
		const { did, serviceUrl } = await resolveAtprotoService(repo);
		const sourceByUri = new Map(sourceItems.map((item) => [item.uri, item] as const));
		const rawCanonicalRecords = await fetchCollectionRecords(serviceUrl, did, PDS_POPFEED_ITEM_COLLECTION);
		const canonicalRecords = rawCanonicalRecords
			.map(normalizeCanonicalRecord)
			.filter((record): record is CanonicalPopfeedRecord => Boolean(record));
		const canonicalBySourceUri = new Map(
			canonicalRecords.map((record) => [record.item.uri, record] as const)
		);

		const password = getConfiguredAppPassword();

		if (password) {
			const session = await createSession();

			for (const sourceItem of sourceItems) {
				const existing = canonicalBySourceUri.get(sourceItem.uri) || null;
				const nextRecord = buildCanonicalRecord(sourceItem, existing);

				if (!shouldUpdateCanonicalRecord(existing, nextRecord)) {
					continue;
				}

				const result = await putRecord(
					session,
					PDS_POPFEED_ITEM_COLLECTION,
					getRecordKey(sourceItem.uri),
					nextRecord
				);

				const normalized = normalizeCanonicalRecord({
					uri: normalizeOptionalString(result.uri) || existing?.uri || sourceItem.uri,
					cid: normalizeOptionalString(result.cid) || existing?.cid || sourceItem.cid,
					value: nextRecord
				});

				if (normalized) {
					canonicalBySourceUri.set(sourceItem.uri, normalized);
				}
			}
		}

		const merged = sourceItems
			.map((item) => canonicalBySourceUri.get(item.uri)?.item || item)
			.sort((left, right) => right.date.getTime() - left.date.getTime());

		cache.set(repo, {
			expiresAt: Date.now() + PDS_POPFEED_ITEM_CACHE_TTL_MS,
			items: merged
		});

		return merged;
	} catch (error) {
		console.warn('[popfeed] Unable to sync canonical popfeed items:', error);
		const fallback = await getCanonicalSnapshot();

		if (fallback.length) {
			const fallbackByUri = new Map(fallback.map((item) => [item.uri, item] as const));
			return sourceItems
				.map((item) => fallbackByUri.get(item.uri) || item)
				.sort((left, right) => right.date.getTime() - left.date.getTime());
		}

		return sourceItems;
	}
}
