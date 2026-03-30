#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const DEFAULT_BUCKET = 'afterword';
const DEFAULT_POSTS_JSON = 'your_instagram_activity/media/posts_1.json';
const TMP_ROOT = path.resolve('.tmp/instagram-earlier-web-import');
const MONTHS_PREFIX = 'earlier-web/months';
const IMAGES_PREFIX = 'earlier-web/images/instagram';
const ASSET_ROUTE_PREFIX = '/earlier-web-assets/';
const LIVE_BASE_URL = 'https://afterword.blog';

function parseArgs(argv) {
	const options = {
		source: process.env.INSTAGRAM_EARLIER_WEB_SOURCE || '',
		postsJson: '',
		bucket: process.env.EARLIER_WEB_BUCKET || DEFAULT_BUCKET,
		database: process.env.EARLIER_WEB_D1 || 'D1_DATABASE',
		remote: true,
		skipMonths: false,
		skipImages: false,
		skipVideos: false,
		skipSql: false,
		dryRun: false,
		startImageAt: '',
		retries: 3
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--source') {
			options.source = argv[index + 1] || '';
			index += 1;
		} else if (arg === '--posts-json') {
			options.postsJson = argv[index + 1] || '';
			index += 1;
		} else if (arg === '--bucket') {
			options.bucket = argv[index + 1] || DEFAULT_BUCKET;
			index += 1;
		} else if (arg === '--database') {
			options.database = argv[index + 1] || 'D1_DATABASE';
			index += 1;
		} else if (arg === '--local') {
			options.remote = false;
		} else if (arg === '--skip-months') {
			options.skipMonths = true;
		} else if (arg === '--skip-images') {
			options.skipImages = true;
		} else if (arg === '--skip-videos') {
			options.skipVideos = true;
		} else if (arg === '--skip-sql') {
			options.skipSql = true;
		} else if (arg === '--dry-run') {
			options.dryRun = true;
		} else if (arg === '--start-image-at') {
			options.startImageAt = argv[index + 1] || '';
			index += 1;
		} else if (arg === '--retries') {
			options.retries = Math.max(1, Number.parseInt(argv[index + 1] || '3', 10) || 3);
			index += 1;
		}
	}

	return options;
}

