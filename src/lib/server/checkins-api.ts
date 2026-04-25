import type { Checkin } from '$lib/server/atproto';
import { filterPublicCheckins } from '$lib/server/checkin-visibility';
import { getCheckinsSnapshot } from '$lib/server/checkins-snapshot';

type CheckinsApiContext = Parameters<typeof getCheckinsSnapshot>[0];

export type SerializedCheckin = {
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
	createdAt: string;
	visitedAt: string;
	coverImage: string | null;
	photoUrls: string[];
	mapEmbedUrl: string | null;
	appleMapsUrl: string | null;
	mapPreviewPath: string | null;
	imported: boolean;
};

export type CheckinsApiPage = {
	items: SerializedCheckin[];
	pageInfo: {
		count: number;
		limit: number;
		nextCursor: string | null;
		hasMore: boolean;
	};
	filters: {
		coordinatesOnly: boolean;
	};
	map:
		| {
				count: number;
				bounds: {
					minLatitude: number;
					maxLatitude: number;
					minLongitude: number;
					maxLongitude: number;
				} | null;
		  }
		| null;
};

function normalizeBoolean(value: string | null) {
	const normalized = String(value || '')
		.trim()
		.toLowerCase();
	return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function clampLimit(value: string | null, fallback = 20, max = 100) {
	const parsed = Number.parseInt(String(value || ''), 10);

	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback;
	}

	return Math.min(parsed, max);
}

function serializeCheckin(item: Checkin): SerializedCheckin {
	const mapPreviewPath =
		typeof item.latitude === 'number' && typeof item.longitude === 'number'
			? `/check-ins/map/${encodeURIComponent(item.id)}?v=2&lat=${item.latitude.toFixed(6)}&lng=${item.longitude.toFixed(6)}`
			: null;

	return {
		id: item.id,
		uri: item.uri,
		cid: item.cid,
		slug: item.slug,
		canonicalPath: item.canonicalPath,
		name: item.name,
		note: item.note,
		excerpt: item.excerpt,
		address: item.address,
		locality: item.locality,
		region: item.region,
		country: item.country,
		place: item.place,
		timezone: item.timezone,
		latitude: item.latitude,
		longitude: item.longitude,
		website: item.website,
		venueCategory: item.venueCategory,
		visibility: item.visibility,
		tags: item.tags,
		createdAt: item.createdAt.toISOString(),
		visitedAt: item.visitedAt.toISOString(),
		coverImage: item.coverImage,
		photoUrls: item.photoUrls,
		mapEmbedUrl: item.mapEmbedUrl,
		appleMapsUrl: item.appleMapsUrl,
		mapPreviewPath,
		imported: true
	};
}

function buildBounds(items: Checkin[]) {
	const coordinateItems = items.filter(
		(item) => typeof item.latitude === 'number' && typeof item.longitude === 'number'
	);

	if (!coordinateItems.length) {
		return null;
	}

	return {
		minLatitude: Math.min(...coordinateItems.map((item) => item.latitude as number)),
		maxLatitude: Math.max(...coordinateItems.map((item) => item.latitude as number)),
		minLongitude: Math.min(...coordinateItems.map((item) => item.longitude as number)),
		maxLongitude: Math.max(...coordinateItems.map((item) => item.longitude as number))
	};
}

export async function getCheckinsApiPage(
	context: CheckinsApiContext,
	input: {
		limit?: string | null;
		cursor?: string | null;
		coordinatesOnly?: string | null;
	}
): Promise<CheckinsApiPage> {
	const limit = clampLimit(input.limit ?? null);
	const cursor = String(input.cursor || '').trim();
	const coordinatesOnly = normalizeBoolean(input.coordinatesOnly ?? null);

	const checkins = filterPublicCheckins(await getCheckinsSnapshot(context));
	const filtered = coordinatesOnly
		? checkins.filter(
				(item) => typeof item.latitude === 'number' && typeof item.longitude === 'number'
			)
		: checkins;

	const startIndex = cursor
		? Math.max(
				0,
				filtered.findIndex((item) => item.slug === cursor || item.id === cursor) + 1
			)
		: 0;
	const slice = filtered.slice(startIndex, startIndex + limit);
	const nextItem = filtered[startIndex + limit] || null;

	return {
		items: slice.map((item) => serializeCheckin(item)),
		pageInfo: {
			count: slice.length,
			limit,
			nextCursor: nextItem?.slug || null,
			hasMore: Boolean(nextItem)
		},
		filters: {
			coordinatesOnly
		},
		map: coordinatesOnly
			? {
					count: slice.length,
					bounds: buildBounds(slice)
				}
			: null
	};
}
