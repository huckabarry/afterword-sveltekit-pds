import { env } from '$env/dynamic/private';
import { error, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { hydrateCheckinRecord, type Checkin } from '$lib/server/atproto';
import { upsertLatestCheckinSnapshot } from '$lib/server/checkin-snapshot';
import { refreshCheckinsSnapshot } from '$lib/server/checkins-snapshot';
import {
	createCheckinRecord,
	getCheckinWriterSession,
	putCheckinRecord,
	uploadRemoteCheckinImage
} from '$lib/server/pds-checkins';

const FOURSQUARE_AUTH_BASE = 'https://foursquare.com/oauth2';
const FOURSQUARE_API_BASE = 'https://api.foursquare.com/v2';
const FOURSQUARE_API_VERSION = '20260330';
const SWARM_STATE_COOKIE = 'afterword_swarm_oauth_state';
const SWARM_SYNC_ROW_ID = 1;
const SWARM_MAX_PHOTOS = 4;
let swarmTablesReady = false;
let swarmTablesPromise: Promise<void> | null = null;

type SwarmUserSummary = {
	id: string | null;
	firstName: string | null;
	lastName: string | null;
	photoUrl: string | null;
};

export type SwarmSyncState = {
	configured: boolean;
	connected: boolean;
	user: SwarmUserSummary;
	connectedAt: string | null;
	lastSyncedAt: string | null;
	lastError: string | null;
	lastSourceCheckinId: string | null;
	syncCount: number;
	callbackUrl: string;
	pushUrl: string;
	pushConfigured: boolean;
};

type SwarmStoredState = {
	accessToken: string | null;
	userId: string | null;
	firstName: string | null;
	lastName: string | null;
	photoUrl: string | null;
	connectedAt: string | null;
	lastSyncedAt: string | null;
	lastError: string | null;
	lastSourceCheckinId: string | null;
	syncCount: number;
};

type SwarmVenueCategory = {
	id?: string;
	name?: string;
	shortName?: string;
	primary?: boolean;
};

type SwarmPhoto = {
	prefix?: string;
	suffix?: string;
	width?: number;
	height?: number;
	url?: string;
};

type SwarmCheckin = {
	id?: string;
	createdAt?: number;
	timeZoneOffset?: number;
	isPrivate?: boolean;
	visibility?: string;
	shout?: string;
	venue?: {
		id?: string;
		name?: string;
		url?: string;
		location?: {
			address?: string;
			city?: string;
			state?: string;
			country?: string;
			lat?: number;
			lng?: number;
		};
		categories?: SwarmVenueCategory[];
	};
	photos?: {
		count?: number;
		items?: SwarmPhoto[];
	};
};

export type SwarmSyncResult = {
	ok: boolean;
	imported: number;
	failed: number;
	processed: number;
	lastSourceCheckinId: string | null;
	errors: Array<{ id: string; message: string }>;
};

type SwarmCheckinRecordMapping = {
	sourceId: string;
	recordUri: string;
	recordKey: string;
};

function getDatabase(event: Pick<RequestEvent, 'platform'>) {
	const db =
		event.platform?.env?.D1_DATABASE ||
		event.platform?.env?.D1_DATABASE_BINDING ||
		event.platform?.env?.AP_DB;

	if (!db) {
		throw error(500, 'D1 database binding is not available.');
	}

	return db;
}

async function ensureSwarmTables(event: Pick<RequestEvent, 'platform'>) {
	if (swarmTablesReady) {
		return;
	}

	if (swarmTablesPromise) {
		await swarmTablesPromise;
		return;
	}

	const db = getDatabase(event);
	swarmTablesPromise = (async () => {
		await db
			.prepare(
				`CREATE TABLE IF NOT EXISTS swarm_sync_state (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					access_token TEXT,
					user_id TEXT,
					first_name TEXT,
					last_name TEXT,
					photo_url TEXT,
					connected_at TEXT,
					last_synced_at TEXT,
					last_error TEXT,
					last_source_checkin_id TEXT,
					sync_count INTEGER NOT NULL DEFAULT 0,
					updated_at TEXT NOT NULL
				)`
			)
			.run();
		await db
			.prepare(
				`CREATE TABLE IF NOT EXISTS swarm_checkin_records (
					source_id TEXT PRIMARY KEY,
					record_uri TEXT NOT NULL,
					record_key TEXT NOT NULL,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				)`
			)
			.run();
		swarmTablesReady = true;
	})();

	try {
		await swarmTablesPromise;
	} finally {
		swarmTablesPromise = null;
	}
}

function getCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: true,
		maxAge: 60 * 10
	};
}

