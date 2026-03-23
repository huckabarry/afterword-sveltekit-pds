import { json } from '@sveltejs/kit';
import { getInstanceOrigin, getInstanceTitle } from '$lib/server/mastodon-api';

export async function GET(event) {
	const origin = getInstanceOrigin(event.url);
	return json({
		domain: new URL(origin).host,
		title: getInstanceTitle(),
		version: '4.3.0',
		source_url: 'https://github.com/huckabarry/afterword-sveltekit-pds',
		description: 'Minimal Mastodon API compatibility for Afterword.',
		usage: {
			users: {
				active_month: 1
			}
		},
		thumbnail: {
			url: `${origin}/assets/images/status-avatar.jpg`
		},
		configuration: {
			urls: {},
			accounts: {
				max_featured_tags: 10
			},
			statuses: {
				max_characters: 300,
				max_media_attachments: 0,
				characters_reserved_per_url: 23
			},
			media_attachments: {
				supported_mime_types: [],
				image_size_limit: 0,
				image_matrix_limit: 0,
				video_size_limit: 0,
				video_frame_rate_limit: 0,
				video_matrix_limit: 0
			},
			polls: {
				max_options: 0,
				max_characters_per_option: 0,
				min_expiration: 0,
				max_expiration: 0
			},
			translation: {
				enabled: false
			}
		},
		registrations: {
			enabled: false,
			approval_required: false,
			message: null
		},
		contact: {
			email: 'hello@afterword.blog',
			account: null
		},
		rules: []
	});
}
