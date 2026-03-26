import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { stripImagesFromHtml, type BlogPost } from '$lib/server/ghost';
import type { SiteProfile } from '$lib/server/profile';

const RESOLVE_HANDLE_URL = 'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const GET_RECORD_NSID = 'com.atproto.repo.getRecord';
const LIST_RECORDS_NSID = 'com.atproto.repo.listRecords';
const UPLOAD_BLOB_NSID = 'com.atproto.repo.uploadBlob';
const LEGACY_LEAFLET_PUBLICATION_COLLECTION = 'pub.leaflet.publication';
const LEGACY_LEAFLET_BASE_PATH = 'afterword.leaflet.pub';

export const STANDARD_SITE_PUBLICATION_COLLECTION = 'site.standard.publication';
export const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';
export const STANDARD_SITE_PUBLICATION_RKEY = 'default';

type AtprotoSession = {
	serviceUrl: string;
	did: string;
	accessJwt: string;
	identifier: string;
};

type AtprotoBlob = {
	ref: { $link: string };
	mimeType: string;
	size: number;
	$type?: string;
};

function getStandardSiteServiceUrl() {
	return String(
		env.STANDARD_SITE_PDS_URL || env.ATPROTO_PDS_URL || env.PDS_URL || env.ATP_BASE_URL || ''
	)
		.trim()
		.replace(/\/+$/, '');
}

function getStandardSiteIdentifier() {
	return String(
		env.STANDARD_SITE_IDENTIFIER || env.ATPROTO_IDENTIFIER || env.ATP_IDENTIFIER || ''
	).trim();
}

function getStandardSiteAppPassword() {
	return String(
		env.STANDARD_SITE_APP_PASSWORD || env.ATPROTO_APP_PASSWORD || env.ATP_APP_PASSWORD || ''
	).trim();
}

function getOrigin(event: Pick<RequestEvent, 'url'>) {
	return event.url.origin.replace(/\/+$/, '');
}

function normalizeUrl(value: string) {
	return String(value || '')
		.trim()
		.replace(/\/+$/, '');
}

function inferImageMimeType(url: string) {
	const normalized = String(url || '').toLowerCase();
	if (normalized.endsWith('.png')) return 'image/png';
	if (normalized.endsWith('.webp')) return 'image/webp';
	if (normalized.endsWith('.gif')) return 'image/gif';
	if (normalized.endsWith('.avif')) return 'image/avif';
	return 'image/jpeg';
}

function stripHtml(value: string) {
	return String(value || '')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function toExcerpt(value: string, maxLength = 280) {
	const normalized = stripHtml(value);
	return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}…` : normalized;
}

async function resolveDid(identifier: string) {
	const normalized = String(identifier || '').trim();

	if (!normalized) {
		throw new Error('Standard Site identifier is not configured');
	}

	if (normalized.startsWith('did:')) {
		return normalized;
	}

	const response = await fetch(`${RESOLVE_HANDLE_URL}?handle=${encodeURIComponent(normalized)}`);
	if (!response.ok) {
		throw new Error(`Unable to resolve ATProto handle ${normalized}: ${response.status}`);
	}

	const payload = (await response.json()) as { did?: string };
	const did = String(payload?.did || '').trim();

	if (!did) {
		throw new Error(`ATProto handle ${normalized} did not resolve to a DID`);
	}

	return did;
}

async function createSession(): Promise<AtprotoSession> {
	const serviceUrl = getStandardSiteServiceUrl();
	const identifier = getStandardSiteIdentifier();
	const password = getStandardSiteAppPassword();

	if (!serviceUrl || !identifier || !password) {
		throw new Error(
			'Standard Site credentials are incomplete. Set STANDARD_SITE_PDS_URL, STANDARD_SITE_IDENTIFIER, and STANDARD_SITE_APP_PASSWORD.'
		);
	}

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
		throw new Error(`ATProto session creation failed with ${response.status}`);
	}

	const payload = (await response.json()) as { did?: string; accessJwt?: string };
	const did = String(payload?.did || '').trim();
	const accessJwt = String(payload?.accessJwt || '').trim();

	if (!did || !accessJwt) {
		throw new Error('ATProto session did not return a DID and access token');
	}

	return {
		serviceUrl,
		did,
		accessJwt,
		identifier
	};
}

async function putRecord<T>(session: AtprotoSession, collection: string, rkey: string, record: T) {
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

async function getRecord(session: AtprotoSession, collection: string, rkey: string) {
	const params = new URLSearchParams({
		repo: session.did,
		collection,
		rkey
	});
	const response = await fetch(`${session.serviceUrl}/xrpc/${GET_RECORD_NSID}?${params.toString()}`, {
		headers: {
			authorization: `Bearer ${session.accessJwt}`
		}
	});

	if (response.status === 404) return null;
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto getRecord failed for ${collection}/${rkey}: ${response.status} ${text}`);
	}

	return (await response.json()) as { uri?: string; cid?: string; value?: Record<string, unknown> };
}

