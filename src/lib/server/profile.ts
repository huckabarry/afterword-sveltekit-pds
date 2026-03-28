import type { RequestEvent } from '@sveltejs/kit';
import { getAboutContent } from '$lib/server/content';

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
	aboutBody: string;
	aboutInterests: string[];
	verificationLinks: VerificationLink[];
	migrationAliases: string[];
	moveTargetHandle: string | null;
	moveTargetActorUrl: string | null;
	moveStartedAt: string | null;
};

const DEFAULT_ABOUT_CONTENT = getAboutContent();

const DEFAULT_PROFILE: SiteProfile = {
	displayName: 'Bryan Robb',
	avatarUrl: '/assets/images/status-avatar.jpg',
	headerImageUrl: null,
	bio: 'Writer, photographer, and urban planner publishing from Afterword.',
	aboutBody: DEFAULT_ABOUT_CONTENT.paragraphs.join('\n\n'),
	aboutInterests: DEFAULT_ABOUT_CONTENT.interests,
	verificationLinks: [{ label: 'Bluesky', url: 'https://bsky.app/profile/afterword.blog' }],
	migrationAliases: [],
	moveTargetHandle: null,
	moveTargetActorUrl: null,
	moveStartedAt: null
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

function getString(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeAliasUrl(value: string) {
	const trimmed = String(value || '').trim();
	if (!trimmed) return '';

	try {
		const url = new URL(trimmed);
		url.hash = '';
		if (url.pathname !== '/') {
			url.pathname = url.pathname.replace(/\/+$/, '');
		}
		return url.toString();
	} catch {
		return trimmed.replace(/\/+$/, '');
	}
}

export function dedupeMigrationAliases(aliases: string[]) {
	const seen = new Set<string>();
	const results: string[] = [];

	for (const alias of aliases) {
		const normalized = normalizeAliasUrl(alias);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		results.push(normalized);
	}

	return results;
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

function parseMigrationAliases(value: unknown): string[] {
	if (typeof value !== 'string' || !value.trim()) return [];

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];

		return dedupeMigrationAliases(
			parsed
			.map((item) => String(item || '').trim())
			.filter(Boolean)
		);
	} catch {
		return [];
	}
}

function serializeMigrationAliases(aliases: string[]) {
	return JSON.stringify(dedupeMigrationAliases(aliases));
}

function parseAboutInterests(value: unknown): string[] {
	if (typeof value !== 'string' || !value.trim()) {
		return DEFAULT_PROFILE.aboutInterests;
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return DEFAULT_PROFILE.aboutInterests;

		const interests = parsed
			.map((item) => String(item || '').trim())
			.filter(Boolean);

		return interests.length ? interests : [];
	} catch {
		return DEFAULT_PROFILE.aboutInterests;
	}
}

function serializeAboutInterests(interests: string[]) {
	return JSON.stringify(
		interests
			.map((item) => String(item || '').trim())
			.filter(Boolean)
	);
}

function mapProfile(row: ProfileRow | null | undefined): SiteProfile {
	if (!row) return DEFAULT_PROFILE;

	return {
		displayName: String(row.display_name || DEFAULT_PROFILE.displayName),
		avatarUrl: normalizeUrl(String(row.avatar_url || ''), DEFAULT_PROFILE.avatarUrl) || DEFAULT_PROFILE.avatarUrl,
		headerImageUrl: normalizeUrl(String(row.header_image_url || ''), null),
		bio: String(row.bio || DEFAULT_PROFILE.bio),
		aboutBody: String(row.about_body || DEFAULT_PROFILE.aboutBody),
		aboutInterests: parseAboutInterests(row.about_interests_json),
		verificationLinks: parseVerificationLinks(row.verification_links_json),
		migrationAliases: parseMigrationAliases(row.migration_aliases_json),
		moveTargetHandle: getString(row.move_target_handle),
		moveTargetActorUrl: getString(row.move_target_actor_url),
		moveStartedAt: getString(row.move_started_at)
	};
}

export async function getSiteProfile(event: Pick<RequestEvent, 'platform'>): Promise<SiteProfile> {
	const db = getDb(event);
	if (!db) return DEFAULT_PROFILE;

	await db.prepare(`ALTER TABLE site_profile ADD COLUMN migration_aliases_json TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN about_body TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN about_interests_json TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN move_target_handle TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN move_target_actor_url TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN move_started_at TEXT`).run().catch(() => {});

	const row = await db
		.prepare(
			`SELECT display_name, avatar_url, header_image_url, bio, about_body, about_interests_json, verification_links_json, migration_aliases_json,
			        move_target_handle, move_target_actor_url, move_started_at
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

	await db.prepare(`ALTER TABLE site_profile ADD COLUMN migration_aliases_json TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN about_body TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN about_interests_json TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN move_target_handle TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN move_target_actor_url TEXT`).run().catch(() => {});
	await db.prepare(`ALTER TABLE site_profile ADD COLUMN move_started_at TEXT`).run().catch(() => {});

	await db
		.prepare(
			`INSERT INTO site_profile (
				id, display_name, avatar_url, header_image_url, bio, about_body, about_interests_json, verification_links_json, migration_aliases_json,
				move_target_handle, move_target_actor_url, move_started_at
			) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				display_name = excluded.display_name,
				avatar_url = excluded.avatar_url,
				header_image_url = excluded.header_image_url,
				bio = excluded.bio,
				about_body = excluded.about_body,
				about_interests_json = excluded.about_interests_json,
				verification_links_json = excluded.verification_links_json,
				migration_aliases_json = excluded.migration_aliases_json,
				move_target_handle = excluded.move_target_handle,
				move_target_actor_url = excluded.move_target_actor_url,
				move_started_at = excluded.move_started_at,
				updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			String(input.displayName || DEFAULT_PROFILE.displayName).trim(),
			normalizeUrl(input.avatarUrl, DEFAULT_PROFILE.avatarUrl),
			normalizeUrl(input.headerImageUrl || '', null),
			String(input.bio || DEFAULT_PROFILE.bio).trim(),
			String(input.aboutBody || DEFAULT_PROFILE.aboutBody).trim(),
			serializeAboutInterests(input.aboutInterests),
			serializeVerificationLinks(input.verificationLinks),
			serializeMigrationAliases(input.migrationAliases),
			getString(input.moveTargetHandle),
			getString(input.moveTargetActorUrl),
			getString(input.moveStartedAt)
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

export function parseMigrationAliasesInput(value: string) {
	return dedupeMigrationAliases(
		String(value || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
	);
}

export function formatMigrationAliasesInput(aliases: string[]) {
	return aliases.join('\n');
}

export function parseAboutInterestsInput(value: string) {
	return String(value || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function formatAboutInterestsInput(interests: string[]) {
	return interests.join('\n');
}
