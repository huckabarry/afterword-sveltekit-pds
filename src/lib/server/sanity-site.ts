import type { SiteProfile, VerificationLink } from '$lib/server/profile';

type SanityMarkDef = {
	_key: string;
	_type: string;
	href?: string;
};

type SanitySpan = {
	_type: 'span';
	text?: string;
	marks?: string[];
};

type SanityBlock = {
	_type: 'block';
	style?: string;
	children?: SanitySpan[];
	markDefs?: SanityMarkDef[];
	listItem?: string;
	level?: number;
};

type SanitySiteShellRecord = {
	siteIdentity?: {
		displayName?: string | null;
		avatarUrl?: string | null;
		headerImageUrl?: string | null;
		bio?: string | null;
		aboutBody?: SanityBlock[] | null;
		aboutInterests?: string[] | null;
		verificationLinks?: Array<{ label?: string | null; url?: string | null }> | null;
	} | null;
	siteSettings?: {
		siteTitle?: string | null;
		siteDescription?: string | null;
	} | null;
	headerNavigation?: {
		primaryItems?: SanityNavigationItemRecord[] | null;
		menuItems?: SanityNavigationItemRecord[] | null;
	} | null;
	footerNavigation?: {
		items?: SanityNavigationItemRecord[] | null;
	} | null;
};

type SanityNavigationItemRecord = {
	label?: string | null;
	internalPath?: string | null;
	url?: string | null;
	openInNewTab?: boolean | null;
	pageSlug?: string | null;
};

type SanityRouteIntroRecord = {
	title?: string | null;
	description?: string | null;
	paragraphs?: string[] | null;
	routePath?: string | null;
};

type SanityEditorialPageRecord = {
	title?: string | null;
	slug?: { current?: string } | null;
	summary?: string | null;
	intro?: SanityBlock[] | null;
	body?: SanityBlock[] | null;
};

export type RouteIntroContent = {
	title: string;
	description: string;
	paragraphs: string[];
};

export type EditorialPageContent = {
	title: string;
	slug: string;
	summary: string;
	introHtml: string;
	bodyHtml: string;
};

export type NavigationLink = {
	label: string;
	href: string;
	openInNewTab: boolean;
};

export type SanitySiteShell = {
	profilePatch: Partial<SiteProfile>;
	siteTitle: string;
	siteDescription: string;
	primaryNavLinks: NavigationLink[];
	secondaryNavLinks: NavigationLink[];
	footerNavLinks: NavigationLink[];
};

const SANITY_PROJECT_ID = 'ea0gp9o5';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2025-02-19';
const CACHE_TTL_MS = 5 * 60 * 1000;

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

