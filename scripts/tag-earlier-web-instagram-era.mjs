import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const databaseName = process.argv[2] || 'd1-database';
const remoteFlag = process.argv.includes('--local') ? '--local' : '--remote';

const statements = [
	`ALTER TABLE earlier_web_posts ADD COLUMN source_type TEXT;`,
	`ALTER TABLE earlier_web_posts ADD COLUMN source_confidence TEXT;`,
	`UPDATE earlier_web_posts
	 SET source_type = 'instagram',
		 source_confidence = 'explicit'
	 WHERE source_path LIKE 'your_instagram_activity/%';`,
	`UPDATE earlier_web_posts
	 SET source_type = 'instagram',
		 source_confidence = 'inferred-era'
	 WHERE source_type IS NULL
	   AND year BETWEEN 2012 AND 2022
	   AND has_images = 1;`
];

async function runStatement(sql) {
	try {
		const { stdout, stderr } = await execFileAsync(
			'npx',
			['wrangler', 'd1', 'execute', databaseName, remoteFlag, '--command', sql],
			{
				maxBuffer: 1024 * 1024 * 8
			}
		);

		if (stdout.trim()) {
			process.stdout.write(`${stdout.trim()}\n`);
		}

		if (stderr.trim()) {
			process.stderr.write(`${stderr.trim()}\n`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		if (/duplicate column name/i.test(message)) {
			process.stdout.write(`[skip] ${sql.split('\n')[0]}\n`);
			return;
		}

		throw error;
	}
}

for (const statement of statements) {
	await runStatement(statement);
}
