import type { RequestEvent } from '@sveltejs/kit';

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

export async function recordInteraction(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		activityId: string;
		activityType: string;
		actorId: string;
		objectId: string;
		objectUrl?: string | null;
		rawActivityJson: string;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`INSERT INTO ap_interactions (
				activity_id, activity_type, actor_id, object_id, object_url, raw_activity_json
			) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(activity_id) DO UPDATE SET
				activity_type = excluded.activity_type,
				actor_id = excluded.actor_id,
				object_id = excluded.object_id,
				object_url = excluded.object_url,
				raw_activity_json = excluded.raw_activity_json,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			input.activityId,
			input.activityType,
			input.actorId,
			input.objectId,
			input.objectUrl ?? null,
			input.rawActivityJson
		)
		.run();
}

export type InteractionSummary = {
	likeCount: number;
	announceCount: number;
	totalCount: number;
};

export async function getInteractionSummary(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
): Promise<InteractionSummary> {
	const db = getDb(event);
	if (!db) {
		return {
			likeCount: 0,
			announceCount: 0,
			totalCount: 0
		};
	}

	const result = await db
		.prepare(
			`SELECT
				SUM(CASE WHEN activity_type = 'Like' THEN 1 ELSE 0 END) AS like_count,
				SUM(CASE WHEN activity_type = 'Announce' THEN 1 ELSE 0 END) AS announce_count,
				COUNT(*) AS total_count
			 FROM ap_interactions
			 WHERE object_id = ?`
		)
		.bind(objectId)
		.first<Record<string, unknown>>();

	return {
		likeCount: Number(result?.like_count || 0),
		announceCount: Number(result?.announce_count || 0),
		totalCount: Number(result?.total_count || 0)
	};
}
