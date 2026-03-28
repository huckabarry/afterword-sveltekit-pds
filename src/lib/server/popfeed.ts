import { env } from '$env/dynamic/private';
import { resolveAtprotoService } from '$lib/server/atproto-identity';
import {
	getOpenLibraryBookSearchUrl,
	getPopfeedImageOverrides,
	isUntrustedBookCoverUrl
} from '$lib/server/pds-popfeed-overrides';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
const POPFEED_ITEM_COLLECTION = 'social.popfeed.feed.listItem';
const POPFEED_LIST_COLLECTION = 'social.popfeed.feed.list';
const POPFEED_CACHE_TTL_MS = 1000 * 60 * 10;

export type PopfeedItemType = 'book' | 'movie' | 'tv_show';

export type PopfeedLink = {
	label: string;
	url: string;
};

export type PopfeedItem = {
	id: string;
	uri: string;
	cid: string;
	slug: string;
	type: PopfeedItemType;
	section: 'books' | 'movies' | 'shows';
	sectionLabel: 'Books' | 'Movies' | 'Shows';
	localPath: string;
	title: string;
	mainCredit: string;
	mainCreditRole: string;
	genres: string[];
	listUri: string;
	listName: string;
	listDescription: string;
	listType: string;
	listTypeLabel: string;
	addedAt: Date | null;
	releaseDate: Date | null;
	date: Date;
	displayDate: string;
	posterImage: string | null;
	sourcePosterImage: string | null;
	backdropUrl: string | null;
	identifiers: Record<string, string>;
	links: PopfeedLink[];
};

type PopfeedListRecord = {
	name: string;
	description: string;
	listType: string;
};

type PopfeedCacheEntry = {
	expiresAt: number;
	items: PopfeedItem[];
};

function getRepo() {
	return (
		(process.env.ATPROTO_REPOS || process.env.ATPROTO_REPO || env.ATPROTO_REPO || DEFAULT_REPO)
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean)[0] || DEFAULT_REPO
	);
}

function getPopfeedCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordPopfeedCache?: Map<string, PopfeedCacheEntry>;
	};

	if (!scope.__afterwordPopfeedCache) {
		scope.__afterwordPopfeedCache = new Map<string, PopfeedCacheEntry>();
	}

	return scope.__afterwordPopfeedCache;
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

