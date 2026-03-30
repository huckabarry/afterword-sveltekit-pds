import type { RequestEvent } from '@sveltejs/kit';

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
};

export type EarlierWebStreamPage = {
	posts: EarlierWebPostSummary[];
	cursor: string | null;
	limit: number;
};

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
		sourcePath: row.source_path
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

export function renderEarlierWebBody(bodyMarkdown: string) {
	const normalized = String(bodyMarkdown || '').replace(/\r\n/g, '\n').trim();

	if (!normalized) {
		return '';
	}

	const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
	const rendered: string[] = [];

	for (const block of blocks) {
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
			publishedAt: row.publishedAt
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
