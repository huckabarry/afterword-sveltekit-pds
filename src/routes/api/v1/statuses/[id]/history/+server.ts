import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { decodeMastodonStatusId, resolveStatusByObjectId } from '$lib/server/mastodon-api';

export async function GET(event) {
	await requireMastodonAccessToken(event);

	const objectId = decodeMastodonStatusId(event.params.id);
	if (!objectId) throw error(404, 'Unknown status');

	const status = await resolveStatusByObjectId(event, objectId);
	if (!status) throw error(404, 'Unknown status');

	return json([
		{
			content: String((status as { content?: unknown }).content || ''),
			spoiler_text: String((status as { spoiler_text?: unknown }).spoiler_text || ''),
			sensitive: Boolean((status as { sensitive?: unknown }).sensitive),
			created_at: String((status as { created_at?: unknown }).created_at || new Date().toISOString()),
			account: (status as { account?: unknown }).account
		}
	]);
}
