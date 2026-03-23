import { json } from '@sveltejs/kit';
import { buildLocalAccount } from '$lib/server/mastodon-api';

export async function GET(event) {
	const account = await buildLocalAccount(event);

	return json({
		domain: event.url.host,
		title: 'Afterword',
		version: '4.2.0-afterword',
		source_url: `${event.url.origin}/`,
		description: account.note,
		usage: {
			users: {
				active_month: 1
			}
		},
		thumbnail: {
			url: account.avatar
		},
		languages: ['en'],
		configuration: {
			urls: {
				streaming: null
			},
			accounts: {
				max_featured_tags: 10
			},
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
			}
		},
		registrations: {
			enabled: false,
			approval_required: true
		},
		contact: {
			account
		}
	});
}
