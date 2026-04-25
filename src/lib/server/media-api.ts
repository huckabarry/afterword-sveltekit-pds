import type { AlbumEntry, TrackEntry } from '$lib/server/music';
import type { PopfeedItem } from '$lib/server/popfeed';

export type SerializedAlbumEntry = Omit<AlbumEntry, 'publishedAt'> & {
	publishedAt: string;
};

export type SerializedTrackEntry = Omit<TrackEntry, 'publishedAt'> & {
	publishedAt: string;
};

export type SerializedPopfeedItem = Omit<
	PopfeedItem,
	'addedAt' | 'activityAt' | 'startedAt' | 'completedAt' | 'releaseDate' | 'date'
> & {
	addedAt: string | null;
	activityAt: string | null;
	startedAt: string | null;
	completedAt: string | null;
	releaseDate: string | null;
	date: string;
};

export function serializeAlbumEntry(entry: AlbumEntry): SerializedAlbumEntry {
	return {
		...entry,
		publishedAt: entry.publishedAt.toISOString()
	};
}

export function serializeTrackEntry(entry: TrackEntry): SerializedTrackEntry {
	return {
		...entry,
		publishedAt: entry.publishedAt.toISOString()
	};
}

function serializeOptionalDate(value: Date | null) {
	return value ? value.toISOString() : null;
}

export function serializePopfeedItem(item: PopfeedItem): SerializedPopfeedItem {
	return {
		...item,
		addedAt: serializeOptionalDate(item.addedAt),
		activityAt: serializeOptionalDate(item.activityAt),
		startedAt: serializeOptionalDate(item.startedAt),
		completedAt: serializeOptionalDate(item.completedAt),
		releaseDate: serializeOptionalDate(item.releaseDate),
		date: item.date.toISOString()
	};
}
