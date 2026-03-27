const PUBLIC_AUDIENCE = 'https://www.w3.org/ns/activitystreams#Public';

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function collectAudienceIds(value: unknown, audience: Set<string>) {
	if (!value) return;

	if (Array.isArray(value)) {
		for (const item of value) {
			collectAudienceIds(item, audience);
		}
		return;
	}

	if (typeof value === 'string') {
		const normalized = getString(value);
		if (normalized) audience.add(normalized);
		return;
	}

	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const nested =
			getString(record.id) ||
			getString(record.href) ||
			getString(record.url);

		if (nested) {
			audience.add(nested);
		}
	}
}

function getCreateObject(activity: Record<string, unknown> | null | undefined) {
	const value = activity?.object;
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function getAudienceIds(
	activity: Record<string, unknown> | null | undefined,
	object?: Record<string, unknown> | null | undefined
) {
	const audience = new Set<string>();
	const sources = [activity, object];

	for (const source of sources) {
		if (!source) continue;
		collectAudienceIds(source.to, audience);
		collectAudienceIds(source.cc, audience);
		collectAudienceIds(source.bto, audience);
		collectAudienceIds(source.bcc, audience);
		collectAudienceIds(source.audience, audience);
	}

	return audience;
}

export function classifyAudienceForLocalOrigin(
	origin: string,
	activity: Record<string, unknown> | null | undefined,
	object?: Record<string, unknown> | null | undefined
) {
	const noteObject = object || getCreateObject(activity);
	const audience = getAudienceIds(activity, noteObject);
	const localActorId = `${origin.replace(/\/$/, '')}/ap/actor`;
	const followersCollectionId = `${origin.replace(/\/$/, '')}/ap/followers`;
	const hasPublic = audience.has(PUBLIC_AUDIENCE);
	const hasFollowers = audience.has(followersCollectionId);
	const addressedToLocalActor = audience.has(localActorId);

	let visibility: 'public' | 'followers' | 'direct' | 'private' = 'private';

	if (hasPublic) {
		visibility = 'public';
	} else if (hasFollowers) {
		visibility = 'followers';
	} else if (addressedToLocalActor) {
		visibility = 'direct';
	}

	return {
		audience,
		addressedToLocalActor,
		hasPublic,
		hasFollowers,
		visibility
	};
}

export function parseRawActivityVisibility(rawActivityJson: string | null | undefined, origin: string) {
	if (!rawActivityJson) {
		return 'public' as const;
	}

	try {
		const activity = JSON.parse(rawActivityJson) as Record<string, unknown>;
		const noteObject = getCreateObject(activity);
		return classifyAudienceForLocalOrigin(origin, activity, noteObject).visibility;
	} catch {
		return 'public' as const;
	}
}
