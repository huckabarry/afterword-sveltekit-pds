import { json } from '@sveltejs/kit';
import {
	getSiteProfile,
	parseAboutInterestsInput,
	updateSiteProfile,
	type VerificationLink
} from '$lib/server/profile';
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
	const currentProfile = await getSiteProfile(event);
	const displayName = String(body?.displayName || '').trim();
	const avatarUrl = String(body?.avatarUrl || '').trim();
	const headerImageUrl = String(body?.headerImageUrl || '').trim();
	const bio = String(body?.bio || '').trim();
	const aboutBody = String(body?.aboutBody || '').trim();
	const verificationLinks = normalizeVerificationLinks(body?.verificationLinks);

	if (!displayName || !avatarUrl || !bio) {
		return json({ error: 'Display name, avatar URL, and bio are required.' }, { status: 400 });
	}

	const profile = await updateSiteProfile(event, {
		displayName,
		avatarUrl,
		headerImageUrl: headerImageUrl || null,
		bio,
		aboutBody,
		aboutInterests: parseAboutInterestsInput(String(body?.aboutInterests || '')),
		verificationLinks,
		migrationAliases: Array.isArray(body?.migrationAliases)
			? body.migrationAliases.map((item: unknown) => String(item || '').trim()).filter(Boolean)
			: [],
		moveTargetHandle: currentProfile.moveTargetHandle,
		moveTargetActorUrl: currentProfile.moveTargetActorUrl,
		moveStartedAt: currentProfile.moveStartedAt
	});

	return json({ ok: true, profile });
}
