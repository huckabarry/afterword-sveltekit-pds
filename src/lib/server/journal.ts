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

type SanityJournalEntryRecord = {
	_id: string;
	title: string;
	slug?: { current?: string } | null;
	publishedAt: string;
	summary?: string | null;
	tags?: Array<{
		title?: string | null;
		slug?: { current?: string } | null;
		description?: string | null;
	}> | null;
	intro?: SanityBlock[] | null;
	body?: SanityBlock[] | null;
	hideFromIndexing?: boolean | null;
};

type SanityJournalTagRecord = {
	_id: string;
	title: string;
	slug?: { current?: string } | null;
	description?: string | null;
	entryCount?: number;
};

export type JournalTag = {
	id: string;
	title: string;
	slug: string;
	path: string;
	description: string;
	entryCount?: number;
};

export type JournalEntry = {
	id: string;
	title: string;
	slug: string;
	path: string;
	publishedAt: string;
	summary: string;
	introHtml: string;
	bodyHtml: string;
	hideFromIndexing: boolean;
	tags: JournalTag[];
};

const SANITY_PROJECT_ID = 'ea0gp9o5';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2025-02-19';

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

function renderPortableText(blocks: SanityBlock[] | null | undefined) {
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

function trimHtmlToText(html: string) {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
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
			accept: 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Sanity request failed with ${response.status}`);
	}

	const payload = (await response.json()) as { result?: T };
	return payload.result as T;
}

function toJournalEntry(record: SanityJournalEntryRecord): JournalEntry | null {
	const slug = String(record.slug?.current || '').trim();
	if (!slug) return null;

	const introHtml = renderPortableText(record.intro);
	const bodyHtml = renderPortableText(record.body);
	const summary = String(record.summary || '').trim() || trimHtmlToText(introHtml || bodyHtml).slice(0, 220);
	const tags = Array.isArray(record.tags)
		? record.tags
				.map((tag, index) => {
					const tagSlug = String(tag?.slug?.current || '').trim();
					const tagTitle = String(tag?.title || '').trim();
					if (!tagSlug || !tagTitle) return null;

					return {
						id: `tag-${slug}-${index}-${tagSlug}`,
						title: tagTitle,
						slug: tagSlug,
						path: `/notebook-preview/tags/${tagSlug}`,
						description: String(tag?.description || '').trim(),
					} satisfies JournalTag;
				})
				.filter((tag): tag is JournalTag => Boolean(tag))
		: [];

	return {
		id: record._id,
		title: record.title,
		slug,
		path: `/notebook-preview/${slug}`,
		publishedAt: record.publishedAt,
		summary,
		introHtml,
		bodyHtml,
		hideFromIndexing: Boolean(record.hideFromIndexing ?? true),
		tags,
	};
}

function toJournalTag(record: SanityJournalTagRecord): JournalTag | null {
	const slug = String(record.slug?.current || '').trim();
	const title = String(record.title || '').trim();
	if (!slug || !title) return null;

	return {
		id: record._id,
		title,
		slug,
		path: `/notebook-preview/tags/${slug}`,
		description: String(record.description || '').trim(),
		entryCount:
			typeof record.entryCount === 'number' && Number.isFinite(record.entryCount)
				? record.entryCount
				: undefined,
	};
}

export async function getJournalEntries(limit = 50): Promise<JournalEntry[]> {
	const query =
		'*[_type == "journalEntry" && defined(slug.current)] | order(publishedAt desc)[0...$limit]{_id,title,slug,publishedAt,summary,tags[]->{title,slug,description},intro,body,hideFromIndexing}';
	const records = await querySanity<SanityJournalEntryRecord[]>(query, {
		limit,
	});

	return (Array.isArray(records) ? records : []).map(toJournalEntry).filter((entry): entry is JournalEntry => Boolean(entry));
}

export async function getJournalEntryBySlug(slug: string): Promise<JournalEntry | null> {
	const query =
		'*[_type == "journalEntry" && slug.current == $slug][0]{_id,title,slug,publishedAt,summary,tags[]->{title,slug,description},intro,body,hideFromIndexing}';
	const record = await querySanity<SanityJournalEntryRecord | null>(query, { slug });
	return record ? toJournalEntry(record) : null;
}

export async function getJournalTags(): Promise<JournalTag[]> {
	const query =
		'*[_type == "journalTag" && defined(slug.current)] | order(title asc){_id,title,slug,description,"entryCount": count(*[_type == "journalEntry" && references(^._id)])}';
	const records = await querySanity<SanityJournalTagRecord[]>(query);
	return (Array.isArray(records) ? records : []).map(toJournalTag).filter((tag): tag is JournalTag => Boolean(tag));
}

export async function getJournalTagBySlug(slug: string): Promise<JournalTag | null> {
	const query =
		'*[_type == "journalTag" && slug.current == $slug][0]{_id,title,slug,description,"entryCount": count(*[_type == "journalEntry" && references(^._id)])}';
	const record = await querySanity<SanityJournalTagRecord | null>(query, { slug });
	return record ? toJournalTag(record) : null;
}

export async function getJournalEntriesByTagSlug(slug: string, limit = 100): Promise<JournalEntry[]> {
	const query =
		'*[_type == "journalEntry" && defined(slug.current) && count((tags[]->slug.current)[@ == $slug]) > 0] | order(publishedAt desc)[0...$limit]{_id,title,slug,publishedAt,summary,tags[]->{title,slug,description},intro,body,hideFromIndexing}';
	const records = await querySanity<SanityJournalEntryRecord[]>(query, {
		slug,
		limit,
	});

	return (Array.isArray(records) ? records : []).map(toJournalEntry).filter((entry): entry is JournalEntry => Boolean(entry));
}
