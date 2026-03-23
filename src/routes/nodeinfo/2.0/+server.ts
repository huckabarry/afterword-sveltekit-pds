import { json } from '@sveltejs/kit';
import { buildLocalAccount } from '$lib/server/mastodon-api';

export async function GET(event) {
	const account = await buildLocalAccount(event);

	return json({
		version: '2.0',
		software: {
			name: 'mastodon',
			version: '4.2.0'
		},
		protocols: ['activitypub'],
		services: {
			inbound: [],
			outbound: []
		},
		openRegistrations: false,
		usage: {
			users: {
				total: 1,
				activeHalfyear: 1,
				activeMonth: 1
			},
			localPosts: account.statuses_count
		},
		metadata: {
			nodeName: 'Afterword',
			nodeDescription: account.note,
			privateAccount: false,
			approvalRequired: true,
			invitesEnabled: false
		}
	});
}
