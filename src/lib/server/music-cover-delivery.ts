import type { RequestEvent } from '@sveltejs/kit';
import type { AlbumEntry, TrackEntry } from '$lib/server/music';
import {
	buildVariantPath,
	hashString,
	inferImageExtensionFromUrl,
	isSameOriginOrRelativeUrl,
	sanitizeAssetSegment
} from '$lib/server/image-delivery';

const MUSIC_COVER_PREFIX = 'music-covers/originals';

type MusicCoverContext = Pick<RequestEvent, 'platform' | 'url'>;

function hasR2Bucket(event: MusicCoverContext | null | undefined) {
	try {
		return Boolean(event?.platform?.env?.R2_BUCKET);
	} catch {
		return false;
	}
}

function getMusicCoverVariantPath(key: string, preset: 'mini' | 'cover', sourceUrl: string) {
	return buildVariantPath('media-cover-images', preset, key, sourceUrl);
}

function getMusicCoverAssetKey(kind: 'album' | 'track', id: string, sourceUrl: string) {
	const extension = inferImageExtensionFromUrl(sourceUrl);
	return `${MUSIC_COVER_PREFIX}/${sanitizeAssetSegment(kind)}/${sanitizeAssetSegment(id)}-${hashString(sourceUrl)}.${extension}`;
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