function getFoursquareClientId() {
	return String(env.FOURSQUARE_CLIENT_ID || env.SWARM_CLIENT_ID || '').trim();
}

function getFoursquareClientSecret() {
	return String(env.FOURSQUARE_CLIENT_SECRET || env.SWARM_CLIENT_SECRET || '').trim();
}

function getFoursquarePushSecret() {
	return String(env.FOURSQUARE_PUSH_SECRET || env.SWARM_PUSH_SECRET || '').trim();
}

export function getSwarmSyncToken(request: Request) {
	const authorization = request.headers.get('authorization')?.trim() || '';
	const bearer = authorization.toLowerCase().startsWith('bearer ')
		? authorization.slice(7).trim()
		: '';

	return request.headers.get('x-swarm-sync-token')?.trim() || bearer || '';
}

export function requireSwarmSyncToken(request: Request) {
	const expected = String(env.SWARM_SYNC_TOKEN || env.FOURSQUARE_SYNC_TOKEN || '').trim();
	const submitted = getSwarmSyncToken(request);

	if (!expected || !submitted || submitted !== expected) {
		throw error(401, 'Unauthorized');
	}
}

function normalizeString(value: unknown) {
	return String(value || '').trim();
}

function slugify(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/['".,!?()[\]{}:;]+/g, '')
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'checkin'
	);
}

function getCallbackUrl(origin: string) {
	return `${origin}/admin/checkins/callback`;
}

function getPushUrl(origin: string) {
	return `${origin}/api/swarm/push`;
}

function getRecordKeyFromUri(uri: string) {
	return String(uri || '').split('/').pop() || '';
}

function createStateToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function setOauthState(cookies: Cookies, state: string) {
	cookies.set(SWARM_STATE_COOKIE, state, getCookieOptions());
}

function clearOauthState(cookies: Cookies) {
	cookies.delete(SWARM_STATE_COOKIE, { path: '/' });
}

function requireValidOauthState(cookies: Cookies, submitted: string) {
	const expected = cookies.get(SWARM_STATE_COOKIE);
	clearOauthState(cookies);

	if (!expected || !submitted || expected !== submitted) {
		throw error(400, 'Invalid Swarm authorization state.');
	}
}

function getSwarmAuthorizeUrl({
	clientId,
	redirectUri,
	state
}: {
	clientId: string;
	redirectUri: string;
	state: string;
}) {
	const params = new URLSearchParams({
		client_id: clientId,
		response_type: 'code',
		redirect_uri: redirectUri,
		state
	});
	return `${FOURSQUARE_AUTH_BASE}/authenticate?${params.toString()}`;
}

