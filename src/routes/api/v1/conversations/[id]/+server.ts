import { error, json } from '@sveltejs/kit';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';
import { listMastodonConversations } from '$lib/server/mastodon-api';

export async function DELETE(event) {
	await requireMastodonAccessToken(event);
	const conversations = await listMastodonConversations(event, 200);
	const conversation = conversations.find((item) => item.id === event.params.id);
	if (!conversation) throw error(404, 'Unknown conversation');
	return json({});
}
