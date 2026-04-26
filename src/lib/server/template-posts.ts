import { format } from 'date-fns';
import readingTime from 'reading-time';
import type { BlogPost } from '$lib/server/ghost';

export type TemplateHeading = {
	id: string;
	depth: number;
	value: string;
};

export type TemplatePost = {
	title: string;
	slug: string;
	date: string;
	readingTime: string;
	preview: {
		html: string;
		text: string;
	};
	html: string;
	headings: TemplateHeading[];
	next?: TemplatePost;
	previous?: TemplatePost;
};

function stripTags(value: string) {
	return String(value || '')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function escapeHtml(value: string) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function slugify(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/['".,!?()[\]{}:;]+/g, '')
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'section'
	);
}

function addHeadingIds(html: string) {
	const headings: TemplateHeading[] = [];
	const seen = new Map<string, number>();

	const rewritten = String(html || '').replace(
		/<(h[2-4])([^>]*)>([\s\S]*?)<\/\1>/gi,
		(match, tagName: string, attrs: string, inner: string) => {
			const depth = Number.parseInt(tagName.slice(1), 10);
			const idMatch = String(attrs).match(/\sid=(["'])([^"']+)\1/i);
			const text = stripTags(inner);

			if (!text) return match;

			let id = idMatch?.[2] || slugify(text);
			const count = seen.get(id) || 0;
			seen.set(id, count + 1);
			if (count > 0) {
				id = `${id}-${count + 1}`;
			}

			headings.push({ id, depth, value: text });

			if (idMatch) {
				return `<${tagName}${attrs.replace(idMatch[0], ` id="${id}"`)}>${inner}</${tagName}>`;
			}

			return `<${tagName}${attrs} id="${id}">${inner}</${tagName}>`;
		}
	);

	return { html: rewritten, headings };
}

export function toTemplatePost(post: BlogPost): TemplatePost {
	const withHeadings = addHeadingIds(post.html);

	return {
		title: post.title,
		slug: post.slug,
		date: format(post.publishedAt, 'yyyy-MM-dd'),
		readingTime: readingTime(stripTags(post.html)).text,
		preview: {
			html: `<p>${escapeHtml(post.excerpt)}</p>`,
			text: post.excerpt
		},
		html: withHeadings.html,
		headings: withHeadings.headings
	};
}

export function toTemplatePosts(posts: BlogPost[]) {
	const mapped = posts.map(toTemplatePost);

	return mapped.map((post, index, allPosts) => ({
		...post,
		next: allPosts[index - 1],
		previous: allPosts[index + 1]
	}));
}
