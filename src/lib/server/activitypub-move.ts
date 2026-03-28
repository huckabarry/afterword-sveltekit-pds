import type { RequestEvent } from '@sveltejs/kit';
import { getActivityPubOrigin, getActorId, getFollowersId } from '$lib/server/activitypub';
import { sendSignedActivity } from '$lib/server/activitypub-delivery';
import { fetchActivityJson } from '$lib/server/activitypub-replies';
import { listDeliveredFollowerActorIds, recordDeliveryAttempt } from '$lib/server/deliveries';
import { listFollowers, updateFollowerDeliveryStatus } from '$lib/server/followers';

export type ResolvedMoveTarget = {
	handle: string | null;
	actorUrl: string;
	profileUrl: string | null;
	displayName: string | null;
};

export type MoveDeliveryResult = {
	actorId: string;
	inboxUrl: string | null;
	status: string;
	error?: string;
};

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeMoveHandle(value: string) {
	const trimmed = String(value || '').trim().replace(/^acct:/i, '').replace(/^@/, '');
	if (!trimmed) return null;

	const parts = trimmed.split('@').map((part) => part.trim()).filter(Boolean);
	if (parts.length !== 2) {
		throw new Error('Enter the new account as username@domain.');
	}

	return `${parts[0]}@${parts[1].toLowerCase()}`;
}

export async function resolveMoveTarget(value: string): Promise<ResolvedMoveTarget> {
	const trimmed = String(value || '').trim();
	if (!trimmed) {
		throw new Error('Enter the new ActivityPub account handle or actor URL.');
	}

	if (/^https?:\/\//i.test(trimmed)) {
		const actorDoc = await fetchActivityJson(trimmed);
		const actorUrl = getString(actorDoc.id) || trimmed;
		const host = new URL(actorUrl).host;
		const preferredUsername = getString(actorDoc.preferredUsername);

		return {
			handle: preferredUsername ? `${preferredUsername}@${host}` : null,
			actorUrl,
			profileUrl: getString(actorDoc.url),
			displayName: getString(actorDoc.name)
		};
	}

	const normalizedHandle = normalizeMoveHandle(trimmed);
	if (!normalizedHandle) {
		throw new Error('Enter the new ActivityPub account handle or actor URL.');
	}

	const [, domain] = normalizedHandle.split('@');
	const response = await fetch(
		`https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${normalizedHandle}`)}`,
		{
			headers: {
				Accept: 'application/jrd+json, application/json'
			}
		}
	);

	if (!response.ok) {
		throw new Error(`Unable to resolve ${normalizedHandle} via WebFinger (${response.status}).`);
	}

	const jrd = (await response.json()) as {
		links?: Array<{ rel?: string; type?: string; href?: string }>;
	};
	const selfLink = (jrd.links || []).find((link) => link.rel === 'self' && link.href);

	if (!selfLink?.href) {
		throw new Error(`No ActivityPub actor URL was returned for ${normalizedHandle}.`);
	}

	const actorDoc = await fetchActivityJson(selfLink.href);
	const actorUrl = getString(actorDoc.id) || selfLink.href;

	return {
		handle: normalizedHandle,
		actorUrl,
		profileUrl: getString(actorDoc.url),
		displayName: getString(actorDoc.name)
	};
}

async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export async function buildMoveActivity(
	origin: string,
	input: {
		targetActorUrl: string;
		moveStartedAt: string;
	}
) {
	const actorId = getActorId(origin);
	const moveKey = await sha256Hex(`${input.targetActorUrl}|${input.moveStartedAt}`);
	const id = `${actorId}#moves/${moveKey.slice(0, 16)}`;

	return {
		id,
		activity: {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id,
			type: 'Move',
			actor: actorId,
			object: actorId,
			target: input.targetActorUrl,
			to: getFollowersId(origin)
		}
	};
}

export async function deliverMoveToFollowers(
	event: Pick<RequestEvent, 'platform' | 'url'>,
	input: {
		targetActorUrl: string;
		moveStartedAt: string;
		skipDelivered?: boolean;
	}
) {
	const origin = getActivityPubOrigin(event);
	const actorId = getActorId(origin);
	const { id, activity } = await buildMoveActivity(origin, input);
	const followers = await listFollowers(event);
	const deliveredFollowerIds = input.skipDelivered
		? await listDeliveredFollowerActorIds(event, id)
		: new Set<string>();
	const results: MoveDeliveryResult[] = [];

	for (const follower of followers) {
		const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl;

		if (input.skipDelivered && deliveredFollowerIds.has(follower.actorId)) {
			results.push({
				actorId: follower.actorId,
				inboxUrl,
				status: 'already-delivered'
			});
			continue;
		}

		if (!inboxUrl) {
			results.push({
				actorId: follower.actorId,
				inboxUrl: null,
				status: 'skipped',
				error: 'No inbox URL available'
			});
			continue;
		}

		try {
			const response = await sendSignedActivity(origin, inboxUrl, activity);
			await recordDeliveryAttempt(event, {
				objectId: id,
				objectUrl: actorId,
				followerActorId: follower.actorId,
				inboxUrl,
				activityId: id,
				status: 'delivered',
				responseStatus: response.status,
				deliveredAt: new Date().toISOString()
			});
			await updateFollowerDeliveryStatus(event, follower.actorId, 'moved').catch(() => {});
			results.push({
				actorId: follower.actorId,
				inboxUrl,
				status: 'delivered'
			});
		} catch (deliveryError) {
			const message = deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
			await recordDeliveryAttempt(event, {
				objectId: id,
				objectUrl: actorId,
				followerActorId: follower.actorId,
				inboxUrl,
				activityId: id,
				status: 'failed',
				errorMessage: message
			});
			await updateFollowerDeliveryStatus(event, follower.actorId, 'move-failed').catch(() => {});
			results.push({
				actorId: follower.actorId,
				inboxUrl,
				status: 'failed',
				error: message
			});
		}
	}

	return {
		targetActorUrl: input.targetActorUrl,
		moveStartedAt: input.moveStartedAt,
		followerCount: followers.length,
		results
	};
}
