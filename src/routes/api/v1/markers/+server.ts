import { json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';

function emptyMarkers() {
	return {
		home: {
			last_read_id: null as string | null,
			version: 1,
			updated_at: null as string | null
		},
		notifications: {
			last_read_id: null as string | null,
			version: 1,
			updated_at: null as string | null
		}
	};
}

export async function GET(event) {
	await requireMastodonAccessToken(event);
	return json(emptyMarkers());
}

export async function POST(event) {
	await requireMastodonAccessToken(event);

	const body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
	const now = new Date().toISOString();
	const markers = emptyMarkers();
	const input = body.home && typeof body.home === 'object' ? (body.home as Record<string, unknown>) : null;
	const notifications =
		body.notifications && typeof body.notifications === 'object'
			? (body.notifications as Record<string, unknown>)
			: null;

	if (input?.last_read_id || input?.lastReadId) {
		markers.home = {
			last_read_id: String(input.last_read_id || input.lastReadId),
			version: 1,
			updated_at: now
		};
	}

	if (notifications?.last_read_id || notifications?.lastReadId) {
		markers.notifications = {
			last_read_id: String(notifications.last_read_id || notifications.lastReadId),
			version: 1,
			updated_at: now
		};
	}

	return json(markers);
}