function slugify(value) {
	return String(value || '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 72);
}

function stripMarkdown(value) {
	return String(value || '')
		.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function summarizeText(text, maxLength) {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function singleLineSummary(text, maxLength = 140) {
	return summarizeText(String(text || '').replace(/\s+/g, ' ').trim(), maxLength);
}

function sqlQuote(value) {
	return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function toMonthKey(year, month) {
	return `${MONTHS_PREFIX}/${year}/${String(month).padStart(2, '0')}.json`;
}

function mimeTypeForFile(filePath) {
	const ext = path.extname(filePath).toLowerCase();

	switch (ext) {
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.png':
			return 'image/png';
		case '.gif':
			return 'image/gif';
		case '.webp':
			return 'image/webp';
		case '.avif':
			return 'image/avif';
		case '.mp4':
			return 'video/mp4';
		case '.mov':
			return 'video/quicktime';
		case '.webm':
			return 'video/webm';
		default:
			return 'application/octet-stream';
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeMojibake(value) {
	const text = String(value || '');

	if (!/[Ãâð][^\s]?/.test(text) && !text.includes('â') && !text.includes('ð')) {
		return text;
	}

	try {
		const decoded = Buffer.from(text, 'latin1').toString('utf8');
		const replacementCount = (decoded.match(/\uFFFD/g) || []).length;

		if (!decoded.trim() || replacementCount > 3) {
			return text;
		}

		return decoded;
	} catch {
		return text;
	}
}

function normalizeCaption(value) {
	return decodeMojibake(String(value || '').replace(/\r\n/g, '\n')).trim();
}

function formatDatePart(date) {
	return [
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, '0'),
		String(date.getUTCDate()).padStart(2, '0')
	].join('-');
}

function buildStableSlug(caption, publishedAt, uniqueSeed) {
	const readable = slugify(caption) || `instagram-post-${formatDatePart(publishedAt)}`;
	const suffix = createHash('sha1').update(uniqueSeed).digest('hex').slice(0, 8);
	return `${readable}-${suffix}`;
}

function runCommand(command, args, { stdio = 'inherit' } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio
		});

		child.on('exit', (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
		});
	});
}

async function runCommandWithRetries(command, args, retries) {
	let attempt = 0;

	while (attempt < retries) {
		attempt += 1;

		try {
			await runCommand(command, args);
			return;
		} catch (error) {
			if (attempt >= retries) {
				throw error;
			}

			console.warn(
				`Command failed (attempt ${attempt} of ${retries}): ${command} ${args.join(' ')}`
			);
			await sleep(1000 * attempt);
		}
	}
}

async function fetchExistingMonthBundle(bundleKey) {
	const response = await fetch(`${LIVE_BASE_URL}${ASSET_ROUTE_PREFIX}${bundleKey}`);

	if (response.status === 404) {
		return {
			posts: []
		};
	}

	if (!response.ok) {
		throw new Error(`Failed to fetch existing month bundle ${bundleKey}: ${response.status}`);
	}

	return response.json();
}

async function readInstagramPosts(sourceRoot, postsJsonOverride) {
	const postsJsonPath = postsJsonOverride
		? path.resolve(postsJsonOverride)
		: path.join(sourceRoot, DEFAULT_POSTS_JSON);
	const raw = await readFile(postsJsonPath, 'utf8');
	const parsed = JSON.parse(raw);

	if (!Array.isArray(parsed)) {
		throw new Error(`Expected Instagram posts JSON array in ${postsJsonPath}`);
	}

	return {
		postsJsonPath,
		posts: parsed
	};
}

async function buildArchive(sourceRoot, postsJsonOverride, options) {
	const { postsJsonPath, posts } = await readInstagramPosts(sourceRoot, postsJsonOverride);
	const relativePostsJsonPath = path.relative(sourceRoot, postsJsonPath).replace(/\\/g, '/');
	const entries = [];
	const imageUploads = new Map();
	const monthEntries = new Map();

	for (let index = 0; index < posts.length; index += 1) {
		const post = posts[index];
		const media = Array.isArray(post?.media) ? post.media.filter(Boolean) : [];

		if (!media.length) {
			continue;
		}

		const topLevelCaption = normalizeCaption(post?.title || '');
		const mediaCaptions = media.map((item) => normalizeCaption(item?.title || '')).filter(Boolean);
		const caption = topLevelCaption || mediaCaptions[0] || '';
		const timestampSeconds =
			Number(post?.creation_timestamp) ||
			media.map((item) => Number(item?.creation_timestamp) || 0).find(Boolean) ||
			0;

		if (!timestampSeconds) {
			continue;
		}

		const publishedAt = new Date(timestampSeconds * 1000);

		if (Number.isNaN(publishedAt.getTime())) {
			continue;
		}

		const year = publishedAt.getUTCFullYear();
		const month = publishedAt.getUTCMonth() + 1;
		const uniqueSeed = `${relativePostsJsonPath}#${index}`;
		const slug = buildStableSlug(caption, publishedAt, uniqueSeed);
		const pathSlug = `/earlier-web/${year}/${String(month).padStart(2, '0')}/${slug}`;
		const sourcePath = `${relativePostsJsonPath}#${index}`;
		const bundleKey = toMonthKey(year, month);

		const bodyParts = [];

		if (caption) {
			bodyParts.push(caption);
		}

		const assetUrls = [];

		for (let mediaIndex = 0; mediaIndex < media.length; mediaIndex += 1) {
			const mediaItem = media[mediaIndex];
			const uri = String(mediaItem?.uri || '').trim();

			if (!uri) {
				continue;
			}

			const ext = path.extname(uri).toLowerCase();
			const isVideo = ext === '.mp4' || ext === '.mov' || ext === '.webm';

			if (options.skipVideos && isVideo) {
				continue;
			}

			const sourceMediaPath = path.join(sourceRoot, uri);

			if (!existsSync(sourceMediaPath)) {
				continue;
			}

			const objectKey = `${IMAGES_PREFIX}/${uri.replace(/^media\/posts\//, '').replace(/\\/g, '/')}`;
			imageUploads.set(sourceMediaPath, objectKey);

			const assetUrl = `${ASSET_ROUTE_PREFIX}${objectKey}`;
			assetUrls.push(assetUrl);

			const mediaCaption = normalizeCaption(mediaItem?.title || '');
			const alt =
				singleLineSummary(mediaCaption || caption, 160) ||
				`Instagram ${isVideo ? 'video' : 'photo'}`;

			if (isVideo) {
				bodyParts.push(`[Video ${mediaIndex + 1}](${assetUrl})`);
			} else {
				bodyParts.push(`![${alt}](${assetUrl})`);
			}
		}

		const bodyMarkdown = bodyParts.join('\n\n').trim();
		const plainText = stripMarkdown(bodyMarkdown);

		if (!bodyMarkdown) {
			continue;
		}
		const excerpt = plainText ? summarizeText(plainText, 220) : '';

		entries.push({
			id: `instagram-${createHash('sha1').update(uniqueSeed).digest('hex').slice(0, 16)}`,
			slug,
			year,
			month,
			title: caption || 'Instagram post',
			excerpt,
			bodyText: plainText,
			path: pathSlug,
			bundleKey,
			coverImage: assetUrls.find((url) => /\.(?:jpe?g|png|gif|webp|avif)$/i.test(url)) || null,
			hasImages: assetUrls.some((url) => /\.(?:jpe?g|png|gif|webp|avif)$/i.test(url)),
			publishedAt: publishedAt.toISOString(),
			sourcePath,
			bodyMarkdown
		});

		const bundleEntries = monthEntries.get(bundleKey) || [];
		bundleEntries.push({
			id: `instagram-${createHash('sha1').update(uniqueSeed).digest('hex').slice(0, 16)}`,
			slug,
			title: caption || 'Instagram post',
			excerpt,
			bodyMarkdown,
			coverImage: assetUrls.find((url) => /\.(?:jpe?g|png|gif|webp|avif)$/i.test(url)) || null,
			publishedAt: publishedAt.toISOString(),
			sourcePath
		});
		monthEntries.set(bundleKey, bundleEntries);
	}

	return {
		postsJsonPath,
		entries: entries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
		imageUploads,
		monthEntries
	};
}

async function writeMergedMonthBundles(monthEntries) {
	for (const [bundleKey, newPosts] of monthEntries.entries()) {
		const existingBundle = await fetchExistingMonthBundle(bundleKey);
		const existingPosts = Array.isArray(existingBundle?.posts) ? existingBundle.posts : [];
		const postsBySourcePath = new Map();

		for (const post of existingPosts) {
			postsBySourcePath.set(post.sourcePath, post);
		}

		for (const post of newPosts) {
			postsBySourcePath.set(post.sourcePath, post);
		}

		const mergedPosts = [...postsBySourcePath.values()].sort((a, b) =>
			String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
		);
		const [, , year, monthFile] = bundleKey.split('/');
		const targetPath = path.join(TMP_ROOT, bundleKey);

		await mkdir(path.dirname(targetPath), { recursive: true });
		await writeFile(
			targetPath,
			JSON.stringify(
				{
					year: Number.parseInt(year, 10),
					month: Number.parseInt(path.basename(monthFile, '.json'), 10),
					posts: mergedPosts
				},
				null,
				2
			)
		);
	}
}

async function writeSql(entries) {
	const sqlPath = path.join(TMP_ROOT, 'instagram-earlier-web-import.sql');
	const statements = [
		`CREATE TABLE IF NOT EXISTS earlier_web_posts (
			id TEXT PRIMARY KEY,
			slug TEXT NOT NULL,
			year INTEGER NOT NULL,
			month INTEGER NOT NULL,
			title TEXT NOT NULL,
			excerpt TEXT NOT NULL,
			body_text TEXT NOT NULL,
			path TEXT NOT NULL UNIQUE,
			bundle_key TEXT NOT NULL,
			cover_image TEXT,
			has_images INTEGER NOT NULL DEFAULT 0,
			published_at TEXT NOT NULL,
			source_path TEXT NOT NULL UNIQUE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_earlier_web_posts_year_month ON earlier_web_posts(year DESC, month DESC, published_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_earlier_web_posts_published_at ON earlier_web_posts(published_at DESC);`
	];

	for (let index = 0; index < entries.length; index += 25) {
		const batch = entries.slice(index, index + 25);
		const values = batch.map(
			(entry) =>
				`(${[
					sqlQuote(entry.id),
					sqlQuote(entry.slug),
					entry.year,
					entry.month,
					sqlQuote(entry.title),
					sqlQuote(entry.excerpt),
					sqlQuote(entry.bodyText),
					sqlQuote(entry.path),
					sqlQuote(entry.bundleKey),
					entry.coverImage ? sqlQuote(entry.coverImage) : 'NULL',
					entry.hasImages ? 1 : 0,
					sqlQuote(entry.publishedAt),
					sqlQuote(entry.sourcePath)
				].join(', ')})`
		);

		statements.push(
			`INSERT OR REPLACE INTO earlier_web_posts (
				id, slug, year, month, title, excerpt, body_text, path, bundle_key, cover_image, has_images, published_at, source_path
			) VALUES ${values.join(', ')};`
		);
	}

	await writeFile(sqlPath, statements.join('\n\n'));
	return sqlPath;
}

async function uploadMonthBundles(options, monthEntries) {
	for (const bundleKey of monthEntries.keys()) {
		const filePath = path.join(TMP_ROOT, bundleKey);
		await runCommandWithRetries(
			'npx',
			[
				'wrangler',
				'r2',
				'object',
				'put',
				`${options.bucket}/${bundleKey}`,
				options.remote ? '--remote' : '--local',
				'--file',
				filePath,
				'--content-type',
				'application/json; charset=utf-8'
			],
			options.retries
		);
	}
}

async function uploadImages(options, imageUploads) {
	let shouldUpload = !options.startImageAt;
	const failures = [];

	for (const [sourcePath, objectKey] of imageUploads.entries()) {
		if (!shouldUpload) {
			if (objectKey === options.startImageAt) {
				shouldUpload = true;
			} else {
				continue;
			}
		}

		try {
			await runCommandWithRetries(
				'npx',
				[
					'wrangler',
					'r2',
					'object',
					'put',
					`${options.bucket}/${objectKey}`,
					options.remote ? '--remote' : '--local',
					'--file',
					sourcePath,
					'--content-type',
					mimeTypeForFile(sourcePath)
				],
				options.retries
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push({ objectKey, sourcePath, message });
			console.error(`Skipping failed media upload for ${objectKey}`);
		}
	}

	if (failures.length) {
		const failuresPath = path.join(TMP_ROOT, 'image-upload-failures.json');
		await writeFile(failuresPath, JSON.stringify(failures, null, 2));
		console.warn(`Recorded ${failures.length} media upload failures in ${failuresPath}`);
	}
}

async function importSql(options, sqlPath) {
	await runCommand('npx', [
		'wrangler',
		'd1',
		'execute',
		options.database,
		options.remote ? '--remote' : '--local',
		'--file',
		sqlPath
	]);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (!options.source) {
		throw new Error('Pass --source "/path/to/instagram-export" or set INSTAGRAM_EARLIER_WEB_SOURCE.');
	}

	await rm(TMP_ROOT, { recursive: true, force: true });
	await mkdir(TMP_ROOT, { recursive: true });

	const { postsJsonPath, entries, imageUploads, monthEntries } = await buildArchive(
		path.resolve(options.source),
		options.postsJson,
		options
	);

	await writeMergedMonthBundles(monthEntries);
	const sqlPath = await writeSql(entries);

	console.log(`Using Instagram posts export ${postsJsonPath}`);
	console.log(`Prepared ${entries.length} Instagram earlier-web posts.`);
	console.log(`Prepared ${monthEntries.size} merged month bundles.`);
	console.log(`Prepared ${imageUploads.size} Instagram media uploads.`);
	console.log(`Temporary import files written to ${TMP_ROOT}`);

	if (options.dryRun) {
		return;
	}

	if (!options.skipMonths) {
		await uploadMonthBundles(options, monthEntries);
	}

	if (!options.skipImages) {
		await uploadImages(options, imageUploads);
	}

	if (!options.skipSql) {
		await importSql(options, sqlPath);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
