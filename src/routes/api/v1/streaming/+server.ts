import { error } from '@sveltejs/kit';
import { getAccessToken, requireMastodonAccessToken } from '$lib/server/mastodon-auth';

function parseRequestedStreams(url: URL) {
	const values = url.searchParams.getAll('stream').flatMap((value) =>
		String(value || '')
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean)
	);

	return values.length ? values : ['user'];
}

async function requireStreamingToken(event: Parameters<typeof requireMastodonAccessToken>[0]) {
	const queryToken = event.request.url ? new URL(event.request.url).searchParams.get('access_token') : null;
	if (queryToken) {
		const accessToken = await getAccessToken(event, queryToken);
		if (!accessToken) {
			throw error(401, 'Invalid access token');
		}
		return accessToken;
	}

	return requireMastodonAccessToken(event);
}

export async function GET(event) {
	await requireStreamingToken(event);

	const upgrade = event.request.headers.get('upgrade') || '';
	if (upgrade.toLowerCase() !== 'websocket') {
		return new Response('WebSocket upgrade required', {
			status: 426,
			headers: {
				upgrade: 'websocket',
				'cache-control': 'no-store'
			}
		});
	}

	const PairCtor = (globalThis as typeof globalThis & { WebSocketPair?: new () => {
		0: WebSocket;
		1: WebSocket;
	} }).WebSocketPair;

	if (!PairCtor) {
		return new Response('WebSocket streaming is not available in this runtime', {
			status: 501,
			headers: {
				'cache-control': 'no-store'
			}
		});
	}

	const pair = new PairCtor();
	const client = pair[0] as WebSocket;
	const server = pair[1] as WebSocket & {
		accept: () => void;
	};
	const streams = parseRequestedStreams(event.url);

	server.accept();

	server.send(
		JSON.stringify({
			stream: streams,
			event: 'filters_changed',
			payload: '{}'
		})
	);

	const heartbeat = setInterval(() => {
		try {
			server.send(
				JSON.stringify({
					stream: streams,
					event: 'heartbeat',
					payload: ''
				})
			);
		} catch {
			clearInterval(heartbeat);
		}
	}, 25000);

	server.addEventListener('close', () => {
		clearInterval(heartbeat);
	});

	server.addEventListener('error', () => {
		clearInterval(heartbeat);
	});

	return new Response(null, {
		status: 101,
		webSocket: client
	} as ResponseInit & { webSocket: WebSocket });
}