function formatDisplayDate(date: Date) {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

function getBlobUrl(serviceUrl: string, did: string, cid: string) {
	return `${serviceUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

function normalizeDate(value: unknown) {
	const normalized = String(value || '').trim();

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
	switch (
		String(value || '')
			.trim()
			.toLowerCase()
	) {
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

	if (type === 'book') {
		const openLibraryUrl = getOpenLibraryBookSearchUrl(identifiers);

		if (openLibraryUrl) {
			links.push({
				label: 'Open Library',
				url: openLibraryUrl
			});
		}

		return links;
	}

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

	return links;
}

function getDedupKey(item: PopfeedItem) {
	if (item.type === 'book') {
		const isbn = item.identifiers.isbn13 || item.identifiers.isbn10;
		if (isbn) {
			return `${item.type}:isbn:${isbn}`;
		}
	}

	if (item.type === 'movie' || item.type === 'tv_show') {
		if (item.identifiers.tmdbId) {
			return `${item.type}:tmdb:${item.identifiers.tmdbId}`;
		}

		if (item.identifiers.imdbId) {
			return `${item.type}:imdb:${item.identifiers.imdbId}`;
		}
	}

	return `${item.type}:${slugify(item.title)}:${slugify(item.mainCredit)}`;
}

async function fetchCollectionRecords(serviceUrl: string, did: string, collection: string) {
	const records: Array<Record<string, unknown>> = [];
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

		const response = await fetch(
			`${serviceUrl}/xrpc/com.atproto.repo.listRecords?${params.toString()}`,
			{
				headers: { accept: 'application/json' }
			}
		);

		if (!response.ok) {
			throw new Error(`${collection} request failed with ${response.status}`);
		}

		const data = (await response.json()) as {
			cursor?: string;
			records?: Array<Record<string, unknown>>;
		};

		records.push(...(data.records || []));
		cursor = String(data.cursor || '').trim();

		if (!cursor) {
			return records;
		}
	}
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

function normalizeLists(records: Array<Record<string, unknown>>) {
	return new Map<string, PopfeedListRecord>(
		records.map((record) => {
			const value = (record.value as Record<string, unknown>) || {};
			return [
				String(record.uri || ''),
				{
					name: String(value.name || '').trim(),
					description: String(value.description || '').trim(),
					listType: String(value.listType || '').trim()
				}
			];
		})
	);
}

function normalizeItem(
	record: Record<string, unknown>,
	did: string,
	serviceUrl: string,
	listsByUri: Map<string, PopfeedListRecord>
): PopfeedItem | null {
	const value = (record.value as Record<string, unknown>) || {};
	const type = String(value.creativeWorkType || '').trim() as PopfeedItemType;

	if (type !== 'book' && type !== 'movie' && type !== 'tv_show') {
		return null;
	}

	const { section, sectionLabel } = getSection(type);
	const id = getRecordKey(String(record.uri || ''));
	const title = String(value.title || 'Untitled').trim() || 'Untitled';
	const mainCredit = String(value.mainCredit || '').trim();
	const mainCreditRole = String(value.mainCreditRole || '').trim();
	const genres = normalizeStringArray(value.genres);
	const listUri = String(value.listUri || '').trim();
	const list = listsByUri.get(listUri);
	const listType = String(value.listType || list?.listType || '').trim();
	const listTypeLabel = naturalListTypeLabel(listType);
	const identifiers = normalizeIdentifiers(value.identifiers);
	const addedAt = normalizeDate(value.addedAt);
	const releaseDate = normalizeDate(value.releaseDate);
	const date = addedAt || releaseDate || new Date(0);
	const posterRef = getBlobRefLink(value.poster);
	const slug = `${slugify(title)}-${id}`;
	const posterImage =
		(posterRef ? getBlobUrl(serviceUrl, did, posterRef) : null) ||
		String(value.posterUrl || '').trim();

	return {
		id,
		uri: String(record.uri || '').trim(),
		cid: String(record.cid || '').trim(),
		slug,
		type,
		section,
		sectionLabel,
		localPath: `/${section}/${slug}`,
		title,
		mainCredit,
		mainCreditRole,
		genres,
		listUri,
		listName: String(list?.name || '').trim(),
		listDescription: String(list?.description || '').trim(),
		listType,
		listTypeLabel,
		addedAt,
		releaseDate,
		date,
		displayDate: formatDisplayDate(date),
		posterImage,
		sourcePosterImage: posterImage,
		backdropUrl: String(value.backdropUrl || '').trim() || null,
		identifiers,
		links: getPopfeedLinks(type, identifiers)
	};
}

export async function getPopfeedBaseItems(): Promise<PopfeedItem[]> {
	const repo = getRepo();
	const cache = getPopfeedCache();
	const cached = cache.get(repo);

	if (cached && cached.expiresAt > Date.now()) {
		return cached.items;
	}

	try {
		const { did, serviceUrl } = await resolveAtprotoService(repo);
		const [listCollectionRecords, itemCollectionRecords] = await Promise.all([
			fetchCollectionRecords(serviceUrl, did, POPFEED_LIST_COLLECTION),
			fetchCollectionRecords(serviceUrl, did, POPFEED_ITEM_COLLECTION)
		]);
		const listsByUri = normalizeLists(listCollectionRecords);
		const items = itemCollectionRecords
			.map((record) => normalizeItem(record, did, serviceUrl, listsByUri))
			.filter((item): item is PopfeedItem => Boolean(item))
			.filter((item) => item.listType !== 'to_read_books')
			.sort((left, right) => {
				const dateDelta = right.date.getTime() - left.date.getTime();
				if (dateDelta !== 0) {
					return dateDelta;
				}

				return left.title.localeCompare(right.title);
			});
		const seen = new Set<string>();
		const deduped = items.filter((item) => {
			const key = getDedupKey(item);

			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});

		cache.set(repo, {
			expiresAt: Date.now() + POPFEED_CACHE_TTL_MS,
			items: deduped
		});

		return deduped;
	} catch (error) {
		console.warn('[popfeed] Unable to fetch records:', error);
		return [];
	}
}

export async function getPopfeedItems(): Promise<PopfeedItem[]> {
	const items = await getPopfeedBaseItems();

	const applyCoverRules = (overrides: Awaited<ReturnType<typeof getPopfeedImageOverrides>>) =>
		items.map((item) => {
			const override = overrides.get(item.uri);
			const hasTrustedBookPoster =
				item.type === 'book' &&
				Boolean(item.posterImage) &&
				!isUntrustedBookCoverUrl(item.posterImage);

			if (override?.status === 'hidden') {
				if (hasTrustedBookPoster) {
					return item;
				}

				return item.posterImage
					? {
							...item,
							posterImage: null
						}
					: item;
			}

			if (override?.status === 'approved' && override.imageUrl) {
				return override.imageUrl === item.posterImage
					? item
					: {
							...item,
							posterImage: override.imageUrl
						};
			}

			if (item.type === 'book' && isUntrustedBookCoverUrl(item.posterImage)) {
				return {
					...item,
					posterImage: null
				};
			}

			return item;
		});

	try {
		const overrides = await getPopfeedImageOverrides();

		return applyCoverRules(overrides);
	} catch (error) {
		console.warn('[popfeed] Unable to apply override images:', error);
		return applyCoverRules(new Map());
	}
}

export async function getPopfeedItemsByType(type: PopfeedItemType) {
	const items = await getPopfeedItems();
	return items.filter((item) => item.type === type);
}

export async function getPopfeedItemBySlug(type: PopfeedItemType, slug: string) {
	const items = await getPopfeedItemsByType(type);
	return items.find((item) => item.slug === slug) || null;
}
