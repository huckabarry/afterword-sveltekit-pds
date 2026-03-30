#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const DEFAULT_BUCKET = 'afterword';
const TMP_ROOT = path.resolve('.tmp/earlier-web-import');
const MONTHS_PREFIX = 'earlier-web/months';
const IMAGES_PREFIX = 'earlier-web/images';
const STATUS_IMAGES_PREFIX = '/assets/status-images/';

function parseArgs(argv) {
	const options = {
		source: process.env.EARLIER_WEB_SOURCE || '',
		bucket: process.env.EARLIER_WEB_BUCKET || DEFAULT_BUCKET,
		database: process.env.EARLIER_WEB_D1 || 'D1_DATABASE',
		remote: true,
		skipMonths: false,
		skipImages: false,
		dryRun: false,
		startImageAt: '',
		retries: 3
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--source') {
			options.source = argv[index + 1] || '';
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
		.slice(0, 90);
}

function stripFrontmatter(text) {
	if (!text.startsWith('---\n')) {
		return null;
	}

	const end = text.indexOf('\n---\n', 4);

	if (end === -1) {
		return null;
	}

	return {
		frontmatter: text.slice(4, end),
		body: text.slice(end + 5)
	};
}

function parseFrontmatter(text) {
	const values = {};
	let currentKey = null;

	for (const rawLine of text.split('\n')) {
		const line = rawLine.replace(/\r$/, '');

		if (!line.trim()) {
			continue;
		}

		if (line.startsWith('  - ') && currentKey === 'tags') {
			values.tags = values.tags || [];
			values.tags.push(line.slice(4).trim().replace(/^"|"$/g, ''));
			continue;
		}

		if (line.startsWith(' ')) {
			continue;
		}

		const separatorIndex = line.indexOf(':');

		if (separatorIndex === -1) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1).trim();
		currentKey = key;

		if (key === 'tags') {
			values.tags = [];
			continue;
		}

		values[key] = rawValue.replace(/^"|"$/g, '');
	}

	return values;
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

function deriveTitle(frontmatterTitle, bodyText, fallbackStem) {
	const title = String(frontmatterTitle || '').trim();

	if (title) {
		return title;
	}

	const firstSentence = bodyText
		.split(/\n+/)
		.map((line) => line.trim())
		.find(Boolean);

	if (firstSentence) {
		return summarizeText(firstSentence, 72);
	}

	return fallbackStem.replace(/-/g, ' ');
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
		default:
			return 'application/octet-stream';
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

async function buildArchive(sourceRoot) {
	const statusRoot = path.join(sourceRoot, 'status');
	const imagesRoot = path.join(sourceRoot, 'status-images');
	const entries = [];
	const imageUploads = new Map();
	const monthBundles = new Map();
	const usedPaths = new Set();
	const usedMonthSlugs = new Map();

	async function walk(directory) {
		const children = await import('node:fs/promises').then(({ readdir }) =>
			readdir(directory, { withFileTypes: true })
		);

		for (const child of children) {
			if (child.name.startsWith('.')) {
				continue;
			}

			const childPath = path.join(directory, child.name);

			if (child.isDirectory()) {
				await walk(childPath);
				continue;
			}

			if (!child.isFile() || !child.name.endsWith('.md') || child.name === '_template.md') {
				continue;
			}

			const relPath = path.relative(statusRoot, childPath);
			const [yearPart, monthPart, fileName] = relPath.split(path.sep);

			if (!yearPart || !monthPart || !fileName) {
				continue;
			}

			const year = Number.parseInt(yearPart, 10);
			const month = Number.parseInt(monthPart, 10);

			if (!Number.isInteger(year) || !Number.isInteger(month)) {
				continue;
			}

			const raw = await readFile(childPath, 'utf8');
			const parsed = stripFrontmatter(raw);

			if (!parsed) {
				continue;
			}

			const frontmatter = parseFrontmatter(parsed.frontmatter);
			let bodyMarkdown = parsed.body.trim();
			const plainBeforeImages = stripMarkdown(bodyMarkdown);

			if (!plainBeforeImages) {
				continue;
			}

			const monthSlugKey = `${year}-${month}`;
			const usedSlugsForMonth = usedMonthSlugs.get(monthSlugKey) || new Set();
			const fallbackStem = fileName.replace(/\.md$/i, '');
			const derivedTitle = deriveTitle(frontmatter.title, plainBeforeImages, fallbackStem);
			let slug = slugify(frontmatter.slug || derivedTitle || fallbackStem) || slugify(fallbackStem) || 'entry';
			let suffix = 2;

			while (usedSlugsForMonth.has(slug)) {
				slug = `${slugify(frontmatter.slug || derivedTitle || fallbackStem) || 'entry'}-${suffix}`;
				suffix += 1;
			}

			usedSlugsForMonth.add(slug);
			usedMonthSlugs.set(monthSlugKey, usedSlugsForMonth);

			bodyMarkdown = bodyMarkdown.replace(
				/!\[([^\]]*)\]\((\/assets\/status-images\/[^)]+)\)/g,
				(_, alt, rawImagePath) => {
					const relativeImagePath = rawImagePath.slice(STATUS_IMAGES_PREFIX.length);
					const sourceImagePath = path.join(imagesRoot, relativeImagePath);
					const objectKey = `${IMAGES_PREFIX}/${relativeImagePath.replace(/\\/g, '/')}`;

					if (existsSync(sourceImagePath)) {
						imageUploads.set(sourceImagePath, objectKey);
					}

					return `![${alt}](/earlier-web-assets/${objectKey})`;
				}
			);

			const plainText = stripMarkdown(bodyMarkdown);
			const excerpt = summarizeText(plainText, 220);
			const publishedAt = new Date(String(frontmatter.date || `${year}-${String(month).padStart(2, '0')}-01`));

			if (Number.isNaN(publishedAt.getTime())) {
				continue;
			}

			const pathSlug = `/earlier-web/${year}/${String(month).padStart(2, '0')}/${slug}`;

			if (usedPaths.has(pathSlug)) {
				continue;
			}

			usedPaths.add(pathSlug);

			const images = [...bodyMarkdown.matchAll(/!\[[^\]]*\]\((\/earlier-web-assets\/[^)]+)\)/g)].map(
				(match) => match[1]
			);
			const bundleKey = toMonthKey(year, month);
			const entry = {
				id: `${year}-${String(month).padStart(2, '0')}-${slug}`,
				slug,
				year,
				month,
				title: derivedTitle,
				excerpt,
				bodyText: plainText,
				path: pathSlug,
				bundleKey,
				coverImage: images[0] || null,
				hasImages: images.length > 0,
				publishedAt: publishedAt.toISOString(),
				sourcePath: relPath.replace(/\\/g, '/'),
				bodyMarkdown
			};

			entries.push(entry);

			const bundleEntries = monthBundles.get(bundleKey) || [];
			bundleEntries.push({
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
				excerpt: entry.excerpt,
				bodyMarkdown: entry.bodyMarkdown,
				coverImage: entry.coverImage,
				publishedAt: entry.publishedAt,
				sourcePath: entry.sourcePath
			});
			monthBundles.set(bundleKey, bundleEntries);
		}
	}

	await walk(statusRoot);

	return {
		entries: entries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
		imageUploads,
		monthBundles
	};
}

