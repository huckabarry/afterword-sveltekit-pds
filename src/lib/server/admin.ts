import { env } from '$env/dynamic/private';
import { error, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';

const ADMIN_COOKIE = 'afterword_admin_session';

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return bytesToHex(new Uint8Array(digest));
}

export function getAdminPassword() {
	return String(env.ADMIN_PASSWORD || env.ADMIN_API_TOKEN || '').trim();
}

function getCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: true,
		maxAge: 60 * 60 * 24 * 14
	};
}

export async function createAdminSession(cookies: Cookies) {
	const password = getAdminPassword();
	if (!password) {
		throw error(500, 'ADMIN_PASSWORD is not configured');
	}

	const sessionValue = await sha256Hex(`afterword-admin:${password}`);
	cookies.set(ADMIN_COOKIE, sessionValue, getCookieOptions());
}

export function clearAdminSession(cookies: Cookies) {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export async function hasAdminSession(cookies: Cookies) {
	const password = getAdminPassword();
	const current = cookies.get(ADMIN_COOKIE);

	if (!password || !current) {
		return false;
	}

	const expected = await sha256Hex(`afterword-admin:${password}`);
	return current === expected;
}

function getSubmittedAdminSecret(event: Pick<RequestEvent, 'request'>) {
	const authorization = event.request.headers.get('authorization')?.trim() || '';
	const bearer = authorization.toLowerCase().startsWith('bearer ')
		? authorization.slice(7).trim()
		: '';

	return (
		event.request.headers.get('x-admin-token')?.trim() ||
		event.request.headers.get('x-admin-password')?.trim() ||
		bearer ||
		''
	);
}

export function hasValidAdminSecret(request: Request) {
	const password = getAdminPassword();

	if (!password) {
		return false;
	}

	const submitted = getSubmittedAdminSecret({ request } as Pick<RequestEvent, 'request'>);
	return Boolean(submitted && submitted === password);
}

export async function hasAdminAccess(event: Pick<RequestEvent, 'cookies' | 'request'>) {
	if (await hasAdminSession(event.cookies)) {
		return true;
	}

	return hasValidAdminSecret(event.request);
}

export async function requireAdminSession(event: Pick<RequestEvent, 'cookies'>) {
	if (!(await hasAdminSession(event.cookies))) {
		throw redirect(303, '/admin/login');
	}
}

export async function requireAdminAccess(event: Pick<RequestEvent, 'cookies' | 'request'>) {
	if (!(await hasAdminAccess(event))) {
		throw error(401, 'Unauthorized');
	}
}
