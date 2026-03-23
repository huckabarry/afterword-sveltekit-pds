import { error } from '@sveltejs/kit';
import { upsertWebmention, validateWebmentionTarget, verifySourceMentionsTarget } from '$lib/server/webmentions';

function response(body: unknown, status = 200) {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8'
		}
	});
}

export async function GET() {
	return response({
		endpoint: '/webmention',
		method: 'POST',
		formats: ['application/x-www-form-urlencoded', 'multipart/form-data'],
		required: ['source', 'target']
	});
}

export async function POST(event) {
	const contentType = event.request.headers.get('content-type') || '';

	if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
		throw error(415, 'Webmention requests must use form encoding');
	}

	const form = await event.request.formData();
	const source = String(form.get('source') || '').trim();
	const target = String(form.get('target') || '').trim();

	if (!source || !target) {
		throw error(400, 'Both source and target are required');
	}

	try {
		const normalizedTarget = validateWebmentionTarget(target, event.url.origin);
		const verification = await verifySourceMentionsTarget(source, normalizedTarget);

		await upsertWebmention(event, {
			sourceUrl: verification.sourceUrl,
			targetUrl: normalizedTarget,
			status: 'verified',
			httpStatus: verification.statusCode,
			sourceTitle: verification.title,
			verifiedAt: new Date().toISOString()
		});

		return response(
			{
				ok: true,
				source: verification.sourceUrl,
				target: normalizedTarget,
				status: 'verified'
			},
			202
		);
	} catch (webmentionError) {
		const message = webmentionError instanceof Error ? webmentionError.message : String(webmentionError);

		try {
			const normalizedTarget = validateWebmentionTarget(target, event.url.origin);
			const normalizedSource = new URL(source).toString();
			await upsertWebmention(event, {
				sourceUrl: normalizedSource,
				targetUrl: normalizedTarget,
				status: 'failed',
				errorMessage: message
			});
		} catch {
			// Ignore secondary storage failures when initial validation failed.
		}

		throw error(400, message);
	}
}
