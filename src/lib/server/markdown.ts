import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: false
});

export function renderMarkdown(source: string) {
	return markdown.render(String(source || '').trim());
}
