import type { RequestEvent } from '@sveltejs/kit';
import { updateMusicCacheStatus } from '$lib/server/music-cache-status';
import { attachAlbumCoverDelivery, attachTrackCoverDelivery } from '$lib/server/music-cover-delivery';
import { getMusicSnapshotFromR2, writeMusicSnapshotToR2 } from '$lib/server/music-r2';
import { getPdsAlbums, getPdsTracks } from '$lib/server/pds-music';

const ALBUMWHALE_LIST_URL = 'https://albumwhale.com/bryan/listening-now';
const ALBUMWHALE_FEED_URL = 'https://albumwhale.com/bryan/listening-now.atom';
const CRUCIAL_TRACKS_FEED_URL = 'https://www.crucialtracks.org/profile/bryan/feed.json';
const REMOTE_MUSIC_CACHE_TTL_MS = 1000 * 60 * 10;
const albumArchiveFiles = import.meta.glob('/archive/albumwhale/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;
const trackArchiveFiles = import.meta.glob('/archive/crucial-tracks/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

type Frontmatter = Record<string, string | boolean | number | null>;

export type ListenLink = {
	label: string;
	url: string;
};

export type AlbumEntry = {
	id: string;
	slug: string;
	title: string;
	albumTitle: string;
	artist: string;
	note: string;
	noteHtml?: string | null;
	excerpt: string;
	coverImage: string | null;
	publishedAt: Date;
	displayDate: string;
	sourceUrl: string;
	localPath: string;
	listenLinks: ListenLink[];
	archivePath?: string | null;
};

export type TrackEntry = {
	id: string;
	slug: string;
	title: string;
	trackTitle: string;
	artist: string;
	note: string;
	noteHtml?: string | null;
	excerpt: string;
	artworkUrl: string | null;
	publishedAt: Date;
	displayDate: string;
	sourceUrl: string;
	localPath: string;
	appleMusicUrl: string | null;
	playlistUrl: string | null;
	songlinkUrl: string | null;
	previewUrl: string | null;
	listenLinks: ListenLink[];
	archivePath?: string | null;
};

type CrucialTrackFeedDetails = {
	artworkUrl: string | null;
	appleMusicUrl: string | null;
	songlinkUrl: string | null;
	previewUrl: string | null;
	noteHtml: string | null;
};

type CrucialTrackFeedIndex = {
	items: TrackEntry[];
	bySourceUrl: Map<string, CrucialTrackFeedDetails>;
	byAppleMusicUrl: Map<string, CrucialTrackFeedDetails>;
	byTrackKey: Map<string, CrucialTrackFeedDetails>;
};

export type MusicReadContext = Pick<RequestEvent, 'platform' | 'url'> | null | undefined;

let albumWhalePageMapPromise: Promise<Map<string, string>> | null = null;
let albumWhaleLinksPromise: Promise<Map<string, ListenLink[]>> | null = null;
let crucialTracksDetailsPromise: Promise<CrucialTrackFeedIndex> | null = null;
let crucialTracksDetailsExpiresAt = 0;
let musicArchiveDigest: string | null = null;
let musicSnapshotWritePromise:
	| Promise<{ tracks: TrackEntry[]; albums: AlbumEntry[] }>
	| null = null;
let musicSnapshotWriteDigest: string | null = null;

function walkMarkdownFiles(root: string): string[] {
	const files = root === 'albumwhale' ? albumArchiveFiles : trackArchiveFiles;
	const preferredByRelativePath = new Map<string, string>();

	for (const absolutePath of Object.keys(files)) {
		const relativePath = absolutePath.replace(/^\/data\/archive\//, '').replace(/^\/archive\//, '');
		const existing = preferredByRelativePath.get(relativePath);

		if (!existing || absolutePath.startsWith('/archive/')) {
			preferredByRelativePath.set(relativePath, absolutePath);
		}
	}

	return [...preferredByRelativePath.values()].sort();
}

function parseFrontmatter(source: string): { data: Frontmatter; content: string } {
	const normalized = String(source || '');
	const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

	if (!match) {
		return { data: {}, content: normalized };
	}

	const data: Frontmatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex === -1) continue;
		const key = trimmed.slice(0, colonIndex).trim();
		let value = trimmed.slice(colonIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (value === 'true') data[key] = true;
		else if (value === 'false') data[key] = false;
		else if (/^-?\d+(\.\d+)?$/.test(value)) data[key] = Number(value);
		else if (value === 'null') data[key] = null;
		else data[key] = decodeHtmlEntities(value);
	}

	return { data, content: match[2].trim() };
}

function slugify(value: string): string {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/['".,!?()[\]{}:;]+/g, '')
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'item'
	);
}

function splitTitleAndArtist(value: string): { title: string; artist: string } {
	const normalized = decodeHtmlEntities(String(value || ''));
	const match = normalized.match(/^["*“”\s]*([^*"]+?)["*“”\s]+by\s+(.+)$/i);
	if (match) {
		return {
			title: match[1].trim(),
			artist: match[2].trim()
		};
	}

	const parts = normalized.split(/\s+by\s+/i);
	if (parts.length >= 2) {
		const artist = parts.pop() || '';
		return {
			title: parts.join(' by ').trim(),
			artist: artist.trim()
		};
	}

	return {
		title: normalized.trim() || 'Untitled',
		artist: ''
	};
}

function normalizeTrackKey(title: string, artist: string): string {
	return `${slugify(title)}::${slugify(artist)}`;
}

function getTrackDedupKey(track: {
	localPath?: string | null;
	trackTitle?: string | null;
	artist?: string | null;
	publishedAt?: Date | string | null;
}) {
	const localPath = String(track.localPath || '').trim();

	if (localPath) {
		return localPath;
	}

	const publishedAt =
		track.publishedAt instanceof Date
			? track.publishedAt.toISOString()
			: new Date(String(track.publishedAt || '')).toISOString();

	return `${normalizeTrackKey(String(track.trackTitle || ''), String(track.artist || ''))}::${publishedAt}`;
}

function getAlbumDedupKey(album: {
	localPath?: string | null;
	sourceUrl?: string | null;
	slug?: string | null;
}) {
	const sourceUrl = String(album.sourceUrl || '').trim();

	if (sourceUrl) {
		return sourceUrl;
	}

	const localPath = String(album.localPath || '').trim();
	if (localPath) {
		return localPath;
	}

	return String(album.slug || '').trim();
}

function mergeMusicEntries<T extends { publishedAt: Date }>(
	preferred: T[],
	fallback: T[],
	getKey: (item: T) => string
) {
	const seen = new Set(preferred.map((item) => getKey(item)).filter(Boolean));
	return [...preferred, ...fallback.filter((item) => !seen.has(getKey(item)))].sort(
		(a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
	);
}

function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (const character of String(value || '')) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(36);
}

export function getMusicArchiveDigest() {
	if (musicArchiveDigest) {
		return musicArchiveDigest;
	}

	const parts = [
		...Object.entries(albumArchiveFiles).map(([path, content]) => `album:${path}:${content}`),
		...Object.entries(trackArchiveFiles).map(([path, content]) => `track:${path}:${content}`)
	].sort();

	musicArchiveDigest = hashString(parts.join('\n---\n'));
	return musicArchiveDigest;
}

async function ensureMusicSnapshotInR2(context: MusicReadContext, archiveDigest: string) {
	if (!context?.platform?.env?.R2_BUCKET) {
		return null;
	}

	if (musicSnapshotWritePromise && musicSnapshotWriteDigest === archiveDigest) {
		return musicSnapshotWritePromise;
	}

	musicSnapshotWriteDigest = archiveDigest;
	musicSnapshotWritePromise = (async () => {
		const attemptedAt = new Date().toISOString();
		await updateMusicCacheStatus(context, {
			lastAttemptedAt: attemptedAt,
			lastStatus: 'idle',
			lastError: null,
			archiveDigest
		});

		const [tracks, albums] = await Promise.all([getLegacyTracks(), getLegacyAlbums()]);

		await writeMusicSnapshotToR2(context, {
			tracks,
			albums,
			archiveDigest
		});

		await updateMusicCacheStatus(context, {
			lastAttemptedAt: attemptedAt,
			lastRefreshedAt: new Date().toISOString(),
			lastStatus: 'success',
			lastError: null,
			lastSource: 'r2',
			archiveDigest
		});

		return { tracks, albums };
	})();

	try {
		return await musicSnapshotWritePromise;
	} catch (error) {
		await updateMusicCacheStatus(context, {
			lastAttemptedAt: new Date().toISOString(),
			lastStatus: 'error',
			lastError: error instanceof Error ? error.message : 'Unknown music snapshot refresh error.',
			lastSource: 'archive',
			archiveDigest
		});
		throw error;
	} finally {
		if (musicSnapshotWriteDigest === archiveDigest) {
			musicSnapshotWritePromise = null;
			musicSnapshotWriteDigest = null;
		}
	}
}

function formatDisplayDate(date: Date): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

function formatPacificArchiveTimestamp(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'America/Los_Angeles',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).formatToParts(date);

	const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '';
	return `${lookup('day')}-${lookup('month')}-${lookup('year')} ${lookup('hour')}:${lookup('minute')}`;
}

function decodeHtmlEntities(value: string): string {
	return String(value || '').replace(
		/&(#x?[0-9a-f]+|amp|apos|gt|lt|nbsp|quot);/gi,
		(entity, body: string) => {
			const normalized = String(body || '').toLowerCase();

			switch (normalized) {
				case 'amp':
					return '&';
				case 'apos':
					return "'";
				case 'gt':
					return '>';
				case 'lt':
					return '<';
				case 'nbsp':
					return ' ';
				case 'quot':
					return '"';
			}

			if (normalized.startsWith('#x')) {
				const codePoint = Number.parseInt(normalized.slice(2), 16);
				return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
			}

			if (normalized.startsWith('#')) {
				const codePoint = Number.parseInt(normalized.slice(1), 10);
				return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
			}

			return entity;
		}
	);
}

function stripHtml(value: string): string {
	return decodeHtmlEntities(
		String(value || '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

function absolutizeUrl(value: string, base: string): string {
	try {
		return new URL(String(value || ''), base).toString();
	} catch {
		return String(value || '').trim();
	}
}

function extractMarkdownLink(value: string, labelPattern?: RegExp): string | null {
	const matches = [...String(value || '').matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
	for (const match of matches) {
		if (!labelPattern || labelPattern.test(match[1])) {
			return match[2];
		}
	}
	return null;
}

function extractAlbumBody(body: string) {
	const linkedImageMatch = body.match(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/);
	const imageMatch = linkedImageMatch || body.match(/!\[([^\]]*)\]\(([^)]+)\)/);
	const note = body
		.replace(/\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)/g, '')
		.replace(/!\[[^\]]*\]\(([^)]+)\)/g, '')
		.replace(/\[[^\]]+\]\(([^)]+)\)/g, '')
		.replace(/<div>([\s\S]*?)<\/div>/gi, '$1')
		.replace(/\s+/g, ' ')
		.trim();

	return {
		coverImage: linkedImageMatch ? linkedImageMatch[2] : imageMatch?.[2] || null,
		note,
		noteHtml: null as string | null
	};
}

