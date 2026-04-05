import type { RequestEvent } from '@sveltejs/kit';
import { getColophonContent } from '$lib/server/content';

type CmsDb = {
	prepare: (sql: string) => {
		bind: (...values: unknown[]) => {
			first: <T = Record<string, unknown>>() => Promise<T | null>;
			all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
			run: () => Promise<unknown>;
		};
		first: <T = Record<string, unknown>>() => Promise<T | null>;
		all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
		run: () => Promise<unknown>;
	};
};

type CmsPageRow = {
	slug?: unknown;
	title?: unknown;
	description?: unknown;
	body?: unknown;
};

type CmsSettingsRow = {
	site_title?: unknown;
	site_tagline?: unknown;
	footer_tagline?: unknown;
	search_placeholder?: unknown;
};

type CmsNavRow = {
	name?: unknown;
	items_json?: unknown;
};

export type CmsLink = {
	label: string;
	href: string;
};

export type CmsPage = {
	slug: string;
	title: string;
	description: string;
	body: string;
};

export type CmsSiteSettings = {
	siteTitle: string;
	siteTagline: string;
	footerTagline: string;
	searchPlaceholder: string;
};

export type CmsNavigation = {
	primary: CmsLink[];
	secondary: CmsLink[];
	footer: CmsLink[];
};

export type CmsShell = {
	settings: CmsSiteSettings;
	navigation: CmsNavigation;
};

const DEFAULT_SITE_SETTINGS: CmsSiteSettings = {
	siteTitle: 'Afterword',
	siteTagline: 'A quieter personal home for notes, photos, media, and wandering.',
	footerTagline: 'A quieter personal home for notes, photos, media, and wandering.',
	searchPlaceholder: 'Search the site...'
};

const DEFAULT_NAVIGATION: CmsNavigation = {
	primary: [
		{ href: '/', label: 'Home' },
		{ href: '/status', label: 'Status' },
		{ href: '/photos', label: 'Gallery' },
		{ href: '/about', label: 'About' }
	],
	secondary: [
		{ href: '/hello', label: 'Hello' },
		{ href: '/now', label: 'Now' },
		{ href: '/check-ins', label: 'Check-ins' },
		{ href: '/media', label: 'Media' },
		{ href: '/colophon', label: 'Colophon' },
		{ href: '/subscribe', label: 'Subscribe' }
	],
	footer: [
		{ href: '/about', label: 'About' },
		{ href: '/colophon', label: 'Colophon' },
		{ href: '/subscribe', label: 'Subscribe' }
	]
};

const DEFAULT_PAGES: CmsPage[] = [
	{
		slug: 'hello',
		title: 'Hello',
		description:
			'A short guide to what Afterword is, what Bryan writes about, and the best ways to say hello.',
		body: `If you’re curious about this site or how to get in touch, here’s a summary.

Afterword is my online home. I post short updates, photos, check-ins, and longer notes about cities, neighborhoods, design, transit, music, and small things that catch my attention. Some of it runs on my own PDS, a private space where I manage my digital information, but this site is still my main hub.

I’m an urban planner. Outside of work, I enjoy photography, gardening, and music. Playing guitar helps me relax and feel like myself. I’m married with two young kids. While I don’t always write about family, they’re a big part of my life.

Most posts come from wandering and thinking about buildings, public spaces, neighborhood life, and making a personal site feel more human. I believe the internet needs more small, personal places. To help you explore, here’s where you might want to start:

## Start Here

- [Field Notes](/field-notes) contains my personal, place-based writing, sharing observations and experiences from my perspective.
- [Planning & Urbanism](/planning) is dedicated to my professional perspectives on city planning and urban issues, and it can also be followed by email through [Low Velocity](https://lowvelocity.org).
- [The Gallery](/photos) showcases some of my photography and visual observations.
- [Now](/now) for a snapshot of what currently has my attention.
- In [Media](/media), I highlight what I’m listening to, reading, and watching, with brief commentary.
- [Check-ins](/check-ins) document maps and locations from my travels and provide context to the places I visit.

## How To Reach Me

- For public conversations, you’ll find me on [Bluesky](https://bsky.app/profile/afterword.blog). I usually reply quickly there.
- If you want to send a private message, use the [contact page](/contact).
- If you found me through an old fediverse or side-project profile, I’m probably not active there anymore. This site and Bluesky are the best ways to reach me.

## A Few Expectations

- I prefer slower, more thoughtful conversations over the constant rush to post.
- I don’t mind people reaching out cold if there’s a genuine reason. A note about a post, city, photograph, shared obsession, or recommendation is always a good place to start.
- If you want to know more about me, check the [About page](/about). The [Colophon](/colophon) explains how this site was built.

I want this place to feel approachable. If something here resonates with you, feel free to say hello.`
	},
	{
		slug: 'colophon',
		title: getColophonContent().title,
		description: getColophonContent().description,
		body: getColophonContent().paragraphs.join('\n\n')
	}
];

