#!/usr/bin/env node

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const DEFAULT_BUCKET = 'afterword';
const TMP_ROOT = path.resolve('.tmp/dedupe-earlier-web-instagram');
const LIVE_BASE_URL = 'https://afterword.blog';

function parseArgs(argv) {
	const options = {
		bucket: process.env.EARLIER_WEB_BUCKET || DEFAULT_BUCKET,
		database: process.env.EARLIER_WEB_D1 || 'D1_DATABASE',
		remote: true,
		dryRun: false
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--bucket') {
			options.bucket = argv[index + 1] || DEFAULT_BUCKET;
			index += 1;
		} else if (arg === '--database') {
			options.database = argv[index + 1] || 'D1_DATABASE';
			index += 1;
		} else if (arg === '--local') {
			options.remote = false;
		} else if (arg === '--dry-run') {
			options.dryRun = true;
		}
	}

	return options;
}

function sqlQuote(value) {
	return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function runCommand(command, args, { stdio = 'inherit' } = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio });

		let stdout = '';
		let stderr = '';

		if (stdio === 'pipe') {
			child.stdout?.on('data', (chunk) => {
				stdout += String(chunk);
			});

			child.stderr?.on('data', (chunk) => {
				stderr += String(chunk);
			});
		}

		child.on('exit', (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}

			reject(new Error(`${command} ${args.join(' ')} exited with code ${code}\n${stderr}`));
		});
	});
}

async function runJsonCommand(command, args) {
	const { stdout } = await runCommand(command, args, { stdio: 'pipe' });
	return JSON.parse(stdout);
}

async function fetchDuplicateRows(options) {
	const sql = `
		WITH duplicate_groups AS (
			SELECT
				substr(published_at, 1, 10) AS day,
				lower(trim(body_text)) AS normalized_body
			FROM earlier_web_posts
			GROUP BY day, normalized_body
			HAVING COUNT(*) > 1
				AND SUM(CASE WHEN source_path LIKE 'your_instagram_activity/%' THEN 1 ELSE 0 END) > 0
				AND SUM(CASE WHEN source_path NOT LIKE 'your_instagram_activity/%' THEN 1 ELSE 0 END) > 0
		)
		SELECT
			p.id,
			p.bundle_key,
			p.source_path,
			p.path,
			p.published_at
		FROM earlier_web_posts p
		JOIN duplicate_groups g
			ON substr(p.published_at, 1, 10) = g.day
			AND lower(trim(p.body_text)) = g.normalized_body
		WHERE p.source_path LIKE 'your_instagram_activity/%'
		ORDER BY p.published_at DESC, p.id DESC;
	`;

	const result = await runJsonCommand('npx', [
		'wrangler',
		'd1',
		'execute',
		options.database,
		options.remote ? '--remote' : '--local',
		'--json',
		'--command',
		sql
	]);

	return Array.isArray(result?.[0]?.results) ? result[0].results : [];
}

async function fetchBundle(bundleKey) {
	const response = await fetch(`${LIVE_BASE_URL}/earlier-web-assets/${bundleKey}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch bundle ${bundleKey}: ${response.status}`);
	}

	return response.json();
}

async function writeUpdatedBundles(duplicateRows) {
	const idsByBundle = new Map();

	for (const row of duplicateRows) {
		const list = idsByBundle.get(row.bundle_key) || [];
		list.push(row.id);
		idsByBundle.set(row.bundle_key, list);
	}

	for (const [bundleKey, ids] of idsByBundle.entries()) {
		const bundle = await fetchBundle(bundleKey);
		const dedupedPosts = (bundle.posts || []).filter((post) => !ids.includes(post.id));
		const targetPath = path.join(TMP_ROOT, bundleKey);

		await mkdir(path.dirname(targetPath), { recursive: true });
		await writeFile(
			targetPath,
			JSON.stringify(
				{
					year: bundle.year,
					month: bundle.month,
					posts: dedupedPosts
				},
				null,
				2
			)
		);
	}

	return idsByBundle;
}

async function uploadBundles(options, idsByBundle) {
	for (const bundleKey of idsByBundle.keys()) {
		const filePath = path.join(TMP_ROOT, bundleKey);
		await runCommand('npx', [
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
		]);
	}
}

async function writeDeleteSql(duplicateRows) {
	const sqlPath = path.join(TMP_ROOT, 'dedupe-earlier-web-instagram.sql');
	const ids = duplicateRows.map((row) => row.id);
	const statements = [];

	for (let index = 0; index < ids.length; index += 50) {
		const batch = ids.slice(index, index + 50);
		statements.push(
			`DELETE FROM earlier_web_posts WHERE id IN (${batch.map(sqlQuote).join(', ')});`
		);
	}

	await writeFile(sqlPath, statements.join('\n\n'));
	return sqlPath;
}

async function applyDeleteSql(options, sqlPath) {
	await runCommand('npx', [
		'wrangler',
		'd1',
		'execute',
		options.database,
		options.remote ? '--remote' : '--local',
		'--file',
		sqlPath,
		'-y'
	]);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	await rm(TMP_ROOT, { recursive: true, force: true });
	await mkdir(TMP_ROOT, { recursive: true });

	const duplicateRows = await fetchDuplicateRows(options);

	console.log(`Found ${duplicateRows.length} Instagram duplicates to remove.`);

	if (!duplicateRows.length || options.dryRun) {
		return;
	}

	const idsByBundle = await writeUpdatedBundles(duplicateRows);
	await uploadBundles(options, idsByBundle);
	const sqlPath = await writeDeleteSql(duplicateRows);
	await applyDeleteSql(options, sqlPath);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