function extractTrackBody(body: string) {
	const lines = body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const titleLine = lines[0] || '';
	const { title, artist } = splitTitleAndArtist(titleLine.replace(/^\*+|\*+$/g, ''));
	const appleMusicUrl = extractMarkdownLink(body, /apple music/i);
	const playlistUrl = extractMarkdownLink(body, /playlist/i);
	const noteMatch = body.match(/<div>([\s\S]*?)<\/div>/i);
	const note = stripHtml(noteMatch?.[1] || '');
	const noteHtml = noteMatch?.[1]?.trim() || null;

	return {
		trackTitle: title,
		artist,
		appleMusicUrl,
		playlistUrl,
		note,
		noteHtml
	};
}

function extractTrackNoteHtmlFromContentHtml(value: string) {
	const noteMatch = String(value || '').match(/<div>([\s\S]*?)<\/div>/i);
	return noteMatch?.[1]?.trim() || null;
}

function extractAlbumFeedBody(contentHtml: string) {
	const decoded = decodeHtmlEntities(String(contentHtml || ''));
	const imageMatch = decoded.match(/<img\b[^>]*src="([^"]+)"[^>]*>/i);
	const noteMatches = [...decoded.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
	const noteHtml = noteMatches
		.map((match) => String(match[1] || '').trim())
		.filter(Boolean)
		.join('\n')
		.trim();
	const note = stripHtml(noteHtml);

	return {
		coverImage: imageMatch?.[1] || null,
		note,
		noteHtml: noteHtml || null
	};
}