function getDb(event: Pick<RequestEvent, 'platform'>) {
	try {
		return (
			event.platform?.env?.D1_DATABASE ??
			event.platform?.env?.D1_DATABASE_BINDING ??
			event.platform?.env?.AP_DB ??
			null
		) as CmsDb | null;
	} catch {
		return null;
	}
}

function getGlobalCache() {
	const scope = globalThis as typeof globalThis & {
		__afterwordSiteCmsCache?: Map<string, { expiresAt: number; value: unknown }>;
	};
	if (!scope.__afterwordSiteCmsCache) {
		scope.__afterwordSiteCmsCache = new Map();
	}
	return scope.__afterwordSiteCmsCache;
}

function cacheGet<T>(key: string) {
	const cache = getGlobalCache();
	const cached = cache.get(key);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value as T;
	}
	if (cached) {
		cache.delete(key);
	}
	return null;
}

function cacheSet(key: string, value: unknown, ttlMs = 30_000) {
	getGlobalCache().set(key, {
		expiresAt: Date.now() + ttlMs,
		value
	});
}

function clearCmsCache() {
	getGlobalCache().clear();
}

function normalizeString(value: unknown, fallback = '') {
	const trimmed = String(value || '').trim();
	return trimmed || fallback;
}

function normalizeLink(item: unknown): CmsLink | null {
	if (!item || typeof item !== 'object') return null;
	const link = item as { label?: unknown; href?: unknown };
	const label = normalizeString(link.label);
	const href = normalizeString(link.href);
	if (!label || !href) return null;
	return { label, href };
}

function parseLinks(value: unknown, fallback: CmsLink[]) {
	if (typeof value !== 'string' || !value.trim()) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return fallback;
		const links = parsed.map(normalizeLink).filter((item): item is CmsLink => Boolean(item));
		return links.length ? links : [];
	} catch {
		return fallback;
	}
}

function serializeLinks(items: CmsLink[]) {
	return JSON.stringify(items.map((item) => ({ label: item.label, href: item.href })));
}

function normalizePage(row: CmsPageRow | null | undefined, fallback?: CmsPage): CmsPage {
	return {
		slug: normalizeString(row?.slug, fallback?.slug || ''),
		title: normalizeString(row?.title, fallback?.title || ''),
		description: normalizeString(row?.description, fallback?.description || ''),
		body: normalizeString(row?.body, fallback?.body || '')
	};
}

