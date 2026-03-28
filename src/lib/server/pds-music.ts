import { env } from '$env/dynamic/private';
import { inferImageDimensions, inferImageMimeType } from '$lib/server/image-metadata';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';
import type { AlbumEntry, ListenLink, TrackEntry } from '$lib/server/music';

const DEFAULT_REPO = 'did:plc:vt4k6d3e5rjw65cuzaf3nufq';
export const PDS_MUSIC_TRACK_COLLECTION = 'blog.afterword.media.track';
export const PDS_MUSIC_ALBUM_COLLECTION = 'blog.afterword.media.album';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const LIST_RECORDS_NSID = 'com.atproto.repo.listRecords';
const UPLOAD_BLOB_NSID = 'com.atproto.repo.uploadBlob';
const PDS_MUSIC_CACHE_TTL_MS = 1000 * 60 * 10;
const IMAGE_FETCH_USER_AGENT = 'afterword-sveltekit-pds pds-music import';
const SOURCE_LABELS = {
	crucialtracks: 'Crucial Tracks',
	albumwhale: 'Album Whale',
	apple_music: 'Apple Music',
	odesli: 'Listen elsewhere',
	spotify: 'Spotify'
} as const;

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

type RawPdsMusicCacheEntry = {
	expiresAt: number;
	tracks: TrackEntry[];
	albums: AlbumEntry[];
};

type ImagePayload = {
	blob: AtprotoBlob;
	aspectRatio?: { width: number; height: number };
	originalUrl: string;
};

type MusicLinkRecord = {
	label: string;
	url: string;
	kind?: string;
	provider?: string;
};

type MusicImportOptions = {
	tracks?: TrackEntry[];
	albums?: AlbumEntry[];
	collections?: Array<'tracks' | 'albums'>;
	limit?: number | null;
	offset?: number | null;
};

type MusicImportStats = {
	available: number;
	attempted: number;
	imported: number;
	failed: number;
};

export type MusicImportResult = {
	ok: boolean;
	repo: string;
	did: string;
	serviceUrl: string;
	collections: Array<'tracks' | 'albums'>;
	limit: number | null;
	offset: number;
	nextOffset: number | null;
	tracks: MusicImportStats;
	albums: MusicImportStats;
	errors: Array<{ collection: 'tracks' | 'albums'; slug: string; message: string }>;
};

let pdsMusicSessionCache: CachedAtprotoSession | null = null;
let pdsMusicSessionPromise: Promise<AtprotoSession> | null = null;

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

function getMusicCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordPdsMusicCache?: Map<string, RawPdsMusicCacheEntry>;
	};

	if (!scope.__afterwordPdsMusicCache) {
		scope.__afterwordPdsMusicCache = new Map<string, RawPdsMusicCacheEntry>();
	}

	return scope.__afterwordPdsMusicCache;
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

function getObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
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

	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(date: Date) {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

function titleCase(value: string) {
	return String(value || '')
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getProviderLabel(provider: string) {
	const normalized = normalizeString(provider).toLowerCase();
	return SOURCE_LABELS[normalized as keyof typeof SOURCE_LABELS] || titleCase(normalized);
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

function normalizeLinkRecords(value: unknown): MusicLinkRecord[] {
	return Array.isArray(value)
		? value.flatMap((entry) => {
				const link = getObject(entry);
				const label = normalizeString(link.label);
				const url = normalizeString(link.url);

				if (!label || !url) {
					return [];
				}

				const kind = normalizeOptionalString(link.kind) || undefined;
				const provider = normalizeOptionalString(link.provider) || undefined;

				return [
					{
						label,
						url,
						...(kind ? { kind } : {}),
						...(provider ? { provider } : {})
					} satisfies MusicLinkRecord
				];
			})
		: [];
}

function getSourceLink(sourceValue: unknown) {
	const source = getObject(sourceValue);
	const url = normalizeString(source.url);

	if (!url) {
		return null;
	}

	const provider = normalizeString(source.provider).toLowerCase();
	const label = normalizeString(source.label) || getProviderLabel(provider || 'source');

	return {
		label,
		url
	} satisfies ListenLink;
}

function toListenLinks(sourceValue: unknown, linksValue: unknown) {
	const seen = new Set<string>();
	const links: ListenLink[] = [];
	const sourceLink = getSourceLink(sourceValue);

	if (sourceLink) {
		const key = `${sourceLink.label}::${sourceLink.url}`;
		seen.add(key);
		links.push(sourceLink);
	}

	for (const link of normalizeLinkRecords(linksValue)) {
		const key = `${link.label}::${link.url}`;

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		links.push({
			label: link.label,
			url: link.url
		});
	}

	return links;
}

function getLinkByProvider(links: MusicLinkRecord[], provider: string) {
	return (
		links.find((link) => normalizeString(link.provider).toLowerCase() === provider) ||
		links.find((link) => getLinkProvider(link.url, link.label) === provider)
	);
}

function getLinkByKind(links: MusicLinkRecord[], kind: string) {
	return links.find((link) => normalizeString(link.kind).toLowerCase() === kind);
}

function resolveBlobImageUrl(mediaValue: unknown, serviceUrl: string, did: string) {
	const media = getObject(mediaValue);
	const blobCid = getBlobRefLink(media.image);

	if (blobCid) {
		return getBlobUrl(serviceUrl, did, blobCid);
	}

	return normalizeOptionalString(media.url) || normalizeOptionalString(media.originalUrl) || null;
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

function normalizeTrackRecord(
	record: RawAtprotoRecord,
	serviceUrl: string,
	did: string
): TrackEntry | null {
	const value = getObject(record.value);
	const loggedAt = normalizeDate(value.loggedAt);

	if (!loggedAt) {
		return null;
	}

	const title = normalizeString(value.title) || 'Untitled';
	const artist = normalizeString(value.artist);
	const links = normalizeLinkRecords(value.links);
	const identifiers = getObject(value.identifiers);
	const playback = getObject(value.playback);
	const slug = getRecordKey(record.uri) || `${title.toLowerCase().replace(/\s+/g, '-')}`;

	return {
		id: normalizeString(record.uri) || slug,
		slug,
		title: artist ? `${title} - ${artist}` : title,
		trackTitle: title,
		artist,
		note: normalizeString(value.note),
		noteHtml: normalizeOptionalString(value.noteHtml),
		excerpt: normalizeString(value.note),
		artworkUrl: resolveBlobImageUrl(value.artwork, serviceUrl, did),
		publishedAt: loggedAt,
		displayDate: formatDisplayDate(loggedAt),
		sourceUrl: normalizeString(getObject(value.source).url),
		localPath: `/listening/${slug}`,
		appleMusicUrl:
			normalizeOptionalString(identifiers.appleMusicUrl) ||
			getLinkByProvider(links, 'apple_music')?.url ||
			null,
		playlistUrl: getLinkByKind(links, 'playlist')?.url || null,
		songlinkUrl:
			normalizeOptionalString(identifiers.songlinkUrl) ||
			getLinkByProvider(links, 'odesli')?.url ||
			null,
		previewUrl: normalizeOptionalString(playback.previewUrl),
		listenLinks: toListenLinks(value.source, value.links),
		archivePath: normalizeOptionalString(getObject(value.provenance).archivePath)
	};
}

function normalizeAlbumRecord(
	record: RawAtprotoRecord,
	serviceUrl: string,
	did: string
): AlbumEntry | null {
	const value = getObject(record.value);
	const loggedAt = normalizeDate(value.loggedAt);

	if (!loggedAt) {
		return null;
	}

	const title = normalizeString(value.title) || 'Untitled';
	const artist = normalizeString(value.artist);
	const slug = getRecordKey(record.uri) || `${title.toLowerCase().replace(/\s+/g, '-')}`;

	return {
		id: normalizeString(record.uri) || slug,
		slug,
		title: artist ? `${title} - ${artist}` : title,
		albumTitle: title,
		artist,
		note: normalizeString(value.note),
		noteHtml: normalizeOptionalString(value.noteHtml),
		excerpt: normalizeString(value.note),
		coverImage: resolveBlobImageUrl(value.cover, serviceUrl, did),
		publishedAt: loggedAt,
		displayDate: formatDisplayDate(loggedAt),
		sourceUrl: normalizeString(getObject(value.source).url),
		localPath: `/music/${slug}`,
		listenLinks: toListenLinks(value.source, value.links),
		archivePath: normalizeOptionalString(getObject(value.provenance).archivePath)
	};
}

async function getMusicSnapshot() {
	const repo = getConfiguredRepoIdentifier();
	const cache = getMusicCache();
	const cached = cache.get(repo);

	if (cached && cached.expiresAt > Date.now()) {
		return {
			repo,
			did: await resolveAtprotoDid(repo),
			serviceUrl: (await resolveAtprotoService(repo)).serviceUrl,
			tracks: cached.tracks,
			albums: cached.albums
		};
	}

	const { did, serviceUrl } = await resolveAtprotoService(repo);
	const [trackRecords, albumRecords] = await Promise.all([
		fetchCollectionRecords(serviceUrl, did, PDS_MUSIC_TRACK_COLLECTION),
		fetchCollectionRecords(serviceUrl, did, PDS_MUSIC_ALBUM_COLLECTION)
	]);

	const tracks = trackRecords
		.map((record) => normalizeTrackRecord(record, serviceUrl, did))
		.filter((entry): entry is TrackEntry => Boolean(entry))
		.sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());

	const albums = albumRecords
		.map((record) => normalizeAlbumRecord(record, serviceUrl, did))
		.filter((entry): entry is AlbumEntry => Boolean(entry))
		.sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());

	cache.set(repo, {
		expiresAt: Date.now() + PDS_MUSIC_CACHE_TTL_MS,
		tracks,
		albums
	});

	return {
		repo,
		did,
		serviceUrl,
		tracks,
		albums
	};
}

async function createSession(): Promise<AtprotoSession> {
	const repoIdentifier = getConfiguredRepoIdentifier();
	const identifiers = getConfiguredLoginIdentifiers(repoIdentifier);
	const password = getConfiguredAppPassword();

	if (!repoIdentifier || !identifiers.length || !password) {
		throw new Error(
			'PDS music import credentials are incomplete. Set STANDARD_SITE_APP_PASSWORD plus a repo or login identifier.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await getConfiguredRepoIdentity();

	if (
		pdsMusicSessionCache &&
		pdsMusicSessionCache.expiresAt > Date.now() &&
		pdsMusicSessionCache.serviceUrl === serviceUrl &&
		identifiers.includes(pdsMusicSessionCache.identifier)
	) {
		return pdsMusicSessionCache;
	}

	if (pdsMusicSessionPromise) {
		return await pdsMusicSessionPromise;
	}

	pdsMusicSessionPromise = (async () => {
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
				pdsMusicSessionCache = session;
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
		return await pdsMusicSessionPromise;
	} finally {
		pdsMusicSessionPromise = null;
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
	let attempt = 0;

	for (;;) {
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

		if (response.ok) {
			return (await response.json()) as { uri?: string; cid?: string };
		}

		const text = await response.text();
		const shouldRetry = (response.status === 429 || response.status >= 500) && attempt < 2;

		if (!shouldRetry) {
			throw new Error(
				`ATProto putRecord failed for ${collection}/${rkey}: ${response.status} ${text}`
			);
		}

		attempt += 1;
		await new Promise((resolve) => setTimeout(resolve, attempt * 250));
	}
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
		throw new Error(`Unable to fetch artwork: ${response.status} ${normalized}`);
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

function getLinkProvider(url: string, label: string) {
	const normalizedUrl = normalizeString(url).toLowerCase();
	const normalizedLabel = normalizeString(label).toLowerCase();

	if (normalizedUrl.includes('crucialtracks.org') || normalizedLabel.includes('crucial')) {
		return 'crucialtracks';
	}

	if (normalizedUrl.includes('albumwhale.com') || normalizedLabel.includes('album whale')) {
		return 'albumwhale';
	}

	if (normalizedUrl.includes('music.apple.com') || normalizedLabel.includes('apple music')) {
		return 'apple_music';
	}

	if (
		normalizedUrl.includes('song.link') ||
		normalizedUrl.includes('album.link') ||
		normalizedUrl.includes('odesli')
	) {
		return 'odesli';
	}

	if (normalizedUrl.includes('spotify.com') || normalizedLabel.includes('spotify')) {
		return 'spotify';
	}

	return '';
}

function getLinkKind(url: string, label: string) {
	const normalizedUrl = normalizeString(url).toLowerCase();
	const normalizedLabel = normalizeString(label).toLowerCase();

	if (normalizedLabel.includes('playlist')) {
		return 'playlist';
	}

	if (
		normalizedUrl.includes('crucialtracks.org') ||
		normalizedUrl.includes('albumwhale.com') ||
		normalizedLabel === 'source'
	) {
		return 'source';
	}

	return 'listen';
}

function buildSourceRecord(sourceUrl: string, fallbackProvider: string) {
	const normalizedUrl = normalizeString(sourceUrl);

	if (!normalizedUrl) {
		return null;
	}

	const provider = getLinkProvider(normalizedUrl, fallbackProvider) || fallbackProvider;

	return {
		provider,
		url: normalizedUrl,
		label: getProviderLabel(provider)
	};
}

function buildLinkRecords(links: ListenLink[], sourceUrl: string) {
	const source = normalizeString(sourceUrl);
	const seen = new Set<string>();
	const records: MusicLinkRecord[] = [];

	for (const link of links || []) {
		const label = normalizeString(link.label);
		const url = normalizeString(link.url);

		if (!label || !url || url === source) {
			continue;
		}

		const key = `${label}::${url}`;
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		records.push({
			label,
			url,
			kind: getLinkKind(url, label),
			provider: getLinkProvider(url, label) || undefined
		});
	}

	return records;
}

function buildTrackRecord(entry: TrackEntry, artwork: ImagePayload | null) {
	const source = buildSourceRecord(entry.sourceUrl, 'crucialtracks');
	const identifiers = {
		...(entry.appleMusicUrl ? { appleMusicUrl: entry.appleMusicUrl } : {}),
		...(entry.songlinkUrl ? { songlinkUrl: entry.songlinkUrl } : {})
	};
	const playback = {
		...(entry.previewUrl ? { previewUrl: entry.previewUrl } : {})
	};
	const provenance = {
		importedAt: new Date().toISOString(),
		...(entry.archivePath ? { archivePath: entry.archivePath } : {}),
		scraper: 'afterword-sveltekit-pds/music.ts'
	};

	return {
		$type: PDS_MUSIC_TRACK_COLLECTION,
		title: entry.trackTitle,
		artist: entry.artist,
		...(entry.note ? { note: entry.note } : {}),
		...(entry.noteHtml ? { noteHtml: entry.noteHtml } : {}),
		loggedAt: entry.publishedAt.toISOString(),
		...(source ? { source } : {}),
		...(artwork
			? {
					artwork: {
						image: {
							...artwork.blob,
							$type: artwork.blob.$type || 'blob'
						},
						...(artwork.aspectRatio ? { aspectRatio: artwork.aspectRatio } : {}),
						originalUrl: artwork.originalUrl,
						alt: entry.artist ? `${entry.trackTitle} by ${entry.artist}` : entry.trackTitle
					}
				}
			: {}),
		...(Object.keys(playback).length ? { playback } : {}),
		...(entry.listenLinks.length
			? { links: buildLinkRecords(entry.listenLinks, entry.sourceUrl) }
			: {}),
		...(Object.keys(identifiers).length ? { identifiers } : {}),
		provenance
	};
}

function buildAlbumRecord(entry: AlbumEntry, cover: ImagePayload | null) {
	const source = buildSourceRecord(entry.sourceUrl, 'albumwhale');
	const linkRecords = buildLinkRecords(entry.listenLinks, entry.sourceUrl);
	const identifiers = Object.fromEntries(
		linkRecords
			.filter(
				(link) =>
					link.provider === 'apple_music' ||
					link.provider === 'spotify' ||
					link.provider === 'odesli'
			)
			.map((link) => {
				if (link.provider === 'apple_music') return ['appleMusicUrl', link.url];
				if (link.provider === 'spotify') return ['spotifyUrl', link.url];
				return ['odesliUrl', link.url];
			})
	);
	const provenance = {
		importedAt: new Date().toISOString(),
		...(entry.archivePath ? { archivePath: entry.archivePath } : {}),
		scraper: 'afterword-sveltekit-pds/music.ts'
	};

	return {
		$type: PDS_MUSIC_ALBUM_COLLECTION,
		title: entry.albumTitle,
		artist: entry.artist,
		...(entry.note ? { note: entry.note } : {}),
		...(entry.noteHtml ? { noteHtml: entry.noteHtml } : {}),
		loggedAt: entry.publishedAt.toISOString(),
		...(source ? { source } : {}),
		...(cover
			? {
					cover: {
						image: {
							...cover.blob,
							$type: cover.blob.$type || 'blob'
						},
						...(cover.aspectRatio ? { aspectRatio: cover.aspectRatio } : {}),
						originalUrl: cover.originalUrl,
						alt: entry.artist ? `${entry.albumTitle} by ${entry.artist}` : entry.albumTitle
					}
				}
			: {}),
		...(linkRecords.length ? { links: linkRecords } : {}),
		...(Object.keys(identifiers).length ? { identifiers } : {}),
		provenance
	};
}

export async function getPdsTracks() {
	return (await getMusicSnapshot()).tracks;
}

export async function getPdsAlbums() {
	return (await getMusicSnapshot()).albums;
}

export async function importMusicToPds({
	tracks = [],
	albums = [],
	collections = ['tracks', 'albums'],
	limit = null,
	offset = null
}: MusicImportOptions): Promise<MusicImportResult> {
	const selectedCollections = [...new Set(collections)].filter(
		(collection): collection is 'tracks' | 'albums' =>
			collection === 'tracks' || collection === 'albums'
	);

	if (!selectedCollections.length) {
		throw new Error('Select at least one music collection to import.');
	}

	const session = await createSession();
	const imageCache = new Map<string, ImagePayload | null>();
	const repo = getConfiguredRepoIdentifier();
	const normalizedLimit =
		typeof limit === 'number' && Number.isFinite(limit) && limit >= 0 ? limit : null;
	const normalizedOffset =
		typeof offset === 'number' && Number.isFinite(offset) && offset >= 0 ? offset : 0;
	const result: MusicImportResult = {
		ok: true,
		repo,
		did: session.did,
		serviceUrl: session.serviceUrl,
		collections: selectedCollections,
		limit: normalizedLimit,
		offset: normalizedOffset,
		nextOffset: null,
		tracks: {
			available: tracks.length,
			attempted: 0,
			imported: 0,
			failed: 0
		},
		albums: {
			available: albums.length,
			attempted: 0,
			imported: 0,
			failed: 0
		},
		errors: []
	};

	const applyWindow = <T>(items: T[]) => {
		if (typeof normalizedLimit === 'number') {
			return items.slice(normalizedOffset, normalizedOffset + normalizedLimit);
		}

		return normalizedOffset > 0 ? items.slice(normalizedOffset) : items;
	};

	const totalAvailable = Math.max(
		0,
		...selectedCollections.map((collection) =>
			collection === 'tracks' ? tracks.length : albums.length
		)
	);
	if (typeof normalizedLimit === 'number' && normalizedLimit > 0) {
		result.nextOffset =
			normalizedOffset + normalizedLimit < totalAvailable
				? normalizedOffset + normalizedLimit
				: null;
	}

	if (selectedCollections.includes('tracks')) {
		for (const entry of applyWindow(tracks)) {
			result.tracks.attempted += 1;

			try {
				const artwork = entry.artworkUrl
					? await uploadRemoteImage(session, entry.artworkUrl, imageCache)
					: null;
				await putRecord(
					session,
					PDS_MUSIC_TRACK_COLLECTION,
					entry.slug,
					buildTrackRecord(entry, artwork)
				);
				result.tracks.imported += 1;
			} catch (error) {
				result.ok = false;
				result.tracks.failed += 1;
				result.errors.push({
					collection: 'tracks',
					slug: entry.slug,
					message: error instanceof Error ? error.message : 'Unable to import track.'
				});
			}
		}
	}

	if (selectedCollections.includes('albums')) {
		for (const entry of applyWindow(albums)) {
			result.albums.attempted += 1;

			try {
				const cover = entry.coverImage
					? await uploadRemoteImage(session, entry.coverImage, imageCache)
					: null;
				await putRecord(
					session,
					PDS_MUSIC_ALBUM_COLLECTION,
					entry.slug,
					buildAlbumRecord(entry, cover)
				);
				result.albums.imported += 1;
			} catch (error) {
				result.ok = false;
				result.albums.failed += 1;
				result.errors.push({
					collection: 'albums',
					slug: entry.slug,
					message: error instanceof Error ? error.message : 'Unable to import album.'
				});
			}
		}
	}

	getMusicCache().delete(repo);
	return result;
}
