import type { RequestEvent } from '@sveltejs/kit';

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

export async function recordDeliveryAttempt(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		objectId: string;
		objectUrl: string;
		followerActorId: string;
		inboxUrl: string;
		activityId: string;
		status: string;
		responseStatus?: number | null;
		errorMessage?: string | null;
		deliveredAt?: string | null;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`INSERT INTO ap_deliveries (
				object_id, object_url, follower_actor_id, inbox_url, activity_id,
				status, response_status, error_message, delivered_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(object_id, follower_actor_id) DO UPDATE SET
				inbox_url = excluded.inbox_url,
				activity_id = excluded.activity_id,
				status = excluded.status,
				response_status = excluded.response_status,
				error_message = excluded.error_message,
				last_attempted_at = CURRENT_TIMESTAMP,
				delivered_at = excluded.delivered_at,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			input.objectId,
			input.objectUrl,
			input.followerActorId,
			input.inboxUrl,
			input.activityId,
			input.status,
			input.responseStatus ?? null,
			input.errorMessage ?? null,
			input.deliveredAt ?? null
		)
		.run();
}

export async function listDeliveredFollowerActorIds(
	event: Pick<RequestEvent, 'platform'>,
	objectId: string
): Promise<Set<string>> {
	const db = getDb(event);
	if (!db) {
		return new Set();
	}

	const result = await db
		.prepare(
			`SELECT follower_actor_id
			 FROM ap_deliveries
			 WHERE object_id = ?
			   AND status = 'delivered'`
		)
		.bind(objectId)
		.all<Record<string, unknown>>();

	return new Set(
		(result.results || [])
			.map((row: Record<string, unknown>) => String(row.follower_actor_id || '').trim())
			.filter(Boolean)
	);
}
