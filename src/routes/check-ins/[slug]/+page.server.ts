import { error } from '@sveltejs/kit';
import { getCheckinBySlug, getCheckins } from '$lib/server/atproto';
import { getCheckinsSnapshot } from '$lib/server/checkins-snapshot';

export async function load({ params, url, platform }) {
	const snapshotCheckins = await getCheckinsSnapshot({ platform });
	const latestSnapshotSlug = snapshotCheckins[0]?.slug || null;
	const shouldPreferLive = params.slug === latestSnapshotSlug;

	const liveCheckins = shouldPreferLive ? await getCheckins().catch(() => []) : [];
	const checkins = liveCheckins.length ? liveCheckins : snapshotCheckins;
	const item =
		checkins.find((entry) => entry.slug === params.slug) ||
		(shouldPreferLive ? await getCheckinBySlug(params.slug) : null);

	if (!item) {
		throw error(404, 'Check-in not found');
	}

	const currentIndex = checkins.findIndex((entry) => entry.slug === params.slug);
	const absoluteUrl = new URL(item.canonicalPath, url.origin).toString();
	const ogImageUrl = new URL(`/check-ins/${item.slug}/og.svg`, url.origin).toString();
	const descriptionParts = [item.note || item.excerpt, item.place].filter(Boolean);

	return {
		item,
		absoluteUrl,
		ogImageUrl,
		description: descriptionParts.join(' · ') || `Check-in at ${item.name}`,
		previousItem: currentIndex >= 0 ? checkins[currentIndex + 1] || null : null,
		nextItem: currentIndex >= 0 ? checkins[currentIndex - 1] || null : null
	};
}
