import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { stripImagesFromHtml, type BlogPost } from '$lib/server/ghost';
import type { SiteProfile } from '$lib/server/profile';

const RESOLVE_HANDLE_URL = 'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle';
const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const GET_RECORD_NSID = 'com.atproto.repo.getRecord';

export const STANDARD_SITE_PUBLICATION_COLLECTION = 'site.standard.publication';
export const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';
export const STANDARD_SITE_PUBLICATION_RKEY = 'default';

type AtprotoSession = {
	serviceUrl: string;
	did: string;
	accessJwt: string;
	identifier: string;
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

export async function getStandardSiteDid() {
	const identifier = getStandardSiteIdentifier();
	if (!identifier) return null;

	try {
		return await resolveDid(identifier);
	} catch {
		return null;
	}
}

export async function getStandardSitePublicationAtUri() {
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
	const session = await createSession();
	const publicationRecord = createPublicationRecord(event, profile);
	const result = await putRecord(
		session,
		STANDARD_SITE_PUBLICATION_COLLECTION,
		STANDARD_SITE_PUBLICATION_RKEY,
		publicationRecord
	);

	return {
		...result,
		uri:
			result.uri ||
			`at://${session.did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${STANDARD_SITE_PUBLICATION_RKEY}`
	};
}

export async function getPublicationRecordStatus() {
	const did = await getStandardSiteDid();
	if (!did) return null;

	try {
		const session = await createSession();
		return await getRecord(session, STANDARD_SITE_PUBLICATION_COLLECTION, STANDARD_SITE_PUBLICATION_RKEY);
	} catch {
		return null;
	}
}

export function createDocumentRecord(
	event: Pick<RequestEvent, 'url'>,
	post: BlogPost,
	publicationAtUri: string
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
		text,
		publishedAt: post.publishedAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
		tags: post.publicTags.map((tag) => tag.slug)
	};
}

export async function syncGhostPostToStandardSite(
	event: Pick<RequestEvent, 'url'>,
	post: BlogPost,
	profile: SiteProfile
) {
	const session = await createSession();
	const publicationAtUri =
		(await getStandardSitePublicationAtUri()) ||
		`at://${session.did}/${STANDARD_SITE_PUBLICATION_COLLECTION}/${STANDARD_SITE_PUBLICATION_RKEY}`;

	await putRecord(
		session,
		STANDARD_SITE_PUBLICATION_COLLECTION,
		STANDARD_SITE_PUBLICATION_RKEY,
		createPublicationRecord(event, profile)
	);

	const record = createDocumentRecord(event, post, publicationAtUri);
	const result = await putRecord(session, STANDARD_SITE_DOCUMENT_COLLECTION, post.slug, record);

	return {
		...result,
		uri: result.uri || `at://${session.did}/${STANDARD_SITE_DOCUMENT_COLLECTION}/${post.slug}`
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
