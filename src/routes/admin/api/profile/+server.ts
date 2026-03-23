import { json } from '@sveltejs/kit';
import { getSiteProfile, updateSiteProfile, type VerificationLink } from '$lib/server/profile';
import { requireAdminAccess } from '$lib/server/admin';

function normalizeVerificationLinks(value: unknown): VerificationLink[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item) => {
			if (!item || typeof item !== 'object') return null;
			const label = String((item as { label?: unknown }).label || '').trim();
			const url = String((item as { url?: unknown }).url || '').trim();
			if (!label || !url) return null;
			return { label, url };
		})
		.filter((item): item is VerificationLink => Boolean(item));
}

export async function GET(event) {
	await requireAdminAccess(event);
	const profile = await getSiteProfile(event);
	return json({ profile });
}

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const displayName = String(body?.displayName || '').trim();
	const avatarUrl = String(body?.avatarUrl || '').trim();
	const headerImageUrl = String(body?.headerImageUrl || '').trim();
	const bio = String(body?.bio || '').trim();
	const verificationLinks = normalizeVerificationLinks(body?.verificationLinks);

	if (!displayName || !avatarUrl || !bio) {
		return json({ error: 'Display name, avatar URL, and bio are required.' }, { status: 400 });
	}

	const profile = await updateSiteProfile(event, {
		displayName,
		avatarUrl,
		headerImageUrl: headerImageUrl || null,
		bio,
		verificationLinks
	});

	return json({ ok: true, profile });
}
