import { json } from '@sveltejs/kit';
import { getInstanceTitle, getInstanceOrigin } from '$lib/server/mastodon-api';

export async function GET(event) {
	const origin = getInstanceOrigin(event.url);
	return json({
		uri: new URL(origin).host,
		title: getInstanceTitle(),
		short_description: 'Afterword Mastodon compatibility layer',
		description: 'Minimal Mastodon API compatibility for posting to Afterword.',
		email: 'hello@afterword.blog',
		version: '4.3.0',
		urls: {
			streaming_api: null
		},
		stats: {
			user_count: 1,
			status_count: 0,
			domain_count: 1
		},
		thumbnail: `${origin}/assets/images/status-avatar.jpg`,
		languages: ['en'],
		registrations: false,
		approval_required: false,
		invites_enabled: false,
		configuration: {
			statuses: {
				max_characters: 300
			}
		}
	});
}
