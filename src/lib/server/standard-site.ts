import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { stripImagesFromHtml, type BlogPost } from '$lib/server/ghost';
import { inferImageDimensions, inferImageMimeType } from '$lib/server/image-metadata';
import type { SiteProfile } from '$lib/server/profile';
import { resolveAtprotoDid, resolveAtprotoService } from '$lib/server/atproto-identity';

const CREATE_SESSION_NSID = 'com.atproto.server.createSession';
const CREATE_RECORD_NSID = 'com.atproto.repo.createRecord';
const PUT_RECORD_NSID = 'com.atproto.repo.putRecord';
const DELETE_RECORD_NSID = 'com.atproto.repo.deleteRecord';
const GET_RECORD_NSID = 'com.atproto.repo.getRecord';
const LIST_RECORDS_NSID = 'com.atproto.repo.listRecords';
const UPLOAD_BLOB_NSID = 'com.atproto.repo.uploadBlob';
const LEGACY_LEAFLET_PUBLICATION_COLLECTION = 'pub.leaflet.publication';
const LEGACY_LEAFLET_BASE_PATH = 'afterword.leaflet.pub';
const SESSION_CACHE_TTL_MS = 1000 * 60 * 20;
const MAX_INLINE_IMAGE_UPLOADS_PER_SYNC = 3;

export const STANDARD_SITE_PUBLICATION_COLLECTION = 'site.standard.publication';
export const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';
export const STANDARD_SITE_PUBLICATION_RKEY = 'default';

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

type LeafletAspectRatio = { width: number; height: number };

type UploadedLeafletImage = {
	blob: AtprotoBlob;
	aspectRatio?: LeafletAspectRatio;
};

type LeafletBlock = {
	$type: 'pub.leaflet.pages.linearDocument#block';
	block:
		| { $type: 'pub.leaflet.blocks.text'; plaintext: string }
		| { $type: 'pub.leaflet.blocks.header'; level: number; plaintext: string }
		| { $type: 'pub.leaflet.blocks.blockquote'; plaintext: string }
		| { $type: 'pub.leaflet.blocks.horizontalRule' }
		| {
				$type: 'pub.leaflet.blocks.image';
				image: AtprotoBlob;
				aspectRatio?: LeafletAspectRatio;
		  };
};

let standardSiteSessionCache: CachedAtprotoSession | null = null;
let standardSiteSessionPromise: Promise<AtprotoSession> | null = null;

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

function getStandardSiteLoginIdentifiers() {
	return [
		env.STANDARD_SITE_LOGIN_IDENTIFIER,
		env.ATPROTO_LOGIN_IDENTIFIER,
		env.ATP_LOGIN_IDENTIFIER,
		env.STANDARD_SITE_EMAIL,
		env.ATPROTO_EMAIL,
		env.ATP_EMAIL,
		env.STANDARD_SITE_IDENTIFIER,
		env.ATPROTO_IDENTIFIER,
		env.ATP_IDENTIFIER
	]
		.map((value) => String(value || '').trim())
		.filter(Boolean)
		.filter((value, index, values) => values.indexOf(value) === index);
}

function getStandardSiteAppPassword() {
	return String(
		env.STANDARD_SITE_APP_PASSWORD || env.ATPROTO_APP_PASSWORD || env.ATP_APP_PASSWORD || ''
	).trim();
}