async function ensureCmsTables(db: CmsDb) {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS cms_site_settings (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				site_title TEXT NOT NULL,
				site_tagline TEXT NOT NULL,
				footer_tagline TEXT NOT NULL,
				search_placeholder TEXT NOT NULL,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS cms_navigation (
				name TEXT PRIMARY KEY,
				items_json TEXT NOT NULL,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run();

	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS cms_pages (
				slug TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT NOT NULL,
				body TEXT NOT NULL,
				updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`
		)
		.run();
}

async function seedCmsDefaults(db: CmsDb) {
	const settingsRow = await db.prepare(`SELECT id FROM cms_site_settings WHERE id = 1 LIMIT 1`).first();
	if (!settingsRow) {
		await db
			.prepare(
				`INSERT INTO cms_site_settings (id, site_title, site_tagline, footer_tagline, search_placeholder)
				 VALUES (1, ?, ?, ?, ?)`
			)
			.bind(
				DEFAULT_SITE_SETTINGS.siteTitle,
				DEFAULT_SITE_SETTINGS.siteTagline,
				DEFAULT_SITE_SETTINGS.footerTagline,
				DEFAULT_SITE_SETTINGS.searchPlaceholder
			)
			.run();
	}

	for (const [name, items] of Object.entries(DEFAULT_NAVIGATION)) {
		const existing = await db
			.prepare(`SELECT name FROM cms_navigation WHERE name = ? LIMIT 1`)
			.bind(name)
			.first();
		if (!existing) {
			await db
				.prepare(`INSERT INTO cms_navigation (name, items_json) VALUES (?, ?)`)
				.bind(name, serializeLinks(items))
				.run();
		}
	}

	for (const page of DEFAULT_PAGES) {
		const existing = await db
			.prepare(`SELECT slug FROM cms_pages WHERE slug = ? LIMIT 1`)
			.bind(page.slug)
			.first();
		if (!existing) {
			await db
				.prepare(
					`INSERT INTO cms_pages (slug, title, description, body)
					 VALUES (?, ?, ?, ?)`
				)
				.bind(page.slug, page.title, page.description, page.body)
				.run();
		}
	}
}

async function ensureCmsReady(db: CmsDb) {
	await ensureCmsTables(db);
	await seedCmsDefaults(db);
}

export async function getCmsSiteSettings(event: Pick<RequestEvent, 'platform'>): Promise<CmsSiteSettings> {
	const cacheKey = 'cms:settings';
	const cached = cacheGet<CmsSiteSettings>(cacheKey);
	if (cached) return cached;

	const db = getDb(event);
	if (!db) return DEFAULT_SITE_SETTINGS;

	await ensureCmsReady(db);
	const row = await db
		.prepare(
			`SELECT site_title, site_tagline, footer_tagline, search_placeholder
			 FROM cms_site_settings
			 WHERE id = 1
			 LIMIT 1`
		)
		.first<CmsSettingsRow>();

	const settings: CmsSiteSettings = {
		siteTitle: normalizeString(row?.site_title, DEFAULT_SITE_SETTINGS.siteTitle),
		siteTagline: normalizeString(row?.site_tagline, DEFAULT_SITE_SETTINGS.siteTagline),
		footerTagline: normalizeString(row?.footer_tagline, DEFAULT_SITE_SETTINGS.footerTagline),
		searchPlaceholder: normalizeString(row?.search_placeholder, DEFAULT_SITE_SETTINGS.searchPlaceholder)
	};

	cacheSet(cacheKey, settings);
	return settings;
}

export async function updateCmsSiteSettings(
	event: Pick<RequestEvent, 'platform'>,
	input: CmsSiteSettings
): Promise<CmsSiteSettings> {
	const db = getDb(event);
	if (!db) return input;

	await ensureCmsReady(db);
	const settings: CmsSiteSettings = {
		siteTitle: normalizeString(input.siteTitle, DEFAULT_SITE_SETTINGS.siteTitle),
		siteTagline: normalizeString(input.siteTagline, DEFAULT_SITE_SETTINGS.siteTagline),
		footerTagline: normalizeString(input.footerTagline, DEFAULT_SITE_SETTINGS.footerTagline),
		searchPlaceholder: normalizeString(
			input.searchPlaceholder,
			DEFAULT_SITE_SETTINGS.searchPlaceholder
		)
	};

	await db
		.prepare(
			`INSERT INTO cms_site_settings (id, site_title, site_tagline, footer_tagline, search_placeholder, updated_at)
			 VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			 ON CONFLICT(id) DO UPDATE SET
			 	site_title = excluded.site_title,
			 	site_tagline = excluded.site_tagline,
			 	footer_tagline = excluded.footer_tagline,
			 	search_placeholder = excluded.search_placeholder,
			 	updated_at = CURRENT_TIMESTAMP`
		)
		.bind(
			settings.siteTitle,
			settings.siteTagline,
			settings.footerTagline,
			settings.searchPlaceholder
		)
		.run();

	clearCmsCache();
	return settings;
}

export async function getCmsNavigation(event: Pick<RequestEvent, 'platform'>): Promise<CmsNavigation> {
	const cacheKey = 'cms:navigation';
	const cached = cacheGet<CmsNavigation>(cacheKey);
	if (cached) return cached;

	const db = getDb(event);
	if (!db) return DEFAULT_NAVIGATION;

	await ensureCmsReady(db);
	const rows = await db
		.prepare(`SELECT name, items_json FROM cms_navigation`)
		.all<CmsNavRow>();

	const navigation: CmsNavigation = {
		primary: DEFAULT_NAVIGATION.primary,
		secondary: DEFAULT_NAVIGATION.secondary,
		footer: DEFAULT_NAVIGATION.footer
	};

	for (const row of rows.results || []) {
		const name = normalizeString(row.name);
		if (name === 'primary' || name === 'secondary' || name === 'footer') {
			navigation[name] = parseLinks(row.items_json, DEFAULT_NAVIGATION[name]);
		}
	}

	cacheSet(cacheKey, navigation);
	return navigation;
}

export async function updateCmsNavigation(
	event: Pick<RequestEvent, 'platform'>,
	input: CmsNavigation
): Promise<CmsNavigation> {
	const db = getDb(event);
	if (!db) return input;

	await ensureCmsReady(db);

	const navigation: CmsNavigation = {
		primary: input.primary.map((item) => ({ label: normalizeString(item.label), href: normalizeString(item.href) })).filter((item) => item.label && item.href),
		secondary: input.secondary.map((item) => ({ label: normalizeString(item.label), href: normalizeString(item.href) })).filter((item) => item.label && item.href),
		footer: input.footer.map((item) => ({ label: normalizeString(item.label), href: normalizeString(item.href) })).filter((item) => item.label && item.href)
	};

	for (const [name, items] of Object.entries(navigation)) {
		await db
			.prepare(
				`INSERT INTO cms_navigation (name, items_json, updated_at)
				 VALUES (?, ?, CURRENT_TIMESTAMP)
				 ON CONFLICT(name) DO UPDATE SET
				 	items_json = excluded.items_json,
				 	updated_at = CURRENT_TIMESTAMP`
			)
			.bind(name, serializeLinks(items))
			.run();
	}

	clearCmsCache();
	return navigation;
}

export async function listCmsPages(event: Pick<RequestEvent, 'platform'>): Promise<CmsPage[]> {
	const cacheKey = 'cms:pages:list';
	const cached = cacheGet<CmsPage[]>(cacheKey);
	if (cached) return cached;

	const db = getDb(event);
	if (!db) return DEFAULT_PAGES;

	await ensureCmsReady(db);
	const rows = await db
		.prepare(`SELECT slug, title, description, body FROM cms_pages ORDER BY slug`)
		.all<CmsPageRow>();

	const pages = (rows.results || []).map((row) => normalizePage(row)).filter((page) => page.slug);
	cacheSet(cacheKey, pages);
	return pages;
}

export async function getCmsPageBySlug(
	event: Pick<RequestEvent, 'platform'>,
	slug: string
): Promise<CmsPage | null> {
	const normalizedSlug = normalizeString(slug).toLowerCase();
	if (!normalizedSlug) return null;

	const cacheKey = `cms:page:${normalizedSlug}`;
	const cached = cacheGet<CmsPage>(cacheKey);
	if (cached) return cached;

	const db = getDb(event);
	if (!db) {
		return DEFAULT_PAGES.find((page) => page.slug === normalizedSlug) || null;
	}

	await ensureCmsReady(db);
	const row = await db
		.prepare(`SELECT slug, title, description, body FROM cms_pages WHERE slug = ? LIMIT 1`)
		.bind(normalizedSlug)
		.first<CmsPageRow>();

	if (!row) return null;

	const page = normalizePage(row);
	cacheSet(cacheKey, page);
	return page;
}

export async function updateCmsPage(
	event: Pick<RequestEvent, 'platform'>,
	input: CmsPage
): Promise<CmsPage> {
	const db = getDb(event);
	if (!db) return input;

	await ensureCmsReady(db);
	const page: CmsPage = {
		slug: normalizeString(input.slug).toLowerCase(),
		title: normalizeString(input.title),
		description: normalizeString(input.description),
		body: String(input.body || '').trim()
	};

	await db
		.prepare(
			`INSERT INTO cms_pages (slug, title, description, body, updated_at)
			 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
			 ON CONFLICT(slug) DO UPDATE SET
			 	title = excluded.title,
			 	description = excluded.description,
			 	body = excluded.body,
			 	updated_at = CURRENT_TIMESTAMP`
		)
		.bind(page.slug, page.title, page.description, page.body)
		.run();

	clearCmsCache();
	return page;
}

export async function getCmsShell(event: Pick<RequestEvent, 'platform'>): Promise<CmsShell> {
	const [settings, navigation] = await Promise.all([
		getCmsSiteSettings(event),
		getCmsNavigation(event)
	]);

	return { settings, navigation };
}

export function getEditablePageSeed(slug: string) {
	const normalized = normalizeString(slug).toLowerCase();
	return DEFAULT_PAGES.find((page) => page.slug === normalized) || null;
}

export function getDefaultHelloPageSeed() {
	return getEditablePageSeed('hello');
}

export function getDefaultColophonPageSeed() {
	return getEditablePageSeed('colophon');
}
