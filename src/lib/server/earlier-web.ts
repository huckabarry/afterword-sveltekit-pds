import type { RequestEvent } from '@sveltejs/kit';
import { shouldSurfaceEarlierWebTitle } from '$lib/earlier-web';

type EarlierWebBucket = NonNullable<App.Platform['env']['R2_BUCKET']>;

type EarlierWebPostRow = {
	id: string;
	slug: string;
	year: number;
	month: number;
	title: string;
	excerpt: string;
	body_text: string;
	path: string;
	bundle_key: string;
	cover_image: string | null;
	has_images: number;
	published_at: string;
	source_path: string;
};

type EarlierWebStoredPost = {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	bodyMarkdown: string;
	coverImage: string | null;
	publishedAt: string;
	sourcePath: string;
};

type EarlierWebMonthBundle = {
	year: number;
	month: number;
	posts: EarlierWebStoredPost[];
};

export type EarlierWebYearSummary = {
	year: number;
	postCount: number;
	firstPublishedAt: string | null;
	lastPublishedAt: string | null;
};

export type EarlierWebPostSummary = {
	id: string;
	slug: string;
	year: number;
	month: number;
	title: string;
	excerpt: string;
	path: string;
	coverImage: string | null;
	hasImages: boolean;
	publishedAt: string;
	sourcePath: string;
	bodyTextLength: number;
};

export type EarlierWebPost = EarlierWebPostSummary & {
	bodyMarkdown: string;
	bodyHtml: string;
};

export type EarlierWebSearchResult = {
	id: string;
	slug: string;
	path: string;
	title: string;
	excerpt: string;
	section: string;
	coverImage: string | null;
	publishedAt: string;
	hideTitle: boolean;
};

export type EarlierWebStreamPage = {
	posts: EarlierWebPostSummary[];
	cursor: string | null;
	limit: number;
};

export type EarlierWebStreamPost = EarlierWebPostSummary & {
	bodyHtml: string;
};

export type EarlierWebStreamHydratedPage = {
	posts: EarlierWebStreamPost[];
	cursor: string | null;
	limit: number;
};

export type EarlierWebSeriesPost = EarlierWebPostSummary & {
	bodyHtml: string;
};

export type EarlierWebOnThisDayPost = EarlierWebPostSummary;

export const EARLIER_WEB_STREAM_PAGE_SIZE = 30;

function getEarlierWebDb(event: Pick<RequestEvent, 'platform'>) {
	return (
		event.platform?.env?.D1_DATABASE ??
		event.platform?.env?.D1_DATABASE_BINDING ??
		event.platform?.env?.AP_DB ??
		null
	);
}

function getEarlierWebBucket(event: Pick<RequestEvent, 'platform'>) {
	return event.platform?.env?.R2_BUCKET ?? null;
}