function formatStandardSiteSessionError(
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

function getOrigin(event: Pick<RequestEvent, 'url'>) {
	return event.url.origin.replace(/\/+$/, '');
}

function normalizeUrl(value: string) {
	return String(value || '')
		.trim()
		.replace(/\/+$/, '');
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

function decodeHtml(value: string) {
	return String(value || '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function firstMatch(text: string, pattern: string, captureGroup = 1, options: string = 'gis') {
	const regex = new RegExp(pattern, options);
	const match = regex.exec(text);
	return match?.[captureGroup] || null;
}

function allMatches(text: string, pattern: string, captureGroup = 1, options: string = 'gis') {
	const regex = new RegExp(pattern, options);
	return Array.from(text.matchAll(regex), (match) => match[captureGroup] || '').filter(Boolean);
}

function toExcerpt(value: string, maxLength = 280) {
	const normalized = stripHtml(value);
	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength - 1).trim()}…`
		: normalized;
}

async function getStandardSiteIdentity() {
	const identifier = getStandardSiteIdentifier();
	const configuredServiceUrl = getStandardSiteServiceUrl();

	if (!identifier) {
		throw new Error('Standard Site identifier is not configured');
	}

	try {
		return await resolveAtprotoService(identifier);
	} catch (error) {
		if (!configuredServiceUrl) {
			throw error;
		}

		return {
			did: await resolveAtprotoDid(identifier),
			serviceUrl: configuredServiceUrl
		};
	}
}

async function createSession(): Promise<AtprotoSession> {
	const identifier = getStandardSiteIdentifier();
	const loginIdentifiers = getStandardSiteLoginIdentifiers();
	const password = getStandardSiteAppPassword();

	if (!identifier || !password || !loginIdentifiers.length) {
		throw new Error(
			'Standard Site credentials are incomplete. Set STANDARD_SITE_APP_PASSWORD plus a repo or login identifier.'
		);
	}

	const { did: resolvedDid, serviceUrl } = await getStandardSiteIdentity();

	if (
		standardSiteSessionCache &&
		standardSiteSessionCache.expiresAt > Date.now() &&
		standardSiteSessionCache.serviceUrl === serviceUrl &&
		loginIdentifiers.includes(standardSiteSessionCache.identifier)
	) {
		return standardSiteSessionCache;
	}

	if (standardSiteSessionPromise) {
		return await standardSiteSessionPromise;
	}

	standardSiteSessionPromise = (async () => {
		let lastError: Error | null = null;
		let lastStatus: number | null = null;
		let lastIdentifier: string | null = null;

		for (const loginIdentifier of loginIdentifiers) {
			try {
				const response = await fetch(`${serviceUrl}/xrpc/${CREATE_SESSION_NSID}`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						identifier: loginIdentifier,
						password
					})
				});

				if (!response.ok) {
					lastStatus = response.status;
					lastIdentifier = loginIdentifier;
					lastError = new Error(
						formatStandardSiteSessionError(loginIdentifiers, lastStatus, lastIdentifier)
					);
					continue;
				}

				const payload = (await response.json()) as { did?: string; accessJwt?: string };
				const did = String(payload?.did || resolvedDid).trim();
				const accessJwt = String(payload?.accessJwt || '').trim();

				if (!did || !accessJwt) {
					lastError = new Error('ATProto session did not return a DID and access token');
					continue;
				}

				const session: CachedAtprotoSession = {
					serviceUrl,
					did,
					accessJwt,
					identifier: loginIdentifier,
					expiresAt: Date.now() + SESSION_CACHE_TTL_MS
				};
				standardSiteSessionCache = session;
				return session;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('ATProto session creation failed');
			}
		}

		throw (
			lastError ||
			new Error(formatStandardSiteSessionError(loginIdentifiers, lastStatus, lastIdentifier))
		);
	})();

	try {
		return await standardSiteSessionPromise;
	} finally {
		standardSiteSessionPromise = null;
	}
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
		throw new Error(
			`ATProto putRecord failed for ${collection}/${rkey}: ${response.status} ${text}`
		);
	}

	return (await response.json()) as { uri?: string; cid?: string };
}

async function createRecord<T>(session: AtprotoSession, collection: string, record: T) {
	const response = await fetch(`${session.serviceUrl}/xrpc/${CREATE_RECORD_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			repo: session.did,
			collection,
			record,
			validate: false
		})
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto createRecord failed for ${collection}: ${response.status} ${text}`);
	}

	return (await response.json()) as { uri?: string; cid?: string };
}

async function deleteRecord(session: AtprotoSession, collection: string, rkey: string) {
	const response = await fetch(`${session.serviceUrl}/xrpc/${DELETE_RECORD_NSID}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${session.accessJwt}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			repo: session.did,
			collection,
			rkey
		})
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`ATProto deleteRecord failed for ${collection}/${rkey}: ${response.status} ${text}`
		);
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

async function uploadLeafletImage(
	session: AtprotoSession,
	buffer: ArrayBuffer,
	mimeType: string
): Promise<UploadedLeafletImage> {
	const blob = await uploadBlob(session, buffer, mimeType);
	return {
		blob,
		aspectRatio: inferImageDimensions(buffer, mimeType)
	};
}

async function getRecord(session: AtprotoSession, collection: string, rkey: string) {
	const params = new URLSearchParams({
		repo: session.did,
		collection,
		rkey
	});
	const response = await fetch(
		`${session.serviceUrl}/xrpc/${GET_RECORD_NSID}?${params.toString()}`
	);

	if (response.status === 404) return null;
	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`ATProto getRecord failed for ${collection}/${rkey}: ${response.status} ${text}`
		);
	}

	return (await response.json()) as { uri?: string; cid?: string; value?: Record<string, unknown> };
}