function escapeHtml(value: string) {
	return String(value || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderSpan(span: SanitySpan, markDefs: SanityMarkDef[]) {
	const text = escapeHtml(span.text || '');
	const marks = Array.isArray(span.marks) ? span.marks : [];

	if (!marks.length) {
		return text;
	}

	return marks.reduce((content, mark) => {
		if (mark === 'strong') return `<strong>${content}</strong>`;
		if (mark === 'em') return `<em>${content}</em>`;
		if (mark === 'code') return `<code>${content}</code>`;

		const definition = markDefs.find((item) => item._key === mark);
		if (definition?._type === 'link' && definition.href) {
			return `<a href="${escapeHtml(definition.href)}" rel="noreferrer">${content}</a>`;
		}

		return content;
	}, text);
}

function portableTextToParagraphs(blocks: SanityBlock[] | null | undefined) {
	const sourceBlocks = Array.isArray(blocks) ? blocks : [];

	return sourceBlocks
		.filter((block) => block?._type === 'block' && !block.listItem)
		.map((block) => {
			const children = Array.isArray(block.children) ? block.children : [];
			return children
				.map((child) => String(child?.text || ''))
				.join('')
				.trim();
		})
		.filter(Boolean);
}

export function renderPortableText(blocks: SanityBlock[] | null | undefined) {
	const sourceBlocks = Array.isArray(blocks) ? blocks : [];
	if (!sourceBlocks.length) {
		return '';
	}

	const html: string[] = [];
	let openListType: 'ul' | 'ol' | null = null;

	function closeListIfNeeded() {
		if (!openListType) return;
		html.push(`</${openListType}>`);
		openListType = null;
	}

	for (const block of sourceBlocks) {
		if (block?._type !== 'block') continue;

		const children = Array.isArray(block.children) ? block.children : [];
		const markDefs = Array.isArray(block.markDefs) ? block.markDefs : [];
		const content = children.map((child) => renderSpan(child, markDefs)).join('');
		const style = String(block.style || 'normal');
		const listItem = String(block.listItem || '');

		if (listItem === 'bullet') {
			if (openListType !== 'ul') {
				closeListIfNeeded();
				html.push('<ul>');
				openListType = 'ul';
			}
			html.push(`<li>${content}</li>`);
			continue;
		}

		if (listItem === 'number') {
			if (openListType !== 'ol') {
				closeListIfNeeded();
				html.push('<ol>');
				openListType = 'ol';
			}
			html.push(`<li>${content}</li>`);
			continue;
		}

		closeListIfNeeded();

		if (style === 'h2') {
			html.push(`<h2>${content}</h2>`);
			continue;
		}

		if (style === 'h3') {
			html.push(`<h3>${content}</h3>`);
			continue;
		}

		if (style === 'blockquote') {
			html.push(`<blockquote><p>${content}</p></blockquote>`);
			continue;
		}

		html.push(`<p>${content}</p>`);
	}

	closeListIfNeeded();
	return html.join('\n');
}

function normalizeVerificationLinks(
	links: Array<{ label?: string | null; url?: string | null }> | null | undefined
): VerificationLink[] {
	return (Array.isArray(links) ? links : [])
		.map((link) => {
			const label = String(link?.label || '').trim();
			const url = String(link?.url || '').trim();

			if (!label || !url) {
				return null;
			}

			return { label, url };
		})
		.filter((link): link is VerificationLink => Boolean(link));
}

function resolveNavHref(item: SanityNavigationItemRecord) {
	const internalPath = String(item.internalPath || '').trim();
	if (internalPath) {
		return internalPath;
	}

	const pageSlug = String(item.pageSlug || '').trim();
	if (pageSlug) {
		return `/${pageSlug}`;
	}

	const url = String(item.url || '').trim();
	return url;
}

function normalizeNavLinks(items: SanityNavigationItemRecord[] | null | undefined): NavigationLink[] {
	return (Array.isArray(items) ? items : [])
		.map((item) => {
			const label = String(item.label || '').trim();
			const href = resolveNavHref(item);

			if (!label || !href) {
				return null;
			}

			return {
				label,
				href,
				openInNewTab: Boolean(item.openInNewTab)
			} satisfies NavigationLink;
		})
		.filter((item): item is NavigationLink => Boolean(item));
}

async function querySanity<T>(
	query: string,
	params: Record<string, string | number | boolean> = {}
) {
	const url = new URL(
		`https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}`
	);
	url.searchParams.set('query', query);

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(`$${key}`, JSON.stringify(value));
	}

	const response = await fetch(url, {
		headers: {
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Sanity request failed with ${response.status}`);
	}

	const payload = (await response.json()) as { result?: T };
	return payload.result as T;
}

async function getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const cached = memoryCache.get(key);

	if (cached && cached.expiresAt > now) {
		return cached.value as T;
	}

	const value = await loader();
	memoryCache.set(key, {
		expiresAt: now + CACHE_TTL_MS,
		value
	});
	return value;
}

export async function getSanitySiteShell(): Promise<SanitySiteShell | null> {
	return getCached('site-shell', async () => {
		try {
			const query = `{
				"siteIdentity": *[_id == "siteIdentity"][0]{
					displayName,
					avatarUrl,
					headerImageUrl,
					bio,
					aboutBody,
					aboutInterests,
					verificationLinks
				},
				"siteSettings": *[_id == "siteSettings"][0]{
					siteTitle,
					siteDescription
				},
				"headerNavigation": *[_id == "headerNavigation"][0]{
					primaryItems[]{
						label,
						internalPath,
						url,
						openInNewTab,
						"pageSlug": page->slug.current
					},
					menuItems[]{
						label,
						internalPath,
						url,
						openInNewTab,
						"pageSlug": page->slug.current
					}
				},
				"footerNavigation": *[_id == "footerNavigation"][0]{
					items[]{
						label,
						internalPath,
						url,
						openInNewTab,
						"pageSlug": page->slug.current
					}
				}
			}`;

			const record = await querySanity<SanitySiteShellRecord | null>(query);
			if (!record) {
				return null;
			}

			const aboutBody = portableTextToParagraphs(record.siteIdentity?.aboutBody).join('\n\n').trim();
			const verificationLinks = normalizeVerificationLinks(record.siteIdentity?.verificationLinks);

			return {
				profilePatch: {
					displayName: String(record.siteIdentity?.displayName || '').trim() || undefined,
					avatarUrl: String(record.siteIdentity?.avatarUrl || '').trim() || undefined,
					headerImageUrl: String(record.siteIdentity?.headerImageUrl || '').trim() || null,
					bio: String(record.siteIdentity?.bio || '').trim() || undefined,
					aboutBody: aboutBody || undefined,
					aboutInterests: Array.isArray(record.siteIdentity?.aboutInterests)
						? record.siteIdentity.aboutInterests.filter((item): item is string => Boolean(String(item || '').trim()))
						: undefined,
					verificationLinks: verificationLinks.length ? verificationLinks : undefined
				},
				siteTitle: String(record.siteSettings?.siteTitle || '').trim(),
				siteDescription: String(record.siteSettings?.siteDescription || '').trim(),
				primaryNavLinks: normalizeNavLinks(record.headerNavigation?.primaryItems),
				secondaryNavLinks: normalizeNavLinks(record.headerNavigation?.menuItems),
				footerNavLinks: normalizeNavLinks(record.footerNavigation?.items)
			} satisfies SanitySiteShell;
		} catch (error) {
			console.warn('Unable to load Sanity site shell.', error);
			return null;
		}
	});
}

export async function getSanityRouteIntro(routeKey: string): Promise<RouteIntroContent | null> {
	return getCached(`route-intro:${routeKey}`, async () => {
		try {
			const query =
				'*[_type == "routeIntro" && routeKey == $routeKey][0]{title,description,paragraphs,routePath}';
			const record = await querySanity<SanityRouteIntroRecord | null>(query, { routeKey });
			if (!record) {
				return null;
			}

			return {
				title: String(record.title || '').trim(),
				description: String(record.description || '').trim(),
				paragraphs: (Array.isArray(record.paragraphs) ? record.paragraphs : [])
					.map((paragraph) => String(paragraph || '').trim())
					.filter(Boolean)
			};
		} catch (error) {
			console.warn(`Unable to load Sanity route intro for ${routeKey}.`, error);
			return null;
		}
	});
}

export async function getSanityEditorialPage(slug: string): Promise<EditorialPageContent | null> {
	return getCached(`editorial-page:${slug}`, async () => {
		try {
			const query =
				'*[_type == "page" && slug.current == $slug][0]{title,slug,summary,intro,body}';
			const record = await querySanity<SanityEditorialPageRecord | null>(query, { slug });
			if (!record) {
				return null;
			}

			const normalizedSlug = String(record.slug?.current || '').trim();
			if (!normalizedSlug) {
				return null;
			}

			return {
				title: String(record.title || '').trim() || normalizedSlug,
				slug: normalizedSlug,
				summary: String(record.summary || '').trim(),
				introHtml: renderPortableText(record.intro),
				bodyHtml: renderPortableText(record.body)
			};
		} catch (error) {
			console.warn(`Unable to load Sanity editorial page for ${slug}.`, error);
			return null;
		}
	});
}
