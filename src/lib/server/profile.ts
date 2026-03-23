import type { RequestEvent } from '@sveltejs/kit';

type ProfileRow = Record<string, unknown>;

export type VerificationLink = {
	label: string;
	url: string;
};

export type SiteProfile = {
	displayName: string;
	avatarUrl: string;
	headerImageUrl: string | null;
	bio: string;
	verificationLinks: VerificationLink[];
};

const DEFAULT_PROFILE: SiteProfile = {
	displayName: 'Bryan Robb',
	avatarUrl: '/assets/images/status-avatar.jpg',
	headerImageUrl: null,
	bio: 'Writer, photographer, and urban planner publishing from Afterword.',
	verificationLinks: [{ label: 'Bluesky', url: 'https://bsky.app/profile/afterword.blog' }]
};

function getDb(event: Pick<RequestEvent, 'platform'>) {
	try {
		return (
			event.platform?.env?.D1_DATABASE ??
			event.platform?.env?.D1_DATABASE_BINDING ??
			event.platform?.env?.AP_DB ??
			null
		);
	} catch {
		return null;
	}
}

function normalizeUrl(value: string, fallback: string | null = null) {
	const trimmed = String(value || '').trim();
	return trimmed || fallback;
}

function parseVerificationLinks(value: unknown): VerificationLink[] {
	if (typeof value !== 'string' || !value.trim()) {
		return DEFAULT_PROFILE.verificationLinks;
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return DEFAULT_PROFILE.verificationLinks;

		const links = parsed
			.map((item) => {
				if (!item || typeof item !== 'object') return null;
				const label = String((item as { label?: unknown }).label || '').trim();
				const url = String((item as { url?: unknown }).url || '').trim();
				if (!label || !url) return null;
				return { label, url };
			})
			.filter((item): item is VerificationLink => Boolean(item));

		return links.length ? links : [];
	} catch {
		return DEFAULT_PROFILE.verificationLinks;
	}
}

function serializeVerificationLinks(links: VerificationLink[]) {
	return JSON.stringify(
		links
			.map((link) => ({
				label: String(link.label || '').trim(),
				url: String(link.url || '').trim()
			}))
			.filter((link) => link.label && link.url)
	);
}

function mapProfile(row: ProfileRow | null | undefined): SiteProfile {
	if (!row) return DEFAULT_PROFILE;

	return {
		displayName: String(row.display_name || DEFAULT_PROFILE.displayName),
		avatarUrl: normalizeUrl(String(row.avatar_url || ''), DEFAULT_PROFILE.avatarUrl) || DEFAULT_PROFILE.avatarUrl,
		headerImageUrl: normalizeUrl(String(row.header_image_url || ''), null),
		bio: String(row.bio || DEFAULT_PROFILE.bio),
		verificationLinks: parseVerificationLinks(row.verification_links_json)
	};
}

export async function getSiteProfile(event: Pick<RequestEvent, 'platform'>): Promise<SiteProfile> {
	const db = getDb(event);
	if (!db) return DEFAULT_PROFILE;

	const row = await db
		.prepare(
			`SELECT display_name, avatar_url, header_image_url, bio, verification_links_json
			 FROM site_profile
			 WHERE id = 1
			 LIMIT 1`
		)
		.first<ProfileRow>();

	return mapProfile(row);
}

export async function updateSiteProfile(
	event: Pick<RequestEvent, 'platform'>,
	input: SiteProfile
): Promise<SiteProfile> {
	const db = getDb(event);
	if (!db) {
		throw new Error('D1 database is not configured');
	}

	await db
		.prepare(
			`INSERT INTO site_profile (
				id, display_name, avatar_url, header_image_url, bio, verification_links_json
			) VALUES (1, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				display_name = excluded.display_name,
				avatar_url = excluded.avatar_url,
				header_image_url = excluded.header_image_url,
				bio = excluded.bio,
				verification_links_json = excluded.verification_links_json,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			String(input.displayName || DEFAULT_PROFILE.displayName).trim(),
			normalizeUrl(input.avatarUrl, DEFAULT_PROFILE.avatarUrl),
			normalizeUrl(input.headerImageUrl || '', null),
			String(input.bio || DEFAULT_PROFILE.bio).trim(),
			serializeVerificationLinks(input.verificationLinks)
		)
		.run();

	return getSiteProfile(event);
}

export function parseVerificationLinksInput(value: string): VerificationLink[] {
	return String(value || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [labelPart, ...urlParts] = line.split('|');
			const label = String(labelPart || '').trim();
			const url = String(urlParts.join('|') || '').trim();
			if (!label || !url) return null;
			return { label, url };
		})
		.filter((item): item is VerificationLink => Boolean(item));
}

export function formatVerificationLinksInput(links: VerificationLink[]) {
	return links.map((link) => `${link.label} | ${link.url}`).join('\n');
}