async function listRecords(session: AtprotoSession, collection: string, limit = 100) {
	const params = new URLSearchParams({
		repo: session.did,
		collection,
		limit: String(limit)
	});
	const response = await fetch(`${session.serviceUrl}/xrpc/${LIST_RECORDS_NSID}?${params.toString()}`, {
		headers: {
			authorization: `Bearer ${session.accessJwt}`
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto listRecords failed for ${collection}: ${response.status} ${text}`);
	}

	return (await response.json()) as {
		records?: Array<{ uri?: string; cid?: string; value?: Record<string, unknown> }>;
	};
}

function getRecordKey(uri: string) {
	return String(uri || '').split('/').pop() || '';
}

async function findPreferredPublicationRecord(event: Pick<RequestEvent, 'url'>) {
	const session = await createSession();
	const origin = getOrigin(event);
	const payload = await listRecords(session, STANDARD_SITE_PUBLICATION_COLLECTION);
	const records = payload.records || [];

	const preferred =
		records.find((record) => normalizeUrl(String(record.value?.url || '')) === origin) || null;

	return {
		session,
		record: preferred
	};
}

async function findPreferredLeafletPublicationRecord(session: AtprotoSession) {
	const payload = await listRecords(session, LEGACY_LEAFLET_PUBLICATION_COLLECTION);
	const records = payload.records || [];

	return (
		records.find(
			(record) => String(record.value?.base_path || '').trim().toLowerCase() === LEGACY_LEAFLET_BASE_PATH
		) || null
	);
}

async function getPreferredDocumentPublicationAtUri(event: Pick<RequestEvent, 'url'>) {
	const session = await createSession();
	const leafletRecord = await findPreferredLeafletPublicationRecord(session);

	if (leafletRecord?.uri) {
		return leafletRecord.uri;
	}

	return (
		(await getStandardSitePublicationAtUri(event)) ||
		`at://${session.did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${STANDARD_SITE_PUBLICATION_RKEY}`
	);
}

export async function getStandardSiteDid() {
	const identifier = getStandardSiteIdentifier();
	if (!identifier) return null;

	try {
		return await resolveDid(identifier);
	} catch {
		return null;
	}
}

export async function getStandardSitePublicationAtUri(event?: Pick<RequestEvent, 'url'>) {
	if (event) {
		try {
			const { session, record } = await findPreferredPublicationRecord(event);
			if (record?.uri) return record.uri;
			return `at://${session.did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${STANDARD_SITE_PUBLICATION_RKEY}`;
		} catch {
			// Fall back to deterministic URI below.
		}
	}

	const did = await getStandardSiteDid();
	if (!did) return null;
	return `at://${did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${STANDARD_SITE_PUBLICATION_RKEY}`;
}

export async function getStandardSiteDocumentAtUri(slug: string) {
	const did = await getStandardSiteDid();
	if (!did || !slug) return null;
	return `at://${did}/${STANDARD_SITE_DOCUMENT_COLLECTION}/${slug}`;
}

export function createPublicationRecord(event: Pick<RequestEvent, 'url'>, profile: SiteProfile) {
	const origin = getOrigin(event);

	return {
		$type: STANDARD_SITE_PUBLICATION_COLLECTION,
		url: `${origin}/`,
		name: profile.displayName,
		description: profile.bio,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
}

export async function ensurePublicationRecord(event: Pick<RequestEvent, 'url'>, profile: SiteProfile) {
	const { session, record } = await findPreferredPublicationRecord(event);
	const publicationRecord = createPublicationRecord(event, profile);
	const rkey = record?.uri ? getRecordKey(record.uri) : STANDARD_SITE_PUBLICATION_RKEY;
	const result = await putRecord(
		session,
		STANDARD_SITE_PUBLICATION_COLLECTION,
		rkey,
		publicationRecord
	);

	return {
		...result,
		uri: result.uri || `at://${session.did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${rkey}`
	};
}

export async function getPublicationRecordStatus(event?: Pick<RequestEvent, 'url'>) {
	try {
		const session = await createSession();
		const payload = await listRecords(session, STANDARD_SITE_PUBLICATION_COLLECTION);
		const records = payload.records || [];
		if (event) {
			const origin = getOrigin(event);
			return (
				records.find((record) => normalizeUrl(String(record.value?.url || '')) === origin) ||
				records[0] ||
				null
			);
		}
		return records[0] || null;
	} catch {
		return null;
	}
}

export function createDocumentRecord(
	event: Pick<RequestEvent, 'url'>,
	post: BlogPost,
	publicationAtUri: string,
	coverImageBlob?: AtprotoBlob | null
) {
	const origin = getOrigin(event);
	const text = stripHtml(stripImagesFromHtml(post.html));

	return {
		$type: STANDARD_SITE_DOCUMENT_COLLECTION,
		site: publicationAtUri,
		path: post.path,
		url: `${origin}${post.path}`,
		title: post.title,
		description: post.excerpt || toExcerpt(text),
		textContent: text,
		text,
		...(coverImageBlob
			? {
					coverImage: {
						...coverImageBlob,
						$type: coverImageBlob.$type || 'blob'
					}
				}
			: {}),
		publishedAt: post.publishedAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
		tags: post.publicTags.map((tag) => tag.slug)
	};
}

async function uploadCoverImageBlob(session: AtprotoSession, post: BlogPost) {
	const coverImageUrl = String(post.coverImage || '').trim();
	if (!coverImageUrl) return null;

	const response = await fetch(coverImageUrl, {
		headers: {
			accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
		}
	});

	if (!response.ok) {
		throw new Error(`Unable to fetch cover image: ${response.status} ${coverImageUrl}`);
	}

	const headerMimeType = String(response.headers.get('content-type') || '')
		.split(';')[0]
		.trim()
		.toLowerCase();
	const mimeType =
		headerMimeType && headerMimeType.startsWith('image/')
			? headerMimeType
			: inferImageMimeType(coverImageUrl);
	const buffer = await response.arrayBuffer();

	if (!buffer.byteLength) {
		throw new Error(`Cover image download was empty: ${coverImageUrl}`);
	}

	return await uploadBlob(session, buffer, mimeType);
}

export async function syncGhostPostToStandardSite(
	event: Pick<RequestEvent, 'url'>,
	post: BlogPost,
	profile: SiteProfile
) {
	const session = await createSession();
	const publicationAtUri = await getPreferredDocumentPublicationAtUri(event);

	const publicationResult = await ensurePublicationRecord(event, profile);
	let coverImageBlob: AtprotoBlob | null = null;
	if (post.coverImage) {
		try {
			coverImageBlob = await uploadCoverImageBlob(session, post);
		} catch (error) {
			console.warn(
				'[standard-site] Unable to upload cover image blob:',
				error instanceof Error ? error.message : error
			);
		}
	}

	const record = createDocumentRecord(event, post, publicationAtUri, coverImageBlob);
	const result = await putRecord(session, STANDARD_SITE_DOCUMENT_COLLECTION, post.slug, record);

	return {
		...result,
		uri: result.uri || `at://${session.did}/${STANDARD_SITE_DOCUMENT_COLLECTION}/${post.slug}`,
		publicationUri: publicationResult.uri
	};
}

export async function getStandardSiteDocumentStatus(slug: string) {
	if (!slug) return null;

	try {
		const session = await createSession();
		return await getRecord(session, STANDARD_SITE_DOCUMENT_COLLECTION, slug);
	} catch {
		return null;
	}
}
