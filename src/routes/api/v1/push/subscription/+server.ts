import { error, json } from '@sveltejs/kit';
import { getPushSubscription, normalizePushPayload, upsertPushSubscription, deletePushSubscription } from '$lib/server/mastodon-push';
import { requireMastodonAccessToken } from '$lib/server/mastodon-auth';

function getNestedValue(record: Record<string, FormDataEntryValue>, keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return '';
}

function getBooleanValue(record: Record<string, FormDataEntryValue>, keys: string[]) {
	return keys.some((key) => {
		const value = record[key];
		return typeof value === 'string' && ['true', '1', 'on', 'yes'].includes(value.trim().toLowerCase());
	});
}

async function parsePayload(request: Request) {
	const contentType = request.headers.get('content-type') || '';

	if (contentType.includes('application/json')) {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const subscription = (body.subscription as Record<string, unknown> | undefined) || {};
		const keys = (subscription.keys as Record<string, unknown> | undefined) || {};
		const data = (body.data as Record<string, unknown> | undefined) || {};
		return normalizePushPayload({
			endpoint: typeof subscription.endpoint === 'string' ? subscription.endpoint : null,
			auth: typeof keys.auth === 'string' ? keys.auth : null,
			p256dh: typeof keys.p256dh === 'string' ? keys.p256dh : null,
			policy: typeof data.policy === 'string' ? data.policy : null,
			alerts: (data.alerts as Record<string, unknown> | undefined) || {},
			serverKey: typeof body.server_key === 'string' ? body.server_key : null
		});
	}

	const formData = await request.formData().catch(() => null);
	if (!formData) {
		return normalizePushPayload({});
	}

	const entries = Object.fromEntries(formData.entries());
	return normalizePushPayload({
		endpoint: getNestedValue(entries, ['subscription[endpoint]', 'endpoint']),
		auth: getNestedValue(entries, ['subscription[keys][auth]', 'keys[auth]', 'auth']),
		p256dh: getNestedValue(entries, ['subscription[keys][p256dh]', 'keys[p256dh]', 'p256dh']),
		policy: getNestedValue(entries, ['data[policy]', 'policy']),
		alerts: {
			follow: getBooleanValue(entries, ['data[alerts][follow]', 'alerts[follow]']),
			follow_request: getBooleanValue(entries, ['data[alerts][follow_request]', 'alerts[follow_request]']),
			favourite: getBooleanValue(entries, ['data[alerts][favourite]', 'alerts[favourite]']),
			mention: getBooleanValue(entries, ['data[alerts][mention]', 'alerts[mention]']),
			reblog: getBooleanValue(entries, ['data[alerts][reblog]', 'alerts[reblog]']),
			poll: getBooleanValue(entries, ['data[alerts][poll]', 'alerts[poll]']),
			status: getBooleanValue(entries, ['data[alerts][status]', 'alerts[status]']),
			update: getBooleanValue(entries, ['data[alerts][update]', 'alerts[update]']),
			'admin.sign_up': getBooleanValue(entries, ['data[alerts][admin.sign_up]', 'alerts[admin.sign_up]']),
			'admin.report': getBooleanValue(entries, ['data[alerts][admin.report]', 'alerts[admin.report]']),
			'pending.favourite': getBooleanValue(entries, [
				'data[alerts][pending.favourite]',
				'alerts[pending.favourite]'
			]),
			'pending.reply': getBooleanValue(entries, ['data[alerts][pending.reply]', 'alerts[pending.reply]']),
			'pending.reblog': getBooleanValue(entries, [
				'data[alerts][pending.reblog]',
				'alerts[pending.reblog]'
			])
		},
		serverKey: getNestedValue(entries, ['server_key'])
	});
}

export async function GET(event) {
	const accessToken = await requireMastodonAccessToken(event);
	const subscription = await getPushSubscription(event, accessToken.token);
	if (!subscription) {
		throw error(404, 'Push subscription not found');
	}

	return json(subscription, {
		headers: {
			'cache-control': 'no-store'
		}
	});
}

export async function POST(event) {
	const accessToken = await requireMastodonAccessToken(event);
	const payload = await parsePayload(event.request);
	if (!payload.endpoint || !payload.auth || !payload.p256dh) {
		throw error(400, 'subscription details are required');
	}

	const subscription = await upsertPushSubscription(event, accessToken.token, payload);
	return json(subscription, {
		headers: {
			'cache-control': 'no-store'
		}
	});
}

export async function PUT(event) {
	return POST(event);
}

export async function DELETE(event) {
	const accessToken = await requireMastodonAccessToken(event);
	await deletePushSubscription(event, accessToken.token);
	return json({});
}
