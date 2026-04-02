import type { RequestEvent } from '@sveltejs/kit';
import type { AlbumEntry, TrackEntry } from '$lib/server/music';

const MUSIC_COVER_PREFIX = 'music-covers/originals';

type MusicCoverContext = Pick<RequestEvent, 'platform' | 'url'>;

function hasR2Bucket(event: MusicCoverContext | null | undefined) {
	try {
		return Boolean(event?.platform?.env?.R2_BUCKET);
	} catch {
		return false;
	}
}

function sanitizeSegment(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'item'
	);
}

function inferExtensionFromUrl(imageUrl: string) {
	try {
		const pathname = new URL(imageUrl).pathname;
		const ext = pathname.split('.').pop()?.toLowerCase() || '';

		if (/^(avif|gif|jpe?g|png|svg|webp)$/i.test(ext)) {
			return ext === 'jpeg' ? 'jpg' : ext;
		}
	} catch {
		// ignore malformed URLs and fall through
	}

	return 'jpg';
}

function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (const character of String(value || '')) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(36);
}

function isSameOriginOrRelativeUrl(imageUrl: string, origin: string) {
	const normalized = String(imageUrl || '').trim();

	if (!normalized) {
		return true;
	}

	if (normalized.startsWith('/')) {
		return true;
	}

	try {
		return new URL(normalized).origin === origin;
	} catch {
		return true;
	}
}

function getMusicCoverVariantPath(key: string, preset: 'mini' | 'cover', sourceUrl: string) {
	return `/${['media-cover-images', preset, ...key.split('/').filter(Boolean)].join('/')}?src=${encodeURIComponent(sourceUrl)}`;
}

function getMusicCoverAssetKey(kind: 'album' | 'track', id: string, sourceUrl: string) {
	const extension = inferExtensionFromUrl(sourceUrl);
	return `${MUSIC_COVER_PREFIX}/${sanitizeSegment(kind)}/${sanitizeSegment(id)}-${hashString(sourceUrl)}.${extension}`;
}

export function attachAlbumCoverDelivery(
	albums: AlbumEntry[],
	event: MusicCoverContext | null | undefined
) {
	if (!event || !hasR2Bucket(event)) {
		return albums;
	}

	const origin = event.url.origin;

	return albums.map((album) => {
		const sourceUrl = String(album.coverImage || '').trim();

		if (!sourceUrl || isSameOriginOrRelativeUrl(sourceUrl, origin)) {
			return album;
		}

		const key = getMusicCoverAssetKey('album', album.id || album.slug, sourceUrl);

		return {
			...album,
			coverImage: getMusicCoverVariantPath(key, 'cover', sourceUrl)
		};
	});
}

export function attachTrackCoverDelivery(
	tracks: TrackEntry[],
	event: MusicCoverContext | null | undefined
) {
	if (!event || !hasR2Bucket(event)) {
		return tracks;
	}

	const origin = event.url.origin;

	return tracks.map((track) => {
		const sourceUrl = String(track.artworkUrl || '').trim();

		if (!sourceUrl || isSameOriginOrRelativeUrl(sourceUrl, origin)) {
			return track;
		}

		const key = getMusicCoverAssetKey('track', track.id || track.slug, sourceUrl);

		return {
			...track,
			artworkUrl: getMusicCoverVariantPath(key, 'mini', sourceUrl)
		};
	});
}
