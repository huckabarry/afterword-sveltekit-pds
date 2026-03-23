import { json } from '@sveltejs/kit';
import { buildLocalAccount } from '$lib/server/mastodon-api';

export async function GET(event) {
	const account = await buildLocalAccount(event);

	return json({
		uri: event.url.host,
		title: 'Afterword',
		short_description: account.note,
		description: account.note,
		email: null,
		version: '4.2.0-afterword',
		urls: {
			streaming_api: null
		},
		stats: {
			user_count: 1,
			status_count: account.statuses_count,
			domain_count: 1
		},
		thumbnail: account.avatar,
		languages: ['en'],
		registrations: false,
		approval_required: true,
		invites_enabled: false,
		configuration: {
			statuses: {
				max_characters: 10000,
				max_media_attachments: 4,
				characters_reserved_per_url: 23
			},
			media_attachments: {
				supported_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
				image_size_limit: 10485760,
				image_matrix_limit: 33177600,
				video_size_limit: 0,
				video_frame_rate_limit: 0,
				video_matrix_limit: 0
			},
			polls: {
				max_options: 4,
				max_characters_per_option: 50,
				min_expiration: 300,
				max_expiration: 2629746
			}
		}
	});
}
