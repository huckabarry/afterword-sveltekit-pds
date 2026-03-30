#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

function decodeMojibake(value) {
	const text = String(value || '');

	if (!/[Ãâð][^\s]?/.test(text) && !text.includes('â') && !text.includes('ð')) {
		return text;
	}

	try {
		return Buffer.from(text, 'latin1').toString('utf8');
	} catch {
		return text;
	}
}

function normalizeCaption(value) {
	return decodeMojibake(String(value || '').replace(/\r\n/g, '\n')).trim();
}

async function main() {
	const source = process.argv[2];

	if (!source) {
		throw new Error('Pass the Instagram export root path.');
	}

	const postsPath = path.join(source, 'your_instagram_activity/media/posts_1.json');
	const raw = await readFile(postsPath, 'utf8');
	const posts = JSON.parse(raw);
	const report = {
		postCount: 0,
		mediaCount: 0,
		videoCount: 0,
		emptyCaptionCount: 0,
		firstPublishedAt: null,
		lastPublishedAt: null
	};

	for (const post of posts) {
		const media = Array.isArray(post?.media) ? post.media.filter(Boolean) : [];

		if (!media.length) {
			continue;
		}

		const caption =
			normalizeCaption(post?.title || '') ||
			media.map((item) => normalizeCaption(item?.title || '')).find(Boolean) ||
			'';
		const timestampSeconds =
			Number(post?.creation_timestamp) ||
			media.map((item) => Number(item?.creation_timestamp) || 0).find(Boolean) ||
			0;

		if (!timestampSeconds) {
			continue;
		}

		report.postCount += 1;
		report.mediaCount += media.length;
		report.videoCount += media.filter((item) => /\.(mp4|mov|webm)$/i.test(String(item?.uri || ''))).length;

		if (!caption) {
			report.emptyCaptionCount += 1;
		}

		const publishedAt = new Date(timestampSeconds * 1000).toISOString();

		if (!report.firstPublishedAt || publishedAt < report.firstPublishedAt) {
			report.firstPublishedAt = publishedAt;
		}

		if (!report.lastPublishedAt || publishedAt > report.lastPublishedAt) {
			report.lastPublishedAt = publishedAt;
		}
	}

	console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