async function listRecords(session: AtprotoSession, collection: string, limit = 100) {
	const params = new URLSearchParams({
		repo: session.did,
		collection,
		limit: String(limit)
	});
	const response = await fetch(
		`${session.serviceUrl}/xrpc/${LIST_RECORDS_NSID}?${params.toString()}`
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`ATProto listRecords failed for ${collection}: ${response.status} ${text}`);
	}

	return (await response.json()) as {
		records?: Array<{ uri?: string; cid?: string; value?: Record<string, unknown> }>;
	};
}

function getRecordKey(uri: string) {
	return (
		String(uri || '')
			.split('/')
			.pop() || ''
	);
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
			(record) =>
				String(record.value?.base_path || '')
					.trim()
					.toLowerCase() === LEGACY_LEAFLET_BASE_PATH
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

function matchesGhostPostRecord(
	record: { uri?: string; value?: Record<string, unknown> } | null | undefined,
	post: BlogPost,
	origin: string
) {
	if (!record) return false;
	const value = record.value || {};
	const canonicalUrl = `${origin}${post.path}`;
	const rkey = getRecordKey(String(record.uri || ''));
	return (
		String(value.sourceUrl || '') === post.sourceUrl ||
		String(value.ghostPostId || '') === post.id ||
		(String(value.title || '') === post.title &&
			String(value.publishedAt || '') === post.publishedAt.toISOString()) ||
		String(value.url || '') === canonicalUrl ||
		String(value.path || '') === post.path ||
		String(value.path || '') === `/${post.slug}` ||
		rkey === post.slug
	);
}

export async function getStandardSiteDid() {
	const identifier = getStandardSiteIdentifier();
	if (!identifier) return null;

	try {
		return await resolveAtprotoDid(identifier);
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

function isLeafletPublicationAtUri(publicationAtUri: string) {
	return String(publicationAtUri || '').includes(`/${LEGACY_LEAFLET_PUBLICATION_COLLECTION}/`);
}

function getLeafletPublicUrl(rkey: string) {
	return rkey ? `https://${LEGACY_LEAFLET_BASE_PATH}/${rkey}` : null;
}

function createLeafletTextBlocks(text: string) {
	return text
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((plaintext) => ({
			$type: 'pub.leaflet.pages.linearDocument#block',
			block: {
				$type: 'pub.leaflet.blocks.text',
				plaintext
			}
		}));
}

function textBlock(plaintext: string): LeafletBlock {
	return {
		$type: 'pub.leaflet.pages.linearDocument#block',
		block: {
			$type: 'pub.leaflet.blocks.text',
			plaintext
		}
	};
}

function imageBlock(image: UploadedLeafletImage | AtprotoBlob): LeafletBlock {
	const blob = 'blob' in image ? image.blob : image;
	const aspectRatio = 'blob' in image ? image.aspectRatio : undefined;
	return {
		$type: 'pub.leaflet.pages.linearDocument#block',
		block: {
			$type: 'pub.leaflet.blocks.image',
			image: {
				...blob,
				$type: blob.$type || 'blob'
			},
			...(aspectRatio ? { aspectRatio } : {})
		}
	};
}

function normalizeLeafletText(value: string) {
	return decodeHtml(
		String(value || '')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n\n')
			.replace(/<\/div>/gi, '\n\n')
			.replace(/<\/li>/gi, '\n')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\r/g, '')
	)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

async function uploadRemoteImageBlob(
	session: AtprotoSession,
	rawUrl: string,
	cache: Map<string, UploadedLeafletImage>
) {
	const normalized = String(rawUrl || '').trim();
	if (!normalized) return null;
	if (cache.has(normalized)) return cache.get(normalized) || null;

	const response = await fetch(normalized, {
		headers: {
			accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
		}
	});

	if (!response.ok) {
		throw new Error(`Unable to fetch inline image: ${response.status} ${normalized}`);
	}

	const headerMimeType = String(response.headers.get('content-type') || '')
		.split(';')[0]
		.trim()
		.toLowerCase();
	const mimeType =
		headerMimeType && headerMimeType.startsWith('image/')
			? headerMimeType
			: inferImageMimeType(normalized);
	const buffer = await response.arrayBuffer();

	if (!buffer.byteLength) return null;

	const uploaded = await uploadLeafletImage(session, buffer, mimeType);
	cache.set(normalized, uploaded);
	return uploaded;
}

async function buildLeafletBlocksFromHtml(
	session: AtprotoSession,
	html: string
): Promise<LeafletBlock[]> {
	const source = String(html || '').trim();
	if (!source) return [];

	const imageCache = new Map<string, UploadedLeafletImage>();
	const blocks: LeafletBlock[] = [];
	let uploadedImageCount = 0;
	const chunkPattern =
		/<figure\b[\s\S]*?<\/figure>|<h[1-6]\b[\s\S]*?<\/h[1-6]>|<blockquote\b[\s\S]*?<\/blockquote>|<hr\b[^>]*>|<p\b[\s\S]*?<\/p>|<ul\b[\s\S]*?<\/ul>|<ol\b[\s\S]*?<\/ol>/gi;
	const chunks = source.match(chunkPattern) || [source];

	for (const rawChunk of chunks) {
		const chunk = rawChunk.trim();
		if (!chunk) continue;

		if (/^<hr\b/i.test(chunk)) {
			blocks.push({
				$type: 'pub.leaflet.pages.linearDocument#block',
				block: { $type: 'pub.leaflet.blocks.horizontalRule' }
			});
			continue;
		}

		const headingLevel = firstMatch(chunk, '<h([1-6])\\b[\\s\\S]*?>([\\s\\S]*?)<\\/h[1-6]>', 1);
		const headingText = firstMatch(chunk, '<h([1-6])\\b[\\s\\S]*?>([\\s\\S]*?)<\\/h[1-6]>', 2);
		if (headingLevel && headingText) {
			const plaintext = normalizeLeafletText(headingText);
			if (plaintext) {
				blocks.push({
					$type: 'pub.leaflet.pages.linearDocument#block',
					block: {
						$type: 'pub.leaflet.blocks.header',
						level: Math.min(Math.max(Number(headingLevel), 1), 3),
						plaintext
					}
				});
			}
			continue;
		}

		const quoteText = firstMatch(chunk, '<blockquote\\b[\\s\\S]*?>([\\s\\S]*?)<\\/blockquote>');
		if (quoteText) {
			const plaintext = normalizeLeafletText(quoteText);
			if (plaintext) {
				blocks.push({
					$type: 'pub.leaflet.pages.linearDocument#block',
					block: {
						$type: 'pub.leaflet.blocks.blockquote',
						plaintext
					}
				});
			}
			continue;
		}

		if (/^<figure\b/i.test(chunk)) {
			const imageUrls = allMatches(chunk, '<img[^>]+src="([^"]+)"');
			if (imageUrls.length) {
				for (const imageUrl of imageUrls) {
					if (uploadedImageCount >= MAX_INLINE_IMAGE_UPLOADS_PER_SYNC) {
						break;
					}
					try {
						const uploaded = await uploadRemoteImageBlob(session, imageUrl, imageCache);
						if (uploaded) {
							blocks.push(imageBlock(uploaded));
							uploadedImageCount += 1;
						}
					} catch (error) {
						console.warn(
							'[standard-site] Unable to upload inline image blob:',
							error instanceof Error ? error.message : error
						);
					}
				}
				const residualText = normalizeLeafletText(
					chunk.replace(/<img[^>]*>/gi, ' ').replace(/<figure[^>]*>|<\/figure>/gi, ' ')
				);
				if (residualText) blocks.push(textBlock(residualText));
				continue;
			}
		}

		if (/^<(ul|ol)\b/i.test(chunk)) {
			const items = allMatches(chunk, '<li[^>]*>([\\s\\S]*?)<\\/li>')
				.map(normalizeLeafletText)
				.filter(Boolean);
			for (const item of items) blocks.push(textBlock(`• ${item}`));
			continue;
		}

		const plaintext = normalizeLeafletText(chunk);
		if (plaintext) {
			blocks.push(textBlock(plaintext));
		}
	}

	return blocks;
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

export async function ensurePublicationRecord(
	event: Pick<RequestEvent, 'url'>,
	profile: SiteProfile
) {
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
	coverImageBlob?: UploadedLeafletImage | null,
	documentPathOverride?: string,
	leafletBlocksOverride?: LeafletBlock[]
) {
	const origin = getOrigin(event);
	const text = stripHtml(stripImagesFromHtml(post.html));
	const isLeafletPublication = isLeafletPublicationAtUri(publicationAtUri);
	const documentPath = documentPathOverride || (isLeafletPublication ? `/${post.slug}` : post.path);

	return {
		$type: STANDARD_SITE_DOCUMENT_COLLECTION,
		site: publicationAtUri,
		path: documentPath,
		...(isLeafletPublication ? {} : { url: `${origin}${post.path}` }),
		sourceUrl: post.sourceUrl,
		ghostPostId: post.id,
		title: post.title,
		description: post.excerpt || toExcerpt(text),
		...(isLeafletPublication
			? {
					content: {
						$type: 'pub.leaflet.content',
						pages: [
							{
								id: crypto.randomUUID(),
								$type: 'pub.leaflet.pages.linearDocument',
								blocks:
									leafletBlocksOverride && leafletBlocksOverride.length
										? leafletBlocksOverride
										: createLeafletTextBlocks(text)
							}
						]
					}
				}
			: {}),
		textContent: text,
		text,
		...(coverImageBlob
			? {
					coverImage: {
						...coverImageBlob.blob,
						$type: coverImageBlob.blob.$type || 'blob'
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

	return await uploadLeafletImage(session, buffer, mimeType);
}

export async function syncGhostPostToStandardSite(
	event: Pick<RequestEvent, 'url'>,
	post: BlogPost,
	profile: SiteProfile
) {
	const session = await createSession();
	const origin = getOrigin(event);
	const allDocumentsPayload = await listRecords(session, STANDARD_SITE_DOCUMENT_COLLECTION);
	const allDocuments = allDocumentsPayload.records || [];
	const matchingExistingRecords = allDocuments.filter((record) =>
		matchesGhostPostRecord(record, post, origin)
	);
	const matchingLeafletRecord =
		matchingExistingRecords.find((record) =>
			isLeafletPublicationAtUri(String(record.value?.site || ''))
		) || null;
	const preferredPublicationAtUri = await getPreferredDocumentPublicationAtUri(event);
	const publicationAtUri = matchingLeafletRecord?.value?.site
		? String(matchingLeafletRecord.value.site)
		: preferredPublicationAtUri;
	const isLeafletPublication = isLeafletPublicationAtUri(publicationAtUri);

	const publicationResult = await ensurePublicationRecord(event, profile);
	let coverImageBlob: UploadedLeafletImage | null = null;
	let leafletBlocks: LeafletBlock[] | undefined;
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
	if (isLeafletPublication) {
		try {
			leafletBlocks = await buildLeafletBlocksFromHtml(session, post.html);
		} catch (error) {
			console.warn(
				'[standard-site] Unable to build rich Leaflet content:',
				error instanceof Error ? error.message : error
			);
		}
		if (coverImageBlob) {
			const hasImageBlocks = (leafletBlocks || []).some(
				(block) => block.block.$type === 'pub.leaflet.blocks.image'
			);
			if (!hasImageBlocks) {
				leafletBlocks = [imageBlock(coverImageBlob), ...(leafletBlocks || [])];
			}
		}
	}

	if (isLeafletPublication) {
		const existingLeafletRecords = matchingExistingRecords
			.filter((record) => String(record.value?.site || '') === publicationAtUri)
			.sort((a, b) => {
				const aSlug = getRecordKey(String(a.uri || '')) === post.slug ? 1 : 0;
				const bSlug = getRecordKey(String(b.uri || '')) === post.slug ? 1 : 0;
				return aSlug - bSlug;
			});
		const existingLeafletRecord = existingLeafletRecords[0] || null;
		const duplicateLeafletRecords = existingLeafletRecords.slice(1);

		if (existingLeafletRecord?.uri) {
			const oldRkey = getRecordKey(existingLeafletRecord.uri);
			const looksLikeLegacySlugKey = oldRkey === post.slug;
			if (looksLikeLegacySlugKey) {
				await deleteRecord(session, STANDARD_SITE_DOCUMENT_COLLECTION, oldRkey);
			} else {
				for (const duplicate of duplicateLeafletRecords) {
					if (duplicate.uri) {
						await deleteRecord(
							session,
							STANDARD_SITE_DOCUMENT_COLLECTION,
							getRecordKey(duplicate.uri)
						);
					}
				}
				const updatedRecord = createDocumentRecord(
					event,
					post,
					publicationAtUri,
					coverImageBlob,
					String(existingLeafletRecord.value?.path || '') || `/${oldRkey}`,
					leafletBlocks
				);
				const result = await putRecord(
					session,
					STANDARD_SITE_DOCUMENT_COLLECTION,
					oldRkey,
					updatedRecord
				);
				return {
					...result,
					uri: result.uri || existingLeafletRecord.uri,
					publicationUri: publicationResult.uri
				};
			}
		}

		const provisionalRecord = createDocumentRecord(
			event,
			post,
			publicationAtUri,
			coverImageBlob,
			undefined,
			leafletBlocks
		);
		const created = await createRecord(
			session,
			STANDARD_SITE_DOCUMENT_COLLECTION,
			provisionalRecord
		);
		const createdRkey = getRecordKey(created.uri || '');
		if (!createdRkey) {
			throw new Error('ATProto createRecord did not return a document URI');
		}
		for (const duplicate of duplicateLeafletRecords) {
			if (duplicate.uri) {
				await deleteRecord(session, STANDARD_SITE_DOCUMENT_COLLECTION, getRecordKey(duplicate.uri));
			}
		}
		const finalizedRecord = createDocumentRecord(
			event,
			post,
			publicationAtUri,
			coverImageBlob,
			`/${createdRkey}`,
			leafletBlocks
		);
		const result = await putRecord(
			session,
			STANDARD_SITE_DOCUMENT_COLLECTION,
			createdRkey,
			finalizedRecord
		);
		return {
			...result,
			uri: result.uri || created.uri,
			publicationUri: publicationResult.uri
		};
	}

	const record = createDocumentRecord(event, post, publicationAtUri, coverImageBlob);
	const result = await putRecord(session, STANDARD_SITE_DOCUMENT_COLLECTION, post.slug, record);

	return {
		...result,
		uri: result.uri || `at://${session.did}/${STANDARD_SITE_DOCUMENT_COLLECTION}/${post.slug}`,
		publicationUri: publicationResult.uri
	};
}

export async function getStandardSiteDocumentStatus(
	event: Pick<RequestEvent, 'url'>,
	post: BlogPost
) {
	if (!post?.slug) return null;

	try {
		const session = await createSession();
		const payload = await listRecords(session, STANDARD_SITE_DOCUMENT_COLLECTION);
		const records = payload.records || [];
		const origin = getOrigin(event);
		const matches = records.filter((record) => matchesGhostPostRecord(record, post, origin));
		return (
			matches.sort((a, b) => {
				const aLeaflet = isLeafletPublicationAtUri(String(a.value?.site || '')) ? 1 : 0;
				const bLeaflet = isLeafletPublicationAtUri(String(b.value?.site || '')) ? 1 : 0;
				if (aLeaflet !== bLeaflet) return bLeaflet - aLeaflet;
				const aSlug = getRecordKey(String(a.uri || '')) === post.slug ? 1 : 0;
				const bSlug = getRecordKey(String(b.uri || '')) === post.slug ? 1 : 0;
				if (aSlug !== bSlug) return aSlug - bSlug;
				return 0;
			})[0] || null
		);
	} catch {
		return null;
	}
}

export async function getStandardSiteDocumentStatuses(
	event: Pick<RequestEvent, 'url'>,
	posts: BlogPost[]
) {
	const relevantPosts = posts.filter((post) => post?.slug);
	if (!relevantPosts.length)
		return new Map<
			string,
			{ uri?: string; cid?: string; value?: Record<string, unknown> } | null
		>();

	try {
		const session = await createSession();
		const payload = await listRecords(session, STANDARD_SITE_DOCUMENT_COLLECTION);
		const records = payload.records || [];
		const origin = getOrigin(event);
		const results = new Map<
			string,
			{ uri?: string; cid?: string; value?: Record<string, unknown> } | null
		>();

		for (const post of relevantPosts) {
			const matches = records.filter((record) => matchesGhostPostRecord(record, post, origin));
			const best =
				matches.sort((a, b) => {
					const aLeaflet = isLeafletPublicationAtUri(String(a.value?.site || '')) ? 1 : 0;
					const bLeaflet = isLeafletPublicationAtUri(String(b.value?.site || '')) ? 1 : 0;
					if (aLeaflet !== bLeaflet) return bLeaflet - aLeaflet;
					const aSlug = getRecordKey(String(a.uri || '')) === post.slug ? 1 : 0;
					const bSlug = getRecordKey(String(b.uri || '')) === post.slug ? 1 : 0;
					if (aSlug !== bSlug) return aSlug - bSlug;
					return 0;
				})[0] || null;
			results.set(post.slug, best);
		}

		return results;
	} catch {
		return new Map<
			string,
			{ uri?: string; cid?: string; value?: Record<string, unknown> } | null
		>();
	}
}