function toEarlierWebPostSummary(row: EarlierWebPostRow): EarlierWebPostSummary {
	return {
		id: row.id,
		slug: row.slug,
		year: Number(row.year),
		month: Number(row.month),
		title: row.title,
		excerpt: row.excerpt,
		path: row.path,
		coverImage: row.cover_image || null,
		hasImages: Boolean(row.has_images),
		publishedAt: row.published_at,
		sourcePath: row.source_path,
		bodyTextLength: String(row.body_text || '').trim().length
	};
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderInlineText(value: string) {
	return escapeHtml(value).replace(
		/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
		(_, label: string, href: string) =>
			`<a href="${escapeHtml(href)}" rel="nofollow noopener noreferrer">${escapeHtml(label)}</a>`
	);
}

function renderParagraph(text: string) {
	return `<p>${renderInlineText(text).replace(/\n/g, '<br>')}</p>`;
}

function renderImageLine(line: string) {
	const match = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

	if (!match) {
		return null;
	}

	const [, alt, src] = match;
	return `<figure class="earlier-web-post__figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" /></figure>`;
}

function renderImageBlock(block: string) {
	const matches = [...block.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];

	if (!matches.length) {
		return null;
	}

	const leftover = block.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim();

	if (leftover) {
		return null;
	}

	const figures = matches.map((match) => {
		const alt = match[1] || '';
		const src = match[2] || '';
		return `<figure class="earlier-web-post__figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" /></figure>`;
	});

	if (figures.length === 1) {
		return figures[0];
	}

	return `<div class="earlier-web-post__gallery">${figures.join('')}</div>`;
}

export function renderEarlierWebBody(bodyMarkdown: string) {
	const normalized = String(bodyMarkdown || '').replace(/\r\n/g, '\n').trim();

	if (!normalized) {
		return '';
	}

	const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
	const rendered: string[] = [];

	for (const block of blocks) {
		const imageBlockHtml = renderImageBlock(block);

		if (imageBlockHtml) {
			rendered.push(imageBlockHtml);
			continue;
		}

		const imageHtml = renderImageLine(block);

		if (imageHtml) {
			rendered.push(imageHtml);
			continue;
		}

		rendered.push(renderParagraph(block));
	}

	return rendered.join('\n');
}

async function getBundleFromR2(bucket: EarlierWebBucket, key: string) {
	const object = await bucket.get(key);

	if (!object) {
		return null;
	}

	try {
		return (await object.json()) as EarlierWebMonthBundle;
	} catch {
		return null;
	}
}

export async function getEarlierWebYears(
	event: Pick<RequestEvent, 'platform'>
): Promise<EarlierWebYearSummary[]> {
	const db = getEarlierWebDb(event);

	if (!db) {
		return [];
	}

	try {
		const result = await db
			.prepare(
				`SELECT
					year,
					COUNT(*) AS post_count,
					MIN(published_at) AS first_published_at,
					MAX(published_at) AS last_published_at
				FROM earlier_web_posts
				GROUP BY year
				ORDER BY year DESC`
			)
			.all<{
				year: number;
				post_count: number;
				first_published_at: string | null;
				last_published_at: string | null;
			}>();

		const rows = Array.isArray(result.results) ? result.results : [];

		return rows.map((row: {
			year: number;
			post_count: number;
			first_published_at: string | null;
			last_published_at: string | null;
		}) => ({
			year: Number(row.year),
			postCount: Number(row.post_count || 0),
			firstPublishedAt: row.first_published_at || null,
			lastPublishedAt: row.last_published_at || null
		}));
	} catch {
		return [];
	}
}

export async function getEarlierWebYearPosts(
	event: Pick<RequestEvent, 'platform'>,
	year: number
): Promise<EarlierWebPostSummary[]> {
	const db = getEarlierWebDb(event);

	if (!db) {
		return [];
	}

	try {
		const result = await db
			.prepare(
				`SELECT
					id,
					slug,
					year,
					month,
					title,
					excerpt,
					body_text,
					path,
					bundle_key,
					cover_image,
					has_images,
					published_at,
					source_path
				FROM earlier_web_posts
				WHERE year = ?
				ORDER BY published_at DESC`
			)
			.bind(year)
			.all<EarlierWebPostRow>();

		const rows = Array.isArray(result.results) ? result.results : [];
		return rows.map(toEarlierWebPostSummary);
	} catch {
		return [];
	}
}

export async function getEarlierWebOnThisDayPosts(
	event: Pick<RequestEvent, 'platform'>,
	date = new Date(),
	limit = 3
): Promise<EarlierWebOnThisDayPost[]> {
	const db = getEarlierWebDb(event);

	if (!db) {
		return [];
	}

	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const monthDay = `${month}-${day}`;
	const normalizedLimit = Math.max(1, Math.min(Number(limit) || 3, 12));

	try {
		const result = await db
			.prepare(
				`SELECT
					id,
					slug,
					year,
					month,
					title,
					excerpt,
					body_text,
					path,
					bundle_key,
					cover_image,
					has_images,
					published_at,
					source_path
				FROM earlier_web_posts
				WHERE substr(published_at, 6, 5) = ?
				ORDER BY published_at DESC
				LIMIT ?`
			)
			.bind(monthDay, Math.max(normalizedLimit * 8, 24))
			.all<EarlierWebPostRow>();

		const rows = Array.isArray(result.results) ? result.results : [];
		const sorted = rows
			.map(toEarlierWebPostSummary)
			.sort(
				(a: EarlierWebPostSummary, b: EarlierWebPostSummary) =>
					a.year - b.year || a.publishedAt.localeCompare(b.publishedAt)
			);

		if (sorted.length <= normalizedLimit) {
			return sorted;
		}

		const picks: EarlierWebPostSummary[] = [];

		for (let index = 0; index < normalizedLimit; index += 1) {
			const position = Math.floor((index * sorted.length) / normalizedLimit);
			const candidate = sorted[Math.min(position, sorted.length - 1)];

			if (candidate && !picks.some((entry) => entry.id === candidate.id)) {
				picks.push(candidate);
			}
		}

		for (const candidate of sorted) {
			if (picks.length >= normalizedLimit) break;
			if (!picks.some((entry) => entry.id === candidate.id)) {
				picks.push(candidate);
			}
		}

		return picks.sort((a, b) => a.year - b.year || a.publishedAt.localeCompare(b.publishedAt));
	} catch {
		return [];
	}
}

export async function getEarlierWebPost(
	event: Pick<RequestEvent, 'platform'>,
	year: number,
	month: number,
	slug: string
): Promise<EarlierWebPost | null> {
	const db = getEarlierWebDb(event);
	const bucket = getEarlierWebBucket(event);

	if (!db || !bucket) {
		return null;
	}

	try {
		const row = await db
			.prepare(
				`SELECT
					id,
					slug,
					year,
					month,
					title,
					excerpt,
					body_text,
					path,
					bundle_key,
					cover_image,
					has_images,
					published_at,
					source_path
				FROM earlier_web_posts
				WHERE year = ? AND month = ? AND slug = ?
				LIMIT 1`
			)
			.bind(year, month, slug)
			.first<EarlierWebPostRow>();

		if (!row) {
			return null;
		}

		const bundle = await getBundleFromR2(bucket, row.bundle_key);
		const post = bundle?.posts.find((entry) => entry.slug === slug) || null;

		if (!post) {
			return null;
		}

		const summary = toEarlierWebPostSummary(row);

		return {
			...summary,
			bodyMarkdown: post.bodyMarkdown,
			bodyHtml: renderEarlierWebBody(post.bodyMarkdown)
		};
	} catch {
		return null;
	}
}

function normalizeSearchQuery(query: string) {
	return `%${String(query || '').trim().replace(/\s+/g, '%')}%`;
}

export async function searchEarlierWebPosts(
	event: Pick<RequestEvent, 'platform'>,
	query: string,
	limit = 8
): Promise<EarlierWebSearchResult[]> {
	const db = getEarlierWebDb(event);
	const trimmed = String(query || '').trim();

	if (!db || trimmed.length < 2) {
		return [];
	}

	try {
		const result = await db
			.prepare(
				`SELECT
					id,
					slug,
				path,
				title,
				excerpt,
				body_text AS bodyText,
				cover_image AS coverImage,
				published_at AS publishedAt
			FROM earlier_web_posts
				WHERE
					title LIKE ? COLLATE NOCASE OR
					excerpt LIKE ? COLLATE NOCASE OR
					body_text LIKE ? COLLATE NOCASE
				ORDER BY published_at DESC
				LIMIT ?`
			)
			.bind(
				normalizeSearchQuery(trimmed),
				normalizeSearchQuery(trimmed),
				normalizeSearchQuery(trimmed),
				Math.max(1, Math.min(limit, 40))
			)
			.all<{
				id: string;
				slug: string;
				path: string;
				title: string;
				excerpt: string;
				bodyText: string;
				coverImage: string | null;
				publishedAt: string;
			}>();

		const rows = Array.isArray(result.results) ? result.results : [];

		return rows.map((row: {
			id: string;
			slug: string;
			path: string;
			title: string;
			excerpt: string;
			bodyText: string;
			coverImage: string | null;
			publishedAt: string;
		}) => ({
			id: row.id,
			slug: row.slug,
			path: row.path,
			title: row.title,
			excerpt: row.excerpt,
			section: 'From an Earlier Web',
			coverImage: row.coverImage || null,
			publishedAt: row.publishedAt,
			hideTitle: !shouldSurfaceEarlierWebTitle({
				title: row.title,
				excerpt: row.excerpt,
				bodyTextLength: String(row.bodyText || '').trim().length
			})
		}));
	} catch {
		return [];
	}
}

export async function getEarlierWebStreamPage(
	event: Pick<RequestEvent, 'platform'>,
	{
		cursor = null,
		limit = EARLIER_WEB_STREAM_PAGE_SIZE
	}: {
		cursor?: string | null;
		limit?: number;
	} = {}
): Promise<EarlierWebStreamPage> {
	const db = getEarlierWebDb(event);
	const normalizedLimit = Math.max(1, Math.min(Number(limit) || EARLIER_WEB_STREAM_PAGE_SIZE, 60));

	if (!db) {
		return {
			posts: [],
			cursor: null,
			limit: normalizedLimit
		};
	}

	const cursorParts = String(cursor || '').split('|');
	const cursorPublishedAt = cursorParts[0] || null;
	const cursorId = cursorParts[1] || null;

	try {
		const statement = cursorPublishedAt && cursorId
			? db
					.prepare(
						`SELECT
							id,
							slug,
							year,
							month,
							title,
							excerpt,
							body_text,
							path,
							bundle_key,
							cover_image,
							has_images,
							published_at,
							source_path
						FROM earlier_web_posts
						WHERE published_at < ? OR (published_at = ? AND id < ?)
						ORDER BY published_at DESC, id DESC
						LIMIT ?`
					)
					.bind(cursorPublishedAt, cursorPublishedAt, cursorId, normalizedLimit + 1)
			: db
					.prepare(
						`SELECT
							id,
							slug,
							year,
							month,
							title,
							excerpt,
							body_text,
							path,
							bundle_key,
							cover_image,
							has_images,
							published_at,
							source_path
						FROM earlier_web_posts
						ORDER BY published_at DESC, id DESC
						LIMIT ?`
					)
					.bind(normalizedLimit + 1);

		const result = await statement.all<EarlierWebPostRow>();
		const rows = Array.isArray(result.results) ? result.results : [];
		const slice = rows.slice(0, normalizedLimit);
		const posts = slice.map(toEarlierWebPostSummary);
		const lastRow = slice.at(-1) || null;

		return {
			posts,
			cursor: rows.length > normalizedLimit && lastRow ? `${lastRow.published_at}|${lastRow.id}` : null,
			limit: normalizedLimit
		};
	} catch {
		return {
			posts: [],
			cursor: null,
			limit: normalizedLimit
		};
	}
}

export async function getEarlierWebStreamHydratedPage(
	event: Pick<RequestEvent, 'platform'>,
	options: {
		cursor?: string | null;
		limit?: number;
	} = {}
): Promise<EarlierWebStreamHydratedPage> {
	const page = await getEarlierWebStreamPage(event, options);
	const bucket = getEarlierWebBucket(event);

	if (!bucket || !page.posts.length) {
		return {
			posts: page.posts.map((post) => ({
				...post,
				bodyHtml: post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''
			})),
			cursor: page.cursor,
			limit: page.limit
		};
	}

	const db = getEarlierWebDb(event);

	if (!db) {
		return {
			posts: page.posts.map((post) => ({
				...post,
				bodyHtml: post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''
			})),
			cursor: page.cursor,
			limit: page.limit
		};
	}

	const ids = page.posts.map((post) => post.id);
	const placeholders = ids.map(() => '?').join(', ');

	try {
		const result = await db
			.prepare(
				`SELECT id, bundle_key
				FROM earlier_web_posts
				WHERE id IN (${placeholders})`
			)
			.bind(...ids)
			.all<{ id: string; bundle_key: string }>();

		const rows: Array<{ id: string; bundle_key: string }> = Array.isArray(result.results)
			? (result.results as Array<{ id: string; bundle_key: string }>)
			: [];
		const bundleKeys = [...new Set(rows.map((row: { id: string; bundle_key: string }) => row.bundle_key))];
		const bundles = await Promise.all(bundleKeys.map((key) => getBundleFromR2(bucket, key)));
		const postsById = new Map<string, EarlierWebStoredPost>();

		for (const bundle of bundles) {
			for (const post of bundle?.posts || []) {
				postsById.set(post.id, post);
			}
		}

		return {
			posts: page.posts.map((post) => ({
				...post,
				bodyHtml: renderEarlierWebBody(postsById.get(post.id)?.bodyMarkdown || post.excerpt)
			})),
			cursor: page.cursor,
			limit: page.limit
		};
	} catch {
		return {
			posts: page.posts.map((post) => ({
				...post,
				bodyHtml: post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''
			})),
			cursor: page.cursor,
			limit: page.limit
		};
	}
}

export async function getEarlierWebSeriesPosts(
	event: Pick<RequestEvent, 'platform'>,
	{
		minBodyLength = 500,
		limit = 160
	}: {
		minBodyLength?: number;
		limit?: number;
	} = {}
): Promise<EarlierWebSeriesPost[]> {
	const db = getEarlierWebDb(event);
	const bucket = getEarlierWebBucket(event);
	const normalizedMinBodyLength = Math.max(1, Math.floor(minBodyLength || 500));
	const normalizedLimit = Math.max(1, Math.min(Math.floor(limit || 160), 240));

	if (!db || !bucket) {
		return [];
	}

	try {
		const result = await db
			.prepare(
				`SELECT
					id,
					slug,
					year,
					month,
					title,
					excerpt,
					body_text,
					path,
					bundle_key,
					cover_image,
					has_images,
					published_at,
					source_path
				FROM earlier_web_posts
				WHERE LENGTH(TRIM(body_text)) >= ?
				ORDER BY published_at DESC
				LIMIT ?`
			)
			.bind(normalizedMinBodyLength, normalizedLimit)
			.all<EarlierWebPostRow>();

		const rows: EarlierWebPostRow[] = Array.isArray(result.results)
			? (result.results as EarlierWebPostRow[])
			: [];
		const summaries = rows.map(toEarlierWebPostSummary);
		const bundleKeys = [...new Set(rows.map((row: EarlierWebPostRow) => row.bundle_key))];
		const bundles = await Promise.all(
			bundleKeys.map((key: string) => getBundleFromR2(bucket, key))
		);
		const postsById = new Map<string, EarlierWebStoredPost>();

		for (const bundle of bundles) {
			for (const post of bundle?.posts || []) {
				postsById.set(post.id, post);
			}
		}

		return summaries.map((post: EarlierWebPostSummary) => ({
			...post,
			bodyHtml: renderEarlierWebBody(postsById.get(post.id)?.bodyMarkdown || post.excerpt)
		}));
	} catch {
		return [];
	}
}