function createTrackSlugFromPublishedAt(date: Date, trackTitle: string, artist: string) {
	return `${slugify(formatPacificArchiveTimestamp(date))}-${slugify(`${trackTitle}-${artist}`)}`;
}

function getAlbumIdFromOriginalUrl(url: string): string | null {
	const fragment = String(url || '').split('#')[1] || '';
	return fragment.startsWith('album_') ? fragment : null;
}

async function getAlbumWhalePageMap(): Promise<Map<string, string>> {
	if (!albumWhalePageMapPromise) {
		albumWhalePageMapPromise = (async () => {
			try {
				const response = await fetch(ALBUMWHALE_LIST_URL, {
					headers: {
						'User-Agent': 'afterword-sveltekit-pds music sync'
					}
				});

				if (!response.ok) {
					return new Map<string, string>();
				}

				const html = await response.text();
				const items = [
					...html.matchAll(/<li id="(album_\d+)"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>/gi)
				];
				return new Map(
					items.map((match) => [match[1], new URL(match[2], ALBUMWHALE_LIST_URL).toString()])
				);
			} catch {
				return new Map<string, string>();
			}
		})();
	}

	return albumWhalePageMapPromise;
}

function extractListenLinksFromAlbumPage(pageHtml: string, pageUrl: string): ListenLink[] {
	const sectionMatch = String(pageHtml || '').match(
		/<div class="streaming-list">([\s\S]*?)<\/div>\s*<div class="album-lists">/i
	);

	if (!sectionMatch) {
		return [];
	}

	const seen = new Set<string>();
	const links = [
		...sectionMatch[1].matchAll(/<li>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)
	];

	return links
		.map((match) => ({
			url: new URL(match[1], pageUrl).toString(),
			label: stripHtml(match[2]).replace(/\s+/g, ' ').trim()
		}))
		.filter((link) => link.url && link.label)
		.filter((link) => {
			const key = `${link.label}::${link.url}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

async function getAlbumWhaleListenLinks(): Promise<Map<string, ListenLink[]>> {
	if (!albumWhaleLinksPromise) {
		albumWhaleLinksPromise = (async () => {
			const pageMap = await getAlbumWhalePageMap();
			const entries = [...pageMap.entries()];
			const resolved = await Promise.all(
				entries.map(async ([albumId, pageUrl]) => {
					try {
						const response = await fetch(pageUrl, {
							headers: {
								'User-Agent': 'afterword-sveltekit-pds music sync'
							}
						});

						if (!response.ok) {
							return [albumId, [] as ListenLink[]] as const;
						}

						const html = await response.text();
						return [albumId, extractListenLinksFromAlbumPage(html, pageUrl)] as const;
					} catch {
						return [albumId, [] as ListenLink[]] as const;
					}
				})
			);

			return new Map<string, ListenLink[]>(resolved);
		})();
	}

	return albumWhaleLinksPromise;
}

export async function getArchiveAlbums({
	includeListenLinks = true
}: {
	includeListenLinks?: boolean;
} = {}): Promise<AlbumEntry[]> {
	const listenLinksByAlbumId = includeListenLinks
		? await getAlbumWhaleListenLinks()
		: new Map<string, ListenLink[]>();

	return walkMarkdownFiles('albumwhale')
		.map((filePath) => {
			const raw = albumArchiveFiles[filePath] || '';
			const { data, content } = parseFrontmatter(raw);
			const { title, artist } = splitTitleAndArtist(String(data.title || 'Untitled'));
			const publishedAt = new Date(String(data.published || Date.now()));
			const albumId = getAlbumIdFromOriginalUrl(String(data.original_url || '')) || slugify(title);
			const slug = albumId;
			const body = extractAlbumBody(content);

			return {
				id: albumId,
				slug,
				title: String(data.title || title),
				albumTitle: title,
				artist,
				note: body.note,
				noteHtml: body.noteHtml,
				excerpt: body.note,
				coverImage: body.coverImage,
				publishedAt,
				displayDate: formatDisplayDate(publishedAt),
				sourceUrl: String(data.original_url || ''),
				localPath: `/music/${slug}`,
				listenLinks: listenLinksByAlbumId.get(albumId) || [],
				archivePath: filePath
			} satisfies AlbumEntry;
		})
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

async function getCrucialTrackDetails(): Promise<CrucialTrackFeedIndex> {
	if (crucialTracksDetailsPromise && crucialTracksDetailsExpiresAt > Date.now()) {
		return crucialTracksDetailsPromise;
	}

	if (!crucialTracksDetailsPromise || crucialTracksDetailsExpiresAt <= Date.now()) {
		crucialTracksDetailsPromise = (async () => {
			try {
				const response = await fetch(CRUCIAL_TRACKS_FEED_URL, {
					headers: {
						'User-Agent': 'afterword-sveltekit-pds music sync'
					}
				});

				if (!response.ok) {
					return {
						items: [],
						bySourceUrl: new Map<string, CrucialTrackFeedDetails>(),
						byAppleMusicUrl: new Map<string, CrucialTrackFeedDetails>(),
						byTrackKey: new Map<string, CrucialTrackFeedDetails>()
					} satisfies CrucialTrackFeedIndex;
				}

				const data = (await response.json()) as {
					items?: Array<{
						url?: string;
						_song_details?: {
							artist?: string;
							song?: string;
							content?: string;
							artwork_url?: string;
							apple_music_url?: string;
							songlink_url?: string;
							preview_url?: string;
						};
						content_text?: string;
						content_html?: string;
						date_published?: string;
						id?: string;
						title?: string;
					}>;
				};

				const items: TrackEntry[] = [];
				const bySourceUrl = new Map<string, CrucialTrackFeedDetails>();
				const byAppleMusicUrl = new Map<string, CrucialTrackFeedDetails>();
				const byTrackKey = new Map<string, CrucialTrackFeedDetails>();

				for (const item of data.items || []) {
					const sourceUrl = absolutizeUrl(item.url || item.id || '', CRUCIAL_TRACKS_FEED_URL);
					const trackTitle = String(item._song_details?.song || '').trim();
					const artist = String(item._song_details?.artist || '').trim();
					const publishedAt = new Date(String(item.date_published || Date.now()));
					const details = {
						artworkUrl: item._song_details?.artwork_url || null,
						appleMusicUrl: item._song_details?.apple_music_url || null,
						songlinkUrl: item._song_details?.songlink_url || null,
						previewUrl: item._song_details?.preview_url || null,
						noteHtml: extractTrackNoteHtmlFromContentHtml(String(item.content_html || ''))
					} satisfies CrucialTrackFeedDetails;

					if (sourceUrl) {
						bySourceUrl.set(sourceUrl, details);
					}

					if (details.appleMusicUrl) {
						byAppleMusicUrl.set(details.appleMusicUrl, details);
					}

					const song = item._song_details?.song || '';
					if (song || artist) {
						byTrackKey.set(normalizeTrackKey(song, artist), details);
					}

					if (trackTitle && artist && !Number.isNaN(publishedAt.getTime())) {
						const note = stripHtml(
							String(
								item._song_details?.content || item.content_text || item.content_html || ''
							).trim()
						);
						const slug = createTrackSlugFromPublishedAt(publishedAt, trackTitle, artist);
						const listenLinks: ListenLink[] = [];

						if (sourceUrl) {
							listenLinks.push({
								label: 'Crucial Tracks',
								url: sourceUrl
							});
						}
						if (details.appleMusicUrl) {
							listenLinks.push({
								label: 'Apple Music',
								url: details.appleMusicUrl
							});
						}
						if (details.songlinkUrl) {
							listenLinks.push({
								label: 'Listen elsewhere',
								url: details.songlinkUrl
							});
						}

						items.push({
							id: sourceUrl || slug,
							slug,
							title: `${trackTitle} - ${artist}`,
							trackTitle,
							artist,
							note,
							noteHtml: details.noteHtml,
							excerpt: note,
							artworkUrl: details.artworkUrl,
							publishedAt,
							displayDate: formatDisplayDate(publishedAt),
							sourceUrl,
							localPath: `/listening/${slug}`,
							appleMusicUrl: details.appleMusicUrl,
							playlistUrl: null,
							songlinkUrl: details.songlinkUrl,
							previewUrl: details.previewUrl,
							listenLinks
						});
					}
				}

				return {
					items,
					bySourceUrl,
					byAppleMusicUrl,
					byTrackKey
				} satisfies CrucialTrackFeedIndex;
			} catch {
				return {
					items: [],
					bySourceUrl: new Map<string, CrucialTrackFeedDetails>(),
					byAppleMusicUrl: new Map<string, CrucialTrackFeedDetails>(),
					byTrackKey: new Map<string, CrucialTrackFeedDetails>()
				} satisfies CrucialTrackFeedIndex;
			}
		})();
		crucialTracksDetailsExpiresAt = Date.now() + REMOTE_MUSIC_CACHE_TTL_MS;
	}

	return crucialTracksDetailsPromise;
}

export async function getArchiveTracks(): Promise<TrackEntry[]> {
	const trackDetails = await getCrucialTrackDetails();
	return walkMarkdownFiles('crucial-tracks')
		.map((filePath) => {
			const raw = trackArchiveFiles[filePath] || '';
			const { data, content } = parseFrontmatter(raw);
			const parsed = extractTrackBody(content);
			const publishedAt = new Date(String(data.published || Date.now()));
			const fileBase = filePath.split('/').pop()?.replace(/\.md$/, '') || 'track';
			const slug = `${slugify(fileBase)}-${slugify(`${parsed.trackTitle}-${parsed.artist}`)}`;
			const sourceUrl = String(data.original_url || '');
			const enriched =
				trackDetails.bySourceUrl.get(sourceUrl) ||
				(parsed.appleMusicUrl
					? trackDetails.byAppleMusicUrl.get(parsed.appleMusicUrl)
					: undefined) ||
				trackDetails.byTrackKey.get(normalizeTrackKey(parsed.trackTitle, parsed.artist));
			const listenLinks: ListenLink[] = [];

			if (sourceUrl) {
				listenLinks.push({
					label: 'Crucial Tracks',
					url: sourceUrl
				});
			}
			if (enriched?.appleMusicUrl || parsed.appleMusicUrl) {
				listenLinks.push({
					label: 'Apple Music',
					url: enriched?.appleMusicUrl || parsed.appleMusicUrl || ''
				});
			}
			if (enriched?.songlinkUrl) {
				listenLinks.push({
					label: 'Listen elsewhere',
					url: enriched.songlinkUrl
				});
			}
			if (parsed.playlistUrl) {
				listenLinks.push({ label: 'Playlist', url: parsed.playlistUrl });
			}

			return {
				id: slug,
				slug,
				title: String(data.title || parsed.trackTitle || 'Untitled'),
				trackTitle: parsed.trackTitle || String(data.title || 'Untitled'),
				artist: parsed.artist,
				note: parsed.note,
				noteHtml: enriched?.noteHtml || parsed.noteHtml,
				excerpt: parsed.note,
				artworkUrl: enriched?.artworkUrl || null,
				publishedAt,
				displayDate: formatDisplayDate(publishedAt),
				sourceUrl,
				localPath: `/listening/${slug}`,
				appleMusicUrl: enriched?.appleMusicUrl || parsed.appleMusicUrl,
				playlistUrl: parsed.playlistUrl,
				songlinkUrl: enriched?.songlinkUrl || null,
				previewUrl: enriched?.previewUrl || null,
				listenLinks,
				archivePath: filePath
			} satisfies TrackEntry;
		})
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

async function getRemoteAlbums({
	includeListenLinks = true
}: {
	includeListenLinks?: boolean;
} = {}): Promise<AlbumEntry[]> {
	const listenLinksByAlbumId = includeListenLinks
		? await getAlbumWhaleListenLinks()
		: new Map<string, ListenLink[]>();

	try {
		const response = await fetch(ALBUMWHALE_FEED_URL, {
			headers: {
				'User-Agent': 'afterword-sveltekit-pds music sync'
			}
		});

		if (!response.ok) {
			return [];
		}

		const xml = await response.text();
		const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];

		return entries
			.map((match) => {
				const entry = match[1] || '';
				const title = decodeHtmlEntities(
					entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || 'Untitled'
				).trim();
				const sourceUrl = decodeHtmlEntities(
					entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)?.[1] || ''
				).trim();
				const publishedAtValue =
					entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] || String(Date.now());
				const publishedAt = new Date(decodeHtmlEntities(publishedAtValue));
				const contentHtml = entry.match(/<content[^>]*type="html"[^>]*>([\s\S]*?)<\/content>/i)?.[1] || '';
				const albumId = getAlbumIdFromOriginalUrl(sourceUrl) || slugify(title);
				const { title: albumTitle, artist } = splitTitleAndArtist(title);
				const body = extractAlbumFeedBody(contentHtml);

				return {
					id: albumId,
					slug: albumId,
					title,
					albumTitle,
					artist,
					note: body.note,
					noteHtml: body.noteHtml,
					excerpt: body.note,
					coverImage: body.coverImage,
					publishedAt,
					displayDate: formatDisplayDate(publishedAt),
					sourceUrl,
					localPath: `/music/${albumId}`,
					listenLinks: listenLinksByAlbumId.get(albumId) || []
				} satisfies AlbumEntry;
			})
			.filter((entry) => entry.sourceUrl && !Number.isNaN(entry.publishedAt.getTime()))
			.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
	} catch {
		return [];
	}
}

async function getLegacyTracks() {
	const [trackDetails, archivedTracks] = await Promise.all([
		getCrucialTrackDetails(),
		getArchiveTracks()
	]);
	const archivedSourceUrls = new Set(
		archivedTracks.map((track) => String(track.sourceUrl || '').trim()).filter(Boolean)
	);
	const archivedTrackKeys = new Set(archivedTracks.map((track) => getTrackDedupKey(track)));
	const liveOnlyTracks = trackDetails.items.filter((track) => {
		const sourceUrl = String(track.sourceUrl || '').trim();
		if (sourceUrl && archivedSourceUrls.has(sourceUrl)) {
			return false;
		}

		return !archivedTrackKeys.has(getTrackDedupKey(track));
	});

	return [...archivedTracks, ...liveOnlyTracks].sort(
		(a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
	);
}

async function getLegacyAlbums() {
	return getArchiveAlbums();
}

export async function getAlbums(context?: MusicReadContext): Promise<AlbumEntry[]> {
	const archiveDigest = getMusicArchiveDigest();
	const [r2Snapshot, pdsAlbums] = await Promise.all([
		getMusicSnapshotFromR2(context),
		getPdsAlbums().catch(() => [])
	]);

	const r2Albums = r2Snapshot?.albums || [];
	if (r2Albums.length && r2Snapshot?.archiveDigest === archiveDigest) {
		void updateMusicCacheStatus(context, {
			lastStatus: 'success',
			lastSource: 'r2',
			archiveDigest
		}).catch(() => {});
		return attachAlbumCoverDelivery(mergeMusicEntries(r2Albums, pdsAlbums, getAlbumDedupKey), context);
	}

	if (context?.platform?.env?.R2_BUCKET) {
		try {
			const snapshot = await ensureMusicSnapshotInR2(context, archiveDigest);
			if (snapshot?.albums.length) {
				return attachAlbumCoverDelivery(
					mergeMusicEntries(snapshot.albums, pdsAlbums, getAlbumDedupKey),
					context
				);
			}
		} catch {
			// Ignore write errors and continue serving the freshest available data.
		}
	}

	const legacyAlbums = await getLegacyAlbums();

	if (r2Albums.length) {
		void updateMusicCacheStatus(context, {
			lastSource: 'r2',
			archiveDigest
		}).catch(() => {});
		return attachAlbumCoverDelivery(
			mergeMusicEntries(
				r2Albums,
				mergeMusicEntries(pdsAlbums, legacyAlbums, getAlbumDedupKey),
				getAlbumDedupKey
			),
			context
		);
	}

	if (!pdsAlbums.length) {
		void updateMusicCacheStatus(context, {
			lastSource: 'archive',
			archiveDigest
		}).catch(() => {});
		return attachAlbumCoverDelivery(legacyAlbums, context);
	}

	void updateMusicCacheStatus(context, {
		lastSource: 'pds',
		archiveDigest
	}).catch(() => {});
	return attachAlbumCoverDelivery(
		mergeMusicEntries(pdsAlbums, legacyAlbums, getAlbumDedupKey),
		context
	);
}

export async function getTracks(context?: MusicReadContext): Promise<TrackEntry[]> {
	const archiveDigest = getMusicArchiveDigest();
	const [r2Snapshot, pdsTracks] = await Promise.all([
		getMusicSnapshotFromR2(context),
		getPdsTracks().catch(() => [])
	]);

	const r2Tracks = r2Snapshot?.tracks || [];
	if (r2Tracks.length && r2Snapshot?.archiveDigest === archiveDigest) {
		void updateMusicCacheStatus(context, {
			lastStatus: 'success',
			lastSource: 'r2',
			archiveDigest
		}).catch(() => {});
		return attachTrackCoverDelivery(mergeMusicEntries(r2Tracks, pdsTracks, getTrackDedupKey), context);
	}

	if (context?.platform?.env?.R2_BUCKET) {
		try {
			const snapshot = await ensureMusicSnapshotInR2(context, archiveDigest);
			if (snapshot?.tracks.length) {
				return attachTrackCoverDelivery(
					mergeMusicEntries(snapshot.tracks, pdsTracks, getTrackDedupKey),
					context
				);
			}
		} catch {
			// Ignore write errors and continue serving the freshest available data.
		}
	}

	const legacyTracks = await getLegacyTracks();

	if (r2Tracks.length) {
		void updateMusicCacheStatus(context, {
			lastSource: 'r2',
			archiveDigest
		}).catch(() => {});
		return attachTrackCoverDelivery(
			mergeMusicEntries(
				r2Tracks,
				mergeMusicEntries(pdsTracks, legacyTracks, getTrackDedupKey),
				getTrackDedupKey
			),
			context
		);
	}

	if (!pdsTracks.length) {
		void updateMusicCacheStatus(context, {
			lastSource: 'archive',
			archiveDigest
		}).catch(() => {});
		return attachTrackCoverDelivery(legacyTracks, context);
	}

	void updateMusicCacheStatus(context, {
		lastSource: 'pds',
		archiveDigest
	}).catch(() => {});
	return attachTrackCoverDelivery(
		mergeMusicEntries(pdsTracks, legacyTracks, getTrackDedupKey),
		context
	);
}

export async function getAlbumBySlug(
	slug: string,
	context?: MusicReadContext
): Promise<AlbumEntry | null> {
	const albums = await getAlbums(context);
	return albums.find((album) => album.slug === slug) || null;
}

export async function getTrackBySlug(
	slug: string,
	context?: MusicReadContext
): Promise<TrackEntry | null> {
	const tracks = await getTracks(context);
	return tracks.find((track) => track.slug === slug) || null;
}

export async function getMusicImportEntries(context?: MusicReadContext) {
	const archiveDigest = getMusicArchiveDigest();

	if (context?.platform?.env?.R2_BUCKET) {
		try {
			await ensureMusicSnapshotInR2(context, archiveDigest);
		} catch {
			// Ignore snapshot refresh failures here so import flows can continue with enriched source data.
		}
	}

	const [tracks, albums] = await Promise.all([
		getArchiveTracks(),
		getArchiveAlbums({ includeListenLinks: false })
	]);

	return {
		archiveDigest,
		tracks,
		albums
	};
}

export async function getRemoteMusicImportEntries() {
	const [trackDetails, albums] = await Promise.all([
		getCrucialTrackDetails(),
		getRemoteAlbums({ includeListenLinks: false })
	]);

	return {
		tracks: trackDetails.items,
		albums
	};
}
