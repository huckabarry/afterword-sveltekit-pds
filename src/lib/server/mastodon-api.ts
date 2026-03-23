import { env } from '$env/dynamic/private';

export function getInstanceOrigin(url: URL) {
	return url.origin;
}

export function getMastodonAccount(origin: string) {
	return {
		id: '1',
		username: 'bryan',
		acct: 'bryan',
		display_name: 'Bryan Robb',
		locked: false,
		bot: false,
		discoverable: true,
		group: false,
		created_at: '2026-03-01T00:00:00.000Z',
		note: 'Writer, photographer, and urban planner publishing from Afterword.',
		url: `${origin}/`,
		avatar: `${origin}/assets/images/status-avatar.jpg`,
		avatar_static: `${origin}/assets/images/status-avatar.jpg`,
		header: `${origin}/assets/images/status-avatar.jpg`,
		header_static: `${origin}/assets/images/status-avatar.jpg`,
		followers_count: 0,
		following_count: 0,
		statuses_count: 0,
		last_status_at: null,
		emojis: [],
		fields: []
	};
}

export function getInstanceTitle() {
	return String(env.MASTODON_INSTANCE_TITLE || 'Afterword').trim();
}

function escapeHtml(value: string) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function renderStatusHtml(text: string) {
	return String(text || '')
		.trim()
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

export function formatMastodonStatus(origin: string, input: {
	uri: string;
	id: string;
	text: string;
	createdAt: string;
}) {
	return {
		id: input.id,
		created_at: input.createdAt,
		in_reply_to_id: null,
		in_reply_to_account_id: null,
		sensitive: false,
		spoiler_text: '',
		visibility: 'public',
		language: 'en',
		uri: input.uri,
		url: `${origin}/status/${input.id}`,
		replies_count: 0,
		reblogs_count: 0,
		favourites_count: 0,
		favourited: false,
		reblogged: false,
		muted: false,
		bookmarked: false,
		pinned: false,
		content: renderStatusHtml(input.text),
		reblog: null,
		application: {
			name: 'Afterword',
			website: `${origin}/`
		},
		account: getMastodonAccount(origin),
		media_attachments: [],
		mentions: [],
		tags: [],
		emojis: [],
		card: null,
		poll: null
	};
}
