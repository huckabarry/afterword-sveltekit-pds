import type { RequestEvent } from '@sveltejs/kit';

function getDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function normalizeUrl(value: string) {
	const url = new URL(value);
	url.hash = '';

	if (url.pathname !== '/' && url.pathname.endsWith('/')) {
		url.pathname = url.pathname.replace(/\/+$/, '');
	}

	return url.toString();
}

function getSourceDomain(value: string) {
	try {
		return new URL(value).hostname;
	} catch {
		return null;
	}
}

function extractTitle(html: string) {
	const match = String(html || '').match(/<title[^>]*>([^<]+)<\/title>/i);
	return match?.[1]?.trim() || null;
}

export function validateWebmentionTarget(target: string, origin: string) {
	const normalizedTarget = normalizeUrl(target);
	const targetUrl = new URL(normalizedTarget);
	const originUrl = new URL(origin);

	if (!/^https?:$/.test(targetUrl.protocol)) {
		throw new Error('Target must be http or https');
	}

	if (targetUrl.origin !== originUrl.origin) {
		throw new Error('Target must belong to this site');
	}

	return normalizedTarget;
}

export async function verifySourceMentionsTarget(source: string, target: string) {
	const sourceUrl = normalizeUrl(source);
	const response = await fetch(sourceUrl, {
		headers: {
			Accept: 'text/html,application/xhtml+xml'
		},
		redirect: 'follow'
	});

	if (!response.ok) {
		throw new Error(`Source fetch failed with ${response.status}`);
	}

	const html = await response.text();
	const normalizedTarget = normalizeUrl(target);
	const alternateTarget = normalizedTarget.endsWith('/')
		? normalizedTarget.slice(0, -1)
		: `${normalizedTarget}/`;
	const found =
		html.includes(normalizedTarget) ||
		html.includes(alternateTarget) ||
		html.includes(normalizedTarget.replace(/^https:/, 'http:')) ||
		html.includes(normalizedTarget.replace(/^http:/, 'https:'));

	if (!found) {
		throw new Error('Source does not mention target');
	}

	return {
		sourceUrl,
		statusCode: response.status,
		title: extractTitle(html)
	};
}

export async function upsertWebmention(
	event: Pick<RequestEvent, 'platform'>,
	input: {
		sourceUrl: string;
		targetUrl: string;
		status: string;
		httpStatus?: number | null;
		sourceTitle?: string | null;
		errorMessage?: string | null;
		verifiedAt?: string | null;
	}
) {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`INSERT INTO webmentions (
				source_url, target_url, source_domain, status, http_status,
				source_title, error_message, verified_at, last_checked_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(source_url, target_url) DO UPDATE SET
				source_domain = excluded.source_domain,
				status = excluded.status,
				http_status = excluded.http_status,
				source_title = excluded.source_title,
				error_message = excluded.error_message,
				verified_at = excluded.verified_at,
				last_checked_at = CURRENT_TIMESTAMP,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			input.sourceUrl,
			input.targetUrl,
			getSourceDomain(input.sourceUrl),
			input.status,
			input.httpStatus ?? null,
			input.sourceTitle ?? null,
			input.errorMessage ?? null,
			input.verifiedAt ?? null
		)
		.run();
}