async function writeMonthBundles(monthBundles) {
	const writes = [];

	for (const [bundleKey, posts] of monthBundles.entries()) {
		const [, , year, monthFile] = bundleKey.split('/');
		const month = Number.parseInt(path.basename(monthFile, '.json'), 10);
		const targetPath = path.join(TMP_ROOT, bundleKey);

		await mkdir(path.dirname(targetPath), { recursive: true });
		writes.push(
			writeFile(
				targetPath,
				JSON.stringify(
					{
						year: Number.parseInt(year, 10),
						month,
						posts: posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
					},
					null,
					2
				)
			)
		);
	}

	await Promise.all(writes);
}

async function writeSql(entries) {
	const sqlPath = path.join(TMP_ROOT, 'earlier-web-import.sql');
	const statements = [
		`DROP TABLE IF EXISTS earlier_web_posts;`,
		`CREATE TABLE earlier_web_posts (
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
		`CREATE INDEX idx_earlier_web_posts_year_month ON earlier_web_posts(year DESC, month DESC, published_at DESC);`,
		`CREATE INDEX idx_earlier_web_posts_published_at ON earlier_web_posts(published_at DESC);`
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
			`INSERT INTO earlier_web_posts (
				id, slug, year, month, title, excerpt, body_text, path, bundle_key, cover_image, has_images, published_at, source_path
			) VALUES ${values.join(', ')};`
		);
	}

	await writeFile(sqlPath, statements.join('\n\n'));
	return sqlPath;
}

async function uploadMonthBundles(options, monthBundles) {
	for (const bundleKey of monthBundles.keys()) {
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
			console.error(`Skipping failed image upload for ${objectKey}`);
		}
	}

	if (failures.length) {
		const failuresPath = path.join(TMP_ROOT, 'image-upload-failures.json');
		await writeFile(failuresPath, JSON.stringify(failures, null, 2));
		console.warn(`Recorded ${failures.length} image upload failures in ${failuresPath}`);
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
		throw new Error('Pass --source "/path/to/Status Backup" or set EARLIER_WEB_SOURCE.');
	}

	await rm(TMP_ROOT, { recursive: true, force: true });
	await mkdir(TMP_ROOT, { recursive: true });

	const { entries, imageUploads, monthBundles } = await buildArchive(options.source);
	await writeMonthBundles(monthBundles);
	const sqlPath = await writeSql(entries);

	console.log(`Prepared ${entries.length} earlier-web posts.`);
	console.log(`Prepared ${monthBundles.size} month bundles.`);
	console.log(`Prepared ${imageUploads.size} archive images.`);
	console.log(`Temporary import files written to ${TMP_ROOT}`);

	if (options.dryRun) {
		return;
	}

	if (!options.skipMonths) {
		await uploadMonthBundles(options, monthBundles);
	}

	if (!options.skipImages) {
		await uploadImages(options, imageUploads);
	}

	await importSql(options, sqlPath);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
