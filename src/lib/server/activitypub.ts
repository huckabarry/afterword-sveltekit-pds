import { env } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import type { SiteProfile } from '$lib/server/profile';

const ACTIVITY_STREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const SECURITY_CONTEXT = 'https://w3id.org/security/v1';
const DEFAULT_USERNAME = 'bryan';
const ALT_USERNAME = 'afterword';
const DEFAULT_MOVE_TARGET = 'https://micro.blog/activitypub/bryan';

export const ACTOR_PATH = '/ap/actor';
export const INBOX_PATH = '/ap/inbox';
export const OUTBOX_PATH = '/ap/outbox';
export const FOLLOWERS_PATH = '/ap/followers';
export const FOLLOWING_PATH = '/ap/following';

function toAbsoluteUrl(origin: string, value: string | null | undefined) {
	if (!value) return null;
	return value.startsWith('http') ? value : `${origin}${value}`;
}

export function getActivityPubOrigin(event: Pick<RequestEvent, 'url'>) {
	return event.url.origin;
}

export function getActorId(origin: string) {
	return `${origin}${ACTOR_PATH}`;
}

export function getInboxId(origin: string) {
	return `${origin}${INBOX_PATH}`;
}

export function getOutboxId(origin: string) {
	return `${origin}${OUTBOX_PATH}`;
}

export function getFollowersId(origin: string) {
	return `${origin}${FOLLOWERS_PATH}`;
}

export function getFollowingId(origin: string) {
	return `${origin}${FOLLOWING_PATH}`;
}

export function getActorAliases(origin: string) {
	const host = new URL(origin).host;
	return [`acct:${DEFAULT_USERNAME}@${host}`, `acct:${ALT_USERNAME}@${host}`];
}

export function getPreferredUsername() {
	return DEFAULT_USERNAME;
}

export function getActivityPubKeyId(origin: string) {
	return String(env.ACTIVITYPUB_KEY_ID || '').trim() || `${getActorId(origin)}#main-key`;
}

export function getActivityPubPublicKeyPem() {
	return String(env.ACTIVITYPUB_PUBLIC_KEY_PEM || '').trim() || null;
}

export function getMovedToActorUrl() {
	return DEFAULT_MOVE_TARGET;
}

export function activityJson(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body, null, 2), {
		...init,
		headers: {
			'content-type': 'application/activity+json; charset=utf-8',
			...(init?.headers || {})
		}
	});
}

export function jrdJson(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body, null, 2), {
		...init,
		headers: {
			'content-type': 'application/jrd+json; charset=utf-8',
			...(init?.headers || {})
		}
	});
}

export function createEmptyOrderedCollection(id: string) {
	return {
		'@context': ACTIVITY_STREAMS_CONTEXT,
		id,
		type: 'OrderedCollection',
		totalItems: 0,
		orderedItems: []
	};
}

export function createActor(origin: string, profile?: SiteProfile) {
	const actorId = getActorId(origin);
	const actorProfile = profile ?? {
		displayName: 'Bryan Robb',
		avatarUrl: '/assets/images/status-avatar.jpg',
		headerImageUrl: null,
		bio: 'Writer, photographer, and urban planner publishing from Afterword.',
		aboutBody: '',
		aboutInterests: [],
		verificationLinks: [],
		migrationAliases: [],
		moveTargetHandle: null,
		moveTargetActorUrl: null,
		moveStartedAt: null
	};
	const publicKeyPem = getActivityPubPublicKeyPem();
	const movedSummary = actorProfile.bio.includes('micro.blog')
		? actorProfile.bio
		: `${actorProfile.bio} This ActivityPub account has moved to bryan@micro.blog.`;

	return {
		'@context': [ACTIVITY_STREAMS_CONTEXT, SECURITY_CONTEXT],
		id: actorId,
		type: 'Person',
		preferredUsername: DEFAULT_USERNAME,
		name: actorProfile.displayName,
		summary: movedSummary,
		url: `${origin}/about`,
		icon: {
			type: 'Image',
			mediaType: 'image/jpeg',
			url: toAbsoluteUrl(origin, actorProfile.avatarUrl)
		},
		...(actorProfile.headerImageUrl
			? {
					image: {
						type: 'Image',
						url: toAbsoluteUrl(origin, actorProfile.headerImageUrl)
					}
				}
			: {}),
		inbox: getInboxId(origin),
		outbox: getOutboxId(origin),
		followers: getFollowersId(origin),
		following: getFollowingId(origin),
		movedTo: getMovedToActorUrl(),
		...(publicKeyPem
			? {
					publicKey: {
						id: getActivityPubKeyId(origin),
						owner: actorId,
						publicKeyPem
					}
				}
			: {})
	};
}