async function exchangeCodeForAccessToken({
	code,
	redirectUri
}: {
	code: string;
	redirectUri: string;
}) {
	const clientId = getFoursquareClientId();
	const clientSecret = getFoursquareClientSecret();

	if (!clientId || !clientSecret) {
		throw new Error('FOURSQUARE_CLIENT_ID and FOURSQUARE_CLIENT_SECRET must be configured.');
	}

	const params = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri,
		code
	});

	const response = await fetch(`${FOURSQUARE_AUTH_BASE}/access_token?${params.toString()}`, {
		headers: {
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Swarm token exchange failed with ${response.status}.`);
	}

	const payload = (await response.json()) as { access_token?: string };
	const accessToken = normalizeString(payload.access_token);

	if (!accessToken) {
		throw new Error('Swarm token exchange did not return an access token.');
	}

	return accessToken;
}

async function fetchFoursquareJson<T>(path: string, accessToken: string, params?: URLSearchParams) {
	const url = new URL(`${FOURSQUARE_API_BASE}${path}`);
	url.searchParams.set('v', FOURSQUARE_API_VERSION);

	if (params) {
		for (const [key, value] of params.entries()) {
			url.searchParams.set(key, value);
		}
	}

	const response = await fetch(url.toString(), {
		headers: {
			accept: 'application/json',
			authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		throw new Error(`Swarm request failed for ${path} with ${response.status}.`);
	}

	return (await response.json()) as T;
}

async function fetchSwarmUser(accessToken: string) {
	const payload = await fetchFoursquareJson<{
		response?: {
			user?: {
				id?: string | number;
				firstName?: string;
				lastName?: string;
				photo?: { prefix?: string; suffix?: string } | string;
			};
		};
	}>('/users/self', accessToken);

	const user = payload.response?.user || {};
	let photoUrl = '';

	if (typeof user.photo === 'string') {
		photoUrl = user.photo;
	} else if (user.photo?.prefix && user.photo?.suffix) {
		photoUrl = `${user.photo.prefix}original${user.photo.suffix}`;
	}

	return {
		userId: normalizeString(user.id),
		firstName: normalizeString(user.firstName) || null,
		lastName: normalizeString(user.lastName) || null,
		photoUrl: normalizeString(photoUrl) || null
	};
}

async function readStoredState(event: Pick<RequestEvent, 'platform'>): Promise<SwarmStoredState> {
	const row = await getDatabase(event)
		.prepare(
			`SELECT access_token, user_id, first_name, last_name, photo_url, connected_at,
				last_synced_at, last_error, last_source_checkin_id, sync_count
			FROM swarm_sync_state
			WHERE id = ?`
		)
		.bind(SWARM_SYNC_ROW_ID)
		.first<{
			access_token?: string | null;
			user_id?: string | null;
			first_name?: string | null;
			last_name?: string | null;
			photo_url?: string | null;
			connected_at?: string | null;
			last_synced_at?: string | null;
			last_error?: string | null;
			last_source_checkin_id?: string | null;
			sync_count?: number | null;
		}>();

	return {
		accessToken: row?.access_token || null,
		userId: row?.user_id || null,
		firstName: row?.first_name || null,
		lastName: row?.last_name || null,
		photoUrl: row?.photo_url || null,
		connectedAt: row?.connected_at || null,
		lastSyncedAt: row?.last_synced_at || null,
		lastError: row?.last_error || null,
		lastSourceCheckinId: row?.last_source_checkin_id || null,
		syncCount: Number(row?.sync_count || 0)
	};
}

async function getStoredState(event: Pick<RequestEvent, 'platform'>): Promise<SwarmStoredState> {
	await ensureSwarmTables(event);
	return await readStoredState(event);
}

async function getCheckinRecordMapping(
	event: Pick<RequestEvent, 'platform'>,
	sourceId: string
): Promise<SwarmCheckinRecordMapping | null> {
	await ensureSwarmTables(event);
	const row = await getDatabase(event)
		.prepare(
			`SELECT source_id, record_uri, record_key
			FROM swarm_checkin_records
			WHERE source_id = ?`
		)
		.bind(sourceId)
		.first<{
			source_id?: string;
			record_uri?: string;
			record_key?: string;
		}>();

	if (!row?.source_id || !row.record_uri || !row.record_key) {
		return null;
	}

	return {
		sourceId: row.source_id,
		recordUri: row.record_uri,
		recordKey: row.record_key
	};
}

async function saveCheckinRecordMapping(
	event: Pick<RequestEvent, 'platform'>,
	mapping: SwarmCheckinRecordMapping
) {
	await ensureSwarmTables(event);
	const now = new Date().toISOString();
	await getDatabase(event)
		.prepare(
			`INSERT INTO swarm_checkin_records (source_id, record_uri, record_key, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(source_id) DO UPDATE SET
				record_uri = excluded.record_uri,
				record_key = excluded.record_key,
				updated_at = excluded.updated_at`
		)
		.bind(mapping.sourceId, mapping.recordUri, mapping.recordKey, now, now)
		.run();
}

async function saveStoredState(
	event: Pick<RequestEvent, 'platform'>,
	state: Partial<SwarmStoredState> & { accessToken?: string | null }
) {
	await ensureSwarmTables(event);
	const db = getDatabase(event);
	const existing = await readStoredState(event);
	const now = new Date().toISOString();

	await db
		.prepare(
			`INSERT INTO swarm_sync_state (
				id, access_token, user_id, first_name, last_name, photo_url, connected_at,
				last_synced_at, last_error, last_source_checkin_id, sync_count, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				access_token = excluded.access_token,
				user_id = excluded.user_id,
				first_name = excluded.first_name,
				last_name = excluded.last_name,
				photo_url = excluded.photo_url,
				connected_at = excluded.connected_at,
				last_synced_at = excluded.last_synced_at,
				last_error = excluded.last_error,
				last_source_checkin_id = excluded.last_source_checkin_id,
				sync_count = excluded.sync_count,
				updated_at = excluded.updated_at`
		)
		.bind(
			SWARM_SYNC_ROW_ID,
			state.accessToken ?? existing.accessToken,
			state.userId ?? existing.userId,
			state.firstName ?? existing.firstName,
			state.lastName ?? existing.lastName,
			state.photoUrl ?? existing.photoUrl,
			state.connectedAt ?? existing.connectedAt ?? now,
			state.lastSyncedAt ?? existing.lastSyncedAt,
			state.lastError ?? existing.lastError,
			state.lastSourceCheckinId ?? existing.lastSourceCheckinId,
			typeof state.syncCount === 'number' ? state.syncCount : existing.syncCount,
			now
		)
		.run();
}

export async function clearSwarmConnection(event: Pick<RequestEvent, 'platform'>) {
	await ensureSwarmTables(event);
	await getDatabase(event).prepare(`DELETE FROM swarm_sync_state WHERE id = ?`).bind(SWARM_SYNC_ROW_ID).run();
}

export async function getSwarmSyncStateView(
	event: Pick<RequestEvent, 'platform' | 'url'>
): Promise<SwarmSyncState> {
	const stored = await getStoredState(event);

	return {
		configured: Boolean(getFoursquareClientId() && getFoursquareClientSecret()),
		connected: Boolean(stored.accessToken),
		user: {
			id: stored.userId,
			firstName: stored.firstName,
			lastName: stored.lastName,
			photoUrl: stored.photoUrl
		},
		connectedAt: stored.connectedAt,
		lastSyncedAt: stored.lastSyncedAt,
		lastError: stored.lastError,
		lastSourceCheckinId: stored.lastSourceCheckinId,
		syncCount: stored.syncCount,
		callbackUrl: getCallbackUrl(event.url.origin),
		pushUrl: getPushUrl(event.url.origin),
		pushConfigured: Boolean(getFoursquarePushSecret())
	};
}

export function startSwarmOauth(event: Pick<RequestEvent, 'cookies' | 'url'>): never {
	const clientId = getFoursquareClientId();
	const clientSecret = getFoursquareClientSecret();

	if (!clientId || !clientSecret) {
		throw error(500, 'FOURSQUARE_CLIENT_ID and FOURSQUARE_CLIENT_SECRET must be configured.');
	}

	const state = createStateToken();
	setOauthState(event.cookies, state);
	throw redirect(
		303,
		getSwarmAuthorizeUrl({
			clientId,
			redirectUri: getCallbackUrl(event.url.origin),
			state
		})
	);
}

export async function finishSwarmOauth(event: Pick<RequestEvent, 'cookies' | 'url' | 'platform'>) {
	const code = normalizeString(event.url.searchParams.get('code'));
	const state = normalizeString(event.url.searchParams.get('state'));
	const errorDescription = normalizeString(
		event.url.searchParams.get('error') || event.url.searchParams.get('error_description')
	);

	if (errorDescription) {
		throw error(400, errorDescription);
	}

	if (!code) {
		throw error(400, 'Missing Swarm authorization code.');
	}

	requireValidOauthState(event.cookies, state);
	const redirectUri = getCallbackUrl(event.url.origin);
	const accessToken = await exchangeCodeForAccessToken({
		code,
		redirectUri
	});
	const user = await fetchSwarmUser(accessToken);
	const now = new Date().toISOString();

	await saveStoredState(event, {
		accessToken,
		userId: user.userId,
		firstName: user.firstName,
		lastName: user.lastName,
		photoUrl: user.photoUrl,
		connectedAt: now,
		lastError: null
	});
}

function pickVenueCategory(categories: unknown) {
	if (!Array.isArray(categories)) {
		return '';
	}

	const normalized = categories
		.map((entry) => entry as SwarmVenueCategory)
		.find((entry) => entry?.primary) || (categories[0] as SwarmVenueCategory | undefined);

	return normalizeString(normalized?.shortName || normalized?.name);
}

function compactIsoString(date: Date) {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function joinIfPresent(parts: Array<string | null | undefined>, separator = ', ') {
	return parts.map((part) => normalizeString(part)).filter(Boolean).join(separator);
}

function getPhotoUrl(photo: SwarmPhoto) {
	const direct = normalizeString(photo.url);
	if (direct) {
		return direct;
	}

	if (photo.prefix && photo.suffix) {
		return `${photo.prefix}original${photo.suffix}`;
	}

	return '';
}

function getVisibility(checkin: SwarmCheckin) {
	if (checkin.isPrivate) {
		return 'private';
	}

	const normalized = normalizeString(checkin.visibility).toLowerCase();
	if (normalized === 'private' || normalized === 'off-grid') {
		return 'private';
	}

	return 'public';
}

function getVisitedAt(checkin: SwarmCheckin) {
	const seconds = Number(checkin.createdAt || 0);
	if (Number.isFinite(seconds) && seconds > 0) {
		return new Date(seconds * 1000);
	}

	return new Date();
}

function buildCheckinSlug(checkin: SwarmCheckin) {
	const id = normalizeString(checkin.id) || crypto.randomUUID();
	const venueName = normalizeString(checkin.venue?.name) || 'place';
	return `${slugify(venueName)}-${id}`;
}

async function buildPdsCheckinRecord(
	checkin: SwarmCheckin,
	imageCache: Map<string, any>,
	options: { includePhotos?: boolean } = {}
) {
	const sourceId = normalizeString(checkin.id);

	if (!sourceId) {
		throw new Error('Swarm check-in is missing an id.');
	}

	const slug = buildCheckinSlug(checkin);
	const visitedAt = getVisitedAt(checkin);
	const venue = checkin.venue || {};
	const location = venue.location || {};
	const visibility = getVisibility(checkin);
	const latitude =
		typeof location.lat === 'number' && Number.isFinite(location.lat) ? location.lat : null;
	const longitude =
		typeof location.lng === 'number' && Number.isFinite(location.lng) ? location.lng : null;
	const includePhotos = options.includePhotos !== false;
	const photoItems = includePhotos && Array.isArray(checkin.photos?.items) ? checkin.photos.items : [];
	const photoUrls = photoItems.map(getPhotoUrl).filter(Boolean).slice(0, SWARM_MAX_PHOTOS);
	const session = photoUrls.length ? await getCheckinWriterSession() : null;
	const uploadedPhotos = [];

	if (session) {
		for (const photoUrl of photoUrls) {
			try {
				const blob = await uploadRemoteCheckinImage(session, photoUrl, imageCache);
				if (blob) {
					uploadedPhotos.push(blob);
				}
			} catch (photoError) {
				console.warn('[swarm] Unable to upload photo for check-in:', sourceId, photoError);
			}
		}
	}

	const primaryPhoto = uploadedPhotos[0] || null;
	const region = visibility === 'private' ? '' : joinIfPresent([location.city, location.state]);
	const record = {
		$type: 'blog.afterword.checkin',
		slug,
		name: normalizeString(venue.name) || 'Untitled place',
		...(normalizeString(checkin.shout) ? { note: normalizeString(checkin.shout) } : {}),
		...(normalizeString(checkin.shout)
			? { excerpt: normalizeString(checkin.shout).replace(/[.?!]+$/, '') }
			: {}),
		...(visibility !== 'private' && normalizeString(location.address)
			? { address: normalizeString(location.address) }
			: {}),
		...(visibility !== 'private' && region ? { region } : {}),
		...(visibility !== 'private' && normalizeString(location.country)
			? { country: normalizeString(location.country) }
			: {}),
		...(visibility !== 'private' && normalizeString(location.city)
			? { locality: normalizeString(location.city) }
			: {}),
		...(normalizeString(Intl.DateTimeFormat().resolvedOptions().timeZone || '')
			? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
			: {}),
		...(visibility !== 'private' && latitude !== null ? { latitude: latitude.toFixed(6) } : {}),
		...(visibility !== 'private' && longitude !== null ? { longitude: longitude.toFixed(6) } : {}),
		...(normalizeString(venue.url) ? { website: normalizeString(venue.url) } : {}),
		...(pickVenueCategory(venue.categories) ? { venueCategory: pickVenueCategory(venue.categories) } : {}),
		visibility,
		createdAt: compactIsoString(visitedAt),
		visitedAt: compactIsoString(visitedAt),
		...(primaryPhoto ? { photo: primaryPhoto } : {}),
		...(uploadedPhotos.length ? { photos: uploadedPhotos } : {})
	} satisfies Record<string, unknown>;

	return {
		record,
		sourceId
	};
}

async function syncCheckinItems(
	event: Pick<RequestEvent, 'platform'>,
	checkins: SwarmCheckin[],
	options: { includePhotos?: boolean } = {}
): Promise<SwarmSyncResult> {
	const imageCache = new Map<string, any>();
	const writerSession = await getCheckinWriterSession();
	const errors: Array<{ id: string; message: string }> = [];
	let imported = 0;
	let failed = 0;
	let lastSourceCheckinId: string | null = null;
	let latestSyncedCheckin: Checkin | null = null;

	for (const checkin of checkins) {
		const sourceId = normalizeString(checkin.id) || 'unknown';

		try {
			const nextRecord = await buildPdsCheckinRecord(checkin, imageCache, options);
			const existingMapping = await getCheckinRecordMapping(event, nextRecord.sourceId);

			if (existingMapping?.recordKey) {
				const result = await putCheckinRecord({
					rkey: existingMapping.recordKey,
					record: nextRecord.record
				});
				const recordUri = normalizeString(result.uri) || existingMapping.recordUri;
				const recordKey = getRecordKeyFromUri(recordUri) || existingMapping.recordKey;
				await saveCheckinRecordMapping(event, {
					sourceId: nextRecord.sourceId,
					recordUri,
					recordKey
				});
				const syncedCheckin = hydrateCheckinRecord(
					{
						uri: recordUri,
						cid: normalizeString(result.cid),
						value: nextRecord.record
					},
					writerSession.did,
					writerSession.serviceUrl
				);
				if (
					!latestSyncedCheckin ||
					syncedCheckin.visitedAt.getTime() > latestSyncedCheckin.visitedAt.getTime()
				) {
					latestSyncedCheckin = syncedCheckin;
				}
			} else {
				const result = await createCheckinRecord(nextRecord.record);
				const recordUri = normalizeString(result.uri);
				const recordKey = getRecordKeyFromUri(recordUri);

				if (!recordUri || !recordKey) {
					throw new Error('Swarm sync created a check-in record without a usable URI.');
				}

				await saveCheckinRecordMapping(event, {
					sourceId: nextRecord.sourceId,
					recordUri,
					recordKey
				});
				const syncedCheckin = hydrateCheckinRecord(
					{
						uri: recordUri,
						cid: normalizeString(result.cid),
						value: nextRecord.record
					},
					writerSession.did,
					writerSession.serviceUrl
				);
				if (
					!latestSyncedCheckin ||
					syncedCheckin.visitedAt.getTime() > latestSyncedCheckin.visitedAt.getTime()
				) {
					latestSyncedCheckin = syncedCheckin;
				}
			}
			imported += 1;
			lastSourceCheckinId = nextRecord.sourceId;
		} catch (syncError) {
			failed += 1;
			errors.push({
				id: sourceId,
				message: syncError instanceof Error ? syncError.message : 'Unable to sync Swarm check-in.'
			});
		}
	}

	if (latestSyncedCheckin) {
		await upsertLatestCheckinSnapshot(event, latestSyncedCheckin);
	}

	if (imported > 0) {
		await refreshCheckinsSnapshot(event).catch((snapshotError) => {
			console.warn('[swarm] Unable to refresh check-ins snapshot:', snapshotError);
		});
	}

	const now = new Date().toISOString();
	const previous = await getStoredState(event);

	await saveStoredState(event, {
		lastSyncedAt: now,
		lastError: errors.length ? errors[0]?.message || 'One or more check-ins failed to sync.' : null,
		lastSourceCheckinId: lastSourceCheckinId || previous.lastSourceCheckinId,
		syncCount: previous.syncCount + imported
	});

	return {
		ok: failed === 0,
		imported,
		failed,
		processed: checkins.length,
		lastSourceCheckinId: lastSourceCheckinId || previous.lastSourceCheckinId,
		errors
	};
}

async function fetchRecentSwarmCheckins(accessToken: string, limit: number) {
	const params = new URLSearchParams({
		limit: String(Math.max(1, Math.min(limit, 100)))
	});

	const payload = await fetchFoursquareJson<{
		response?: {
			checkins?: {
				items?: SwarmCheckin[];
			};
		};
	}>('/users/self/checkins', accessToken, params);

	return Array.isArray(payload.response?.checkins?.items) ? payload.response?.checkins?.items || [] : [];
}

export async function syncRecentSwarmCheckins(
	event: Pick<RequestEvent, 'platform'>,
	options: { limit?: number; includePhotos?: boolean } = {}
) {
	const stored = await getStoredState(event);

	if (!stored.accessToken) {
		throw new Error('Swarm is not connected yet.');
	}

	const recentCheckins = await fetchRecentSwarmCheckins(stored.accessToken, options.limit || 50);
	return await syncCheckinItems(event, recentCheckins, options);
}

export async function syncSingleSwarmCheckin(
	event: Pick<RequestEvent, 'platform'>,
	checkin: SwarmCheckin,
	options: { includePhotos?: boolean } = {}
) {
	return await syncCheckinItems(event, [checkin], options);
}

export async function handleSwarmPush(event: Pick<RequestEvent, 'request' | 'platform'>) {
	const expectedSecret = getFoursquarePushSecret();

	if (!expectedSecret) {
		throw error(503, 'FOURSQUARE_PUSH_SECRET is not configured.');
	}

	const formData = await event.request.formData();
	const submittedSecret = normalizeString(formData.get('secret'));

	if (!submittedSecret || submittedSecret !== expectedSecret) {
		throw error(401, 'Unauthorized');
	}

	const payload = normalizeString(formData.get('checkin'));
	if (!payload) {
		return null;
	}

	const checkin = JSON.parse(payload) as SwarmCheckin;
	return checkin;
}
