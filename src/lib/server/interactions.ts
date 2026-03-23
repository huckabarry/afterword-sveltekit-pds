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
