import fs from 'node:fs';
import path from 'node:path';

const CONTENT_ROOT = path.join(process.cwd(), 'src', 'content');

type FrontmatterValue = string | string[];

type ParsedContent = {
	data: Record<string, FrontmatterValue>;
	body: string;
};

export type AboutContent = {
	title: string;
	description: string;
	paragraphs: string[];
	interests: string[];
};

export type NowIntroContent = {
	title: string;
	description: string;
	paragraphs: string[];
};

function parseFrontmatter(source: string): ParsedContent {
	const normalized = String(source || '');
	const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

	if (!match) {
		return { data: {}, body: normalized.trim() };
	}

	const lines = match[1].split(/\r?\n/);
	const data: Record<string, FrontmatterValue> = {};
	let currentListKey: string | null = null;

	for (const rawLine of lines) {
		const line = rawLine.replace(/\t/g, '    ');
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('#')) continue;

		if (trimmed.startsWith('- ') && currentListKey) {
			const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
			const existing = Array.isArray(data[currentListKey]) ? data[currentListKey] : [];
			data[currentListKey] = [...existing, item];
			continue;
		}

		currentListKey = null;
		const colonIndex = line.indexOf(':');
		if (colonIndex === -1) continue;

		const key = line.slice(0, colonIndex).trim();
		let value = line.slice(colonIndex + 1).trim();

		if (!value) {
			data[key] = [];
			currentListKey = key;
			continue;
		}

		value = value.replace(/^["']|["']$/g, '');
		data[key] = value;
	}

	return {
		data,
		body: match[2].trim()
	};
}

function readContentFile(name: string) {
	return fs.readFileSync(path.join(CONTENT_ROOT, name), 'utf8');
}

function bodyToParagraphs(body: string) {
	return String(body || '')
		.split(/\r?\n\r?\n+/)
		.map((paragraph) => paragraph.replace(/\r?\n/g, ' ').trim())
		.filter(Boolean);
}

export function getAboutContent(): AboutContent {
	const parsed = parseFrontmatter(readContentFile('about.md'));

	return {
		title: String(parsed.data.title || 'About'),
		description: String(parsed.data.description || ''),
		paragraphs: bodyToParagraphs(parsed.body),
		interests: Array.isArray(parsed.data.interests) ? parsed.data.interests : []
	};
}

export function getNowIntroContent(): NowIntroContent {
	const parsed = parseFrontmatter(readContentFile('now.md'));

	return {
		title: String(parsed.data.title || 'Now'),
		description: String(parsed.data.description || ''),
		paragraphs: bodyToParagraphs(parsed.body)
	};
}
