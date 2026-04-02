import type { RequestEvent } from '@sveltejs/kit';
import type { AlbumEntry, TrackEntry } from '$lib/server/music';

const MUSIC_R2_CACHE_TTL_MS = 1000 * 60 * 10;
const MUSIC_R2_PREFIX = 'music';
const TRACKS_KEY = `${MUSIC_R2_PREFIX}/tracks.json`;
const ALBUMS_KEY = `${MUSIC_R2_PREFIX}/albums.json`;

type BoundR2Bucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

type MusicReadContext = Pick<RequestEvent, 'platform'> | null | undefined;

type StoredAlbumEntry = Omit<AlbumEntry, 'publishedAt'> & { publishedAt: string };
type StoredTrackEntry = Omit<TrackEntry, 'publishedAt'> & { publishedAt: string };

type StoredMusicSnapshot = {
	generatedAt: string;
	tracks: StoredTrackEntry[];
	albums: StoredAlbumEntry[];
};

type RawMusicSnapshotCacheEntry = {
	expiresAt: number;
	snapshot: {
		generatedAt: string;
		archiveDigest: string | null;
		tracks: TrackEntry[];
		albums: AlbumEntry[];
	};
};

function getBucket(context: MusicReadContext) {
	try {
		return context?.platform?.env?.R2_BUCKET ?? null;
	} catch {
		return null;
	}
}

function getMusicSnapshotCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordMusicR2SnapshotCache?: Map<string, RawMusicSnapshotCacheEntry>;
	};

	if (!scope.__afterwordMusicR2SnapshotCache) {
		scope.__afterwordMusicR2SnapshotCache = new Map<string, RawMusicSnapshotCacheEntry>();
	}

	return scope.__afterwordMusicR2SnapshotCache;
}

function reviveAlbumEntry(entry: StoredAlbumEntry): AlbumEntry {
	return {
		...entry,
		publishedAt: new Date(entry.publishedAt)
	};
}

function reviveTrackEntry(entry: StoredTrackEntry): TrackEntry {
	return {
		...entry,
		publishedAt: new Date(entry.publishedAt)
	};
}

function serializeAlbumEntry(entry: AlbumEntry): StoredAlbumEntry {
	return {
		...entry,
		publishedAt: entry.publishedAt.toISOString()
	};
}

function serializeTrackEntry(entry: TrackEntry): StoredTrackEntry {
	return {
		...entry,
		publishedAt: entry.publishedAt.toISOString()
	};
}

async function readJsonObjectWithMetadata<T>(bucket: BoundR2Bucket, key: string) {
	const object = await bucket.get(key);
	if (!object) {
		return null;
	}

	try {
		return {
			value: (await object.json()) as T,
			customMetadata:
				typeof object === 'object' && object && 'customMetadata' in object
					? ((object.customMetadata as Record<string, string | undefined>) ?? {})
					: {},
			uploaded:
				typeof object === 'object' && object && 'uploaded' in object ? object.uploaded : null
		};
	} catch {
		return null;
	}
}

function getCacheKey(bucket: BoundR2Bucket) {
	const name =
		typeof bucket === 'object' && bucket && 'name' in bucket ? String(bucket.name || '') : 'default';

	return name || 'default';
}

export async function getMusicSnapshotFromR2(context: MusicReadContext) {
	const bucket = getBucket(context);
	if (!bucket) {
		return null;
	}

	const cache = getMusicSnapshotCache();
	const cacheKey = getCacheKey(bucket);
	const cached = cache.get(cacheKey);

	if (cached && cached.expiresAt > Date.now()) {
		return cached.snapshot;
	}

	const [tracksObject, albumsObject] = await Promise.all([
		readJsonObjectWithMetadata<StoredTrackEntry[]>(bucket, TRACKS_KEY),
		readJsonObjectWithMetadata<StoredAlbumEntry[]>(bucket, ALBUMS_KEY)
	]);

	const tracks = tracksObject?.value || null;
	const albums = albumsObject?.value || null;

	if (!tracks && !albums) {
		return null;
	}

	const archiveDigest =
		String(
			tracksObject?.customMetadata?.archiveDigest || albumsObject?.customMetadata?.archiveDigest || ''
		).trim() || null;
	const generatedAt =
		String(
			tracksObject?.customMetadata?.generatedAt ||
				albumsObject?.customMetadata?.generatedAt ||
				tracksObject?.uploaded?.toISOString?.() ||
				albumsObject?.uploaded?.toISOString?.() ||
				''
		).trim() || new Date().toISOString();
	const snapshot = {
		generatedAt,
		archiveDigest,
		tracks: (tracks || []).map(reviveTrackEntry).filter((entry) => !Number.isNaN(entry.publishedAt.getTime())),
		albums: (albums || []).map(reviveAlbumEntry).filter((entry) => !Number.isNaN(entry.publishedAt.getTime()))
	};

	cache.set(cacheKey, {
		expiresAt: Date.now() + MUSIC_R2_CACHE_TTL_MS,
		snapshot
	});

	return snapshot;
}

export async function writeMusicSnapshotToR2(
	context: MusicReadContext,
	{
		tracks,
		albums,
		archiveDigest = null
	}: {
		tracks: TrackEntry[];
		albums: AlbumEntry[];
		archiveDigest?: string | null;
	}
) {
	const bucket = getBucket(context);
	if (!bucket) {
		throw new Error('R2_BUCKET is not configured');
	}

	const snapshot: StoredMusicSnapshot = {
		generatedAt: new Date().toISOString(),
		tracks: tracks.map(serializeTrackEntry),
		albums: albums.map(serializeAlbumEntry)
	};

	await Promise.all([
		bucket.put(TRACKS_KEY, JSON.stringify(snapshot.tracks), {
			customMetadata: {
				archiveDigest: String(archiveDigest || ''),
				generatedAt: snapshot.generatedAt
			},
			httpMetadata: {
				contentType: 'application/json; charset=utf-8'
			}
		}),
		bucket.put(ALBUMS_KEY, JSON.stringify(snapshot.albums), {
			customMetadata: {
				archiveDigest: String(archiveDigest || ''),
				generatedAt: snapshot.generatedAt
			},
			httpMetadata: {
				contentType: 'application/json; charset=utf-8'
			}
		})
	]);

	getMusicSnapshotCache().set(getCacheKey(bucket), {
		expiresAt: Date.now() + MUSIC_R2_CACHE_TTL_MS,
		snapshot: {
			generatedAt: snapshot.generatedAt,
			archiveDigest: String(archiveDigest || '').trim() || null,
			tracks,
			albums
		}
	});

	return {
		generatedAt: snapshot.generatedAt,
		tracks: tracks.length,
		albums: albums.length,
		keys: {
			tracks: TRACKS_KEY,
			albums: ALBUMS_KEY
		}
	};
}
