const ALBUMWHALE_LIST_URL = 'https://albumwhale.com/bryan/listening-now';
const CRUCIAL_TRACKS_FEED_URL = 'https://www.crucialtracks.org/profile/bryan/feed.json';
const albumArchiveFiles = import.meta.glob('/data/archive/albumwhale/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;
const trackArchiveFiles = import.meta.glob('/data/archive/crucial-tracks/**/*.md', {
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
	excerpt: string;
	coverImage: string | null;
	publishedAt: Date;
	displayDate: string;
	sourceUrl: string;
	localPath: string;
	listenLinks: ListenLink[];
};

export type TrackEntry = {
	id: string;
	slug: string;
	title: string;
	trackTitle: string;
	artist: string;
	note: string;
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
};

type CrucialTrackFeedDetails = {
	artworkUrl: string | null;
	appleMusicUrl: string | null;
	songlinkUrl: string | null;
	previewUrl: string | null;
};

type CrucialTrackFeedIndex = {
	bySourceUrl: Map<string, CrucialTrackFeedDetails>;
	byAppleMusicUrl: Map<string, CrucialTrackFeedDetails>;
	byTrackKey: Map<string, CrucialTrackFeedDetails>;
};

let albumWhalePageMapPromise: Promise<Map<string, string>> | null = null;
let albumWhaleLinksPromise: Promise<Map<string, ListenLink[]>> | null = null;
let crucialTracksDetailsPromise: Promise<CrucialTrackFeedIndex> | null = null;

function walkMarkdownFiles(root: string): string[] {
	return Object.keys(root === 'albumwhale' ? albumArchiveFiles : trackArchiveFiles).sort();
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
		else data[key] = value;
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
	const match = String(value || '').match(/^["*“”\s]*([^*"]+?)["*“”\s]+by\s+(.+)$/i);
	if (match) {
		return {
			title: match[1].trim(),
			artist: match[2].trim()
		};
	}

	const parts = String(value || '').split(/\s+by\s+/i);
	if (parts.length >= 2) {
		const artist = parts.pop() || '';
		return {
			title: parts.join(' by ').trim(),
			artist: artist.trim()
		};
	}

	return {
		title: String(value || '').trim() || 'Untitled',
		artist: ''
	};
}

function normalizeTrackKey(title: string, artist: string): string {
	return `${slugify(title)}::${slugify(artist)}`;
}

function formatDisplayDate(date: Date): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

function stripHtml(value: string): string {
	return String(value || '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
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
		note
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

	return {
		trackTitle: title,
		artist,
		appleMusicUrl,
		playlistUrl,
		note
	};
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
	const links = [...sectionMatch[1].matchAll(/<li>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)];

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

export async function getAlbums(): Promise<AlbumEntry[]> {
	const listenLinksByAlbumId = await getAlbumWhaleListenLinks();

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
				excerpt: body.note,
				coverImage: body.coverImage,
				publishedAt,
				displayDate: formatDisplayDate(publishedAt),
				sourceUrl: String(data.original_url || ''),
				localPath: `/music/${slug}`,
				listenLinks: listenLinksByAlbumId.get(albumId) || []
			} satisfies AlbumEntry;
		})
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export async function getAlbumBySlug(slug: string): Promise<AlbumEntry | null> {
	const albums = await getAlbums();
	return albums.find((album) => album.slug === slug) || null;
}

async function getCrucialTrackDetails(): Promise<CrucialTrackFeedIndex> {
	if (!crucialTracksDetailsPromise) {
		crucialTracksDetailsPromise = (async () => {
			try {
				const response = await fetch(CRUCIAL_TRACKS_FEED_URL, {
					headers: {
						'User-Agent': 'afterword-sveltekit-pds music sync'
					}
				});

				if (!response.ok) {
					return {
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
							artwork_url?: string;
							apple_music_url?: string;
							songlink_url?: string;
							preview_url?: string;
						};
					}>;
				};

				const bySourceUrl = new Map<string, CrucialTrackFeedDetails>();
				const byAppleMusicUrl = new Map<string, CrucialTrackFeedDetails>();
				const byTrackKey = new Map<string, CrucialTrackFeedDetails>();

				for (const item of data.items || []) {
					const details = {
						artworkUrl: item._song_details?.artwork_url || null,
						appleMusicUrl: item._song_details?.apple_music_url || null,
						songlinkUrl: item._song_details?.songlink_url || null,
						previewUrl: item._song_details?.preview_url || null
					} satisfies CrucialTrackFeedDetails;

					if (item.url) {
						bySourceUrl.set(String(item.url), details);
					}

					if (details.appleMusicUrl) {
						byAppleMusicUrl.set(details.appleMusicUrl, details);
					}

					const song = item._song_details?.song || '';
					const artist = item._song_details?.artist || '';
					if (song || artist) {
						byTrackKey.set(normalizeTrackKey(song, artist), details);
					}
				}

				return {
					bySourceUrl,
					byAppleMusicUrl,
					byTrackKey
				} satisfies CrucialTrackFeedIndex;
			} catch {
				return {
					bySourceUrl: new Map<string, CrucialTrackFeedDetails>(),
					byAppleMusicUrl: new Map<string, CrucialTrackFeedDetails>(),
					byTrackKey: new Map<string, CrucialTrackFeedDetails>()
				} satisfies CrucialTrackFeedIndex;
			}
		})();
	}

	return crucialTracksDetailsPromise;
}

export async function getTracks(): Promise<TrackEntry[]> {
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
				(parsed.appleMusicUrl ? trackDetails.byAppleMusicUrl.get(parsed.appleMusicUrl) : undefined) ||
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
				listenLinks.push({ label: "Bryan's playlist", url: parsed.playlistUrl });
			}

			return {
				id: slug,
				slug,
				title: String(data.title || parsed.trackTitle || 'Untitled'),
				trackTitle: parsed.trackTitle || String(data.title || 'Untitled'),
				artist: parsed.artist,
				note: parsed.note,
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
				listenLinks
			} satisfies TrackEntry;
		})
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export async function getTrackBySlug(slug: string): Promise<TrackEntry | null> {
	const tracks = await getTracks();
	return tracks.find((track) => track.slug === slug) || null;
}
