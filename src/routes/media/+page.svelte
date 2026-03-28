<script lang="ts">
	import type { BlogPost } from '$lib/server/ghost';
	import type { AlbumEntry, TrackEntry } from '$lib/server/music';
	import type { PopfeedItem } from '$lib/server/popfeed';

	type TimelineLink = {
		label: string;
		url: string;
		external?: boolean;
	};

	type BaseTimelineItem = {
		id: string;
		kind: 'post' | 'track' | 'album' | 'popfeed';
		label: string;
		title: string;
		href: string;
		date: Date;
		dateLabel: string;
		summary: string;
		imageUrl: string | null;
		imageAlt: string;
		tags: string[];
	};

	type PostTimelineItem = BaseTimelineItem & {
		kind: 'post';
	};

	type TrackTimelineItem = BaseTimelineItem & {
		kind: 'track';
		artist: string;
		audioUrl: string | null;
		links: TimelineLink[];
	};

	type AlbumTimelineItem = BaseTimelineItem & {
		kind: 'album';
		artist: string;
		links: TimelineLink[];
	};

	type PopfeedTimelineItem = BaseTimelineItem & {
		kind: 'popfeed';
		credit: string;
		links: TimelineLink[];
	};

	type TimelineItem =
		| PostTimelineItem
		| TrackTimelineItem
		| AlbumTimelineItem
		| PopfeedTimelineItem;

	const CLASSIFICATION_TAGS = new Set([
		'books',
		'book-reviews',
		'movie',
		'movies',
		'film',
		'films',
		'show',
		'shows',
		'tv',
		'watching'
	]);

	let {
		data
	}: {
		data: {
			intro: {
				title: string;
				description: string;
				paragraphs: string[];
			};
			posts: BlogPost[];
			albums: AlbumEntry[];
			tracks: TrackEntry[];
			popfeedItems: PopfeedItem[];
		};
	} = $props();

	function stripHtml(value: string) {
		return String(value || '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function summarize(value: string, maxLength = 220) {
		const text = stripHtml(value);

		if (!text || text.length <= maxLength) {
			return text;
		}

		const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, '');
		return `${clipped}…`;
	}

	function formatTimelineDate(value: Date) {
		const date = value instanceof Date ? value : new Date(value);
		const currentYear = new Date().getFullYear();

		return new Intl.DateTimeFormat('en-GB', {
			day: '2-digit',
			month: 'short',
			...(date.getFullYear() !== currentYear ? { year: 'numeric' as const } : {})
		}).format(date);
	}

	function getPostTags(post: BlogPost) {
		return (post.publicTags || [])
			.filter((tag) => !CLASSIFICATION_TAGS.has(tag.slug))
			.map((tag) => tag.label)
			.slice(0, 4);
	}

	function getPostLabel(post: BlogPost) {
		const tags = new Set(post.tags);

		if (tags.has('books') || tags.has('book-reviews')) {
			return 'Book';
		}

		if (tags.has('show') || tags.has('shows') || tags.has('tv')) {
			return 'Show';
		}

		if (tags.has('movie') || tags.has('movies') || tags.has('film') || tags.has('films')) {
			return 'Movie';
		}

		if (tags.has('watching')) {
			return 'Watching';
		}

		return 'Media Note';
	}

	function toTimelineLinks(
		links: Array<{ label: string; url: string }>,
		limit = 3
	): TimelineLink[] {
		return (links || []).slice(0, limit).map((link) => ({
			label: link.label,
			url: link.url,
			external: true
		}));
	}

	function toPostTimelineItem(post: BlogPost): PostTimelineItem {
		return {
			id: `post-${post.slug}`,
			kind: 'post',
			label: getPostLabel(post),
			title: post.title,
			href: post.path,
			date: post.publishedAt,
			dateLabel: formatTimelineDate(post.publishedAt),
			summary: post.excerpt || summarize(post.html),
			imageUrl: post.coverImage || null,
			imageAlt: post.title,
			tags: getPostTags(post)
		};
	}

	function toTrackTimelineItem(track: TrackEntry): TrackTimelineItem {
		return {
			id: `track-${track.slug}`,
			kind: 'track',
			label: 'Listening',
			title: track.trackTitle,
			href: track.localPath,
			date: track.publishedAt,
			dateLabel: formatTimelineDate(track.publishedAt),
			summary: summarize(track.note || ''),
			imageUrl: track.artworkUrl || null,
			imageAlt: `${track.trackTitle} by ${track.artist}`,
			tags: [],
			artist: track.artist,
			audioUrl: track.previewUrl || null,
			links: toTimelineLinks(track.listenLinks)
		};
	}

	function toAlbumTimelineItem(album: AlbumEntry): AlbumTimelineItem {
		return {
			id: `album-${album.slug}`,
			kind: 'album',
			label: 'Album Rotation',
			title: album.albumTitle,
			href: album.localPath,
			date: album.publishedAt,
			dateLabel: formatTimelineDate(album.publishedAt),
			summary: summarize(album.note || ''),
			imageUrl: album.coverImage || null,
			imageAlt: `${album.albumTitle} by ${album.artist}`,
			tags: [],
			artist: album.artist,
			links: toTimelineLinks(album.listenLinks)
		};
	}

	function getPopfeedLabel(item: PopfeedItem) {
		switch (item.type) {
			case 'book':
				return 'Book';
			case 'tv_show':
				return 'Show';
			default:
				return 'Movie';
		}
	}

	function toPopfeedTimelineItem(item: PopfeedItem): PopfeedTimelineItem {
		return {
			id: `popfeed-${item.type}-${item.slug}`,
			kind: 'popfeed',
			label: getPopfeedLabel(item),
			title: item.title,
			href: item.localPath,
			date: item.date,
			dateLabel: formatTimelineDate(item.date),
			summary: item.genres.slice(0, 4).join(', '),
			imageUrl: item.posterImage,
			imageAlt: item.mainCredit ? `${item.title} by ${item.mainCredit}` : item.title,
			tags: item.listTypeLabel ? [item.listTypeLabel] : [],
			credit: item.mainCredit,
			links: toTimelineLinks(item.links)
		};
	}

	function getTimelineItems(items: TimelineItem[]) {
		return items.slice().sort((a, b) => b.date.getTime() - a.date.getTime());
	}

	let timelineItems = $derived.by(() =>
		getTimelineItems([
			...data.posts.map(toPostTimelineItem),
			...data.tracks.map(toTrackTimelineItem),
			...data.albums.map(toAlbumTimelineItem),
			...data.popfeedItems.map(toPopfeedTimelineItem)
		])
	);
</script>

<svelte:head>
	<title>{data.intro.title} | Bryan Robb</title>
	<meta name="description" content={data.intro.description} />
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.intro.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#each data.intro.paragraphs as paragraph}
					<p>{paragraph}</p>
				{/each}
			</section>
		</div>
	</article>
</section>

{#if timelineItems.length}
	<section class="section-block">
		<div class="media-timeline" aria-label="Media timeline">
			{#each timelineItems as item}
				<article class="media-timeline__entry" id={item.id}>
					<div class="media-timeline__meta-column">
						<time class="media-timeline__date" datetime={item.date.toISOString()}>
							{item.dateLabel}
						</time>
					</div>

					<div class="media-timeline__rail" aria-hidden="true">
						<span class="media-timeline__dot"></span>
					</div>

					<div class="media-timeline__content">
						<p class="media-timeline__kicker">{item.label}</p>

						{#if item.tags.length}
							<div class="media-timeline__tags">
								{#each item.tags as tag}
									<span class="tag-pill">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if item.kind === 'post'}
							<div class="media-timeline__title-row">
								<h2 class="media-timeline__title">
									<a href={item.href}>{item.title}</a>
								</h2>
								<a class="media-timeline__jump" href={item.href} aria-label={`Open ${item.title}`}>
									<svg viewBox="0 0 32 32" aria-hidden="true">
										<path
											d="M5.333 14.667v2.667h16L14 24.667l1.893 1.893L26.453 16 15.893 5.44 14 7.333l7.333 7.333h-16z"
										></path>
									</svg>
								</a>
							</div>

							{#if item.summary}
								<p class="media-timeline__lede">{item.summary}</p>
							{/if}

							{#if item.imageUrl}
								<figure class="media-timeline__feature">
									<img src={item.imageUrl} alt={item.imageAlt} />
								</figure>
							{/if}

							<div class="media-timeline__actions">
								<a class="tag-pill media-timeline__action" href={item.href}>Read note</a>
							</div>
						{:else if item.kind === 'track'}
							<div class="media-entry media-entry--track">
								<div class="media-entry__body">
									<div class="media-entry__heading">
										<h2 class="media-timeline__title media-timeline__title--media">
											<a href={item.href}>{item.title}</a>
										</h2>
										<a
											class="media-timeline__jump"
											href={item.href}
											aria-label={`Open ${item.title}`}
										>
											<svg viewBox="0 0 32 32" aria-hidden="true">
												<path
													d="M5.333 14.667v2.667h16L14 24.667l1.893 1.893L26.453 16 15.893 5.44 14 7.333l7.333 7.333h-16z"
												></path>
											</svg>
										</a>
									</div>

									<p class="media-timeline__meta media-timeline__meta--artist">{item.artist}</p>
								</div>

								<a class="media-entry__cover media-entry__cover--full" href={item.href}>
									{#if item.imageUrl}
										<img class="media-entry__art" src={item.imageUrl} alt={item.imageAlt} />
									{:else}
										<div class="media-entry__fallback" aria-hidden="true">Track</div>
									{/if}
								</a>

								{#if item.summary}
									<p class="media-timeline__lede media-timeline__lede--compact">{item.summary}</p>
								{/if}

								{#if item.audioUrl}
									<div class="media-entry__audio">
										<audio
											controls
											preload="none"
											src={item.audioUrl}
											aria-label={`Preview ${item.title}`}
										></audio>
									</div>
								{/if}

								{#if item.links.length}
									<div class="media-timeline__actions">
										{#each item.links as link}
											<a
												class="tag-pill media-timeline__action"
												href={link.url}
												target={link.external ? '_blank' : undefined}
												rel={link.external ? 'noreferrer' : undefined}
											>
												{link.label}
											</a>
										{/each}
									</div>
								{/if}
							</div>
						{:else if item.kind === 'popfeed'}
							<div class="media-entry media-entry--popfeed">
								<div class="media-entry__body">
									<div class="media-entry__heading">
										<h2 class="media-timeline__title media-timeline__title--media">
											<a href={item.href}>{item.title}</a>
										</h2>
										<a
											class="media-timeline__jump"
											href={item.href}
											aria-label={`Open ${item.title}`}
										>
											<svg viewBox="0 0 32 32" aria-hidden="true">
												<path
													d="M5.333 14.667v2.667h16L14 24.667l1.893 1.893L26.453 16 15.893 5.44 14 7.333l7.333 7.333h-16z"
												></path>
											</svg>
										</a>
									</div>

									{#if item.credit}
										<p class="media-timeline__meta media-timeline__meta--artist">{item.credit}</p>
									{/if}
								</div>

								<a class="media-entry__cover media-entry__cover--full" href={item.href}>
									{#if item.imageUrl}
										<img class="media-entry__art" src={item.imageUrl} alt={item.imageAlt} />
									{:else}
										<div class="media-entry__fallback" aria-hidden="true">{item.label}</div>
									{/if}
								</a>

								{#if item.summary}
									<p class="media-timeline__lede media-timeline__lede--compact">{item.summary}</p>
								{/if}

								<div class="media-timeline__actions">
									<a class="tag-pill media-timeline__action" href={item.href}>Open entry</a>
									{#each item.links as link}
										<a
											class="tag-pill media-timeline__action"
											href={link.url}
											target={link.external ? '_blank' : undefined}
											rel={link.external ? 'noreferrer' : undefined}
										>
											{link.label}
										</a>
									{/each}
								</div>
							</div>
						{:else}
							<div class="media-entry media-entry--album">
								<div class="media-entry__body">
									<div class="media-entry__heading">
										<h2 class="media-timeline__title media-timeline__title--media">
											<a href={item.href}>{item.title}</a>
										</h2>
										<a
											class="media-timeline__jump"
											href={item.href}
											aria-label={`Open ${item.title}`}
										>
											<svg viewBox="0 0 32 32" aria-hidden="true">
												<path
													d="M5.333 14.667v2.667h16L14 24.667l1.893 1.893L26.453 16 15.893 5.44 14 7.333l7.333 7.333h-16z"
												></path>
											</svg>
										</a>
									</div>

									<p class="media-timeline__meta media-timeline__meta--artist">{item.artist}</p>
								</div>

								<a class="media-entry__cover media-entry__cover--full" href={item.href}>
									{#if item.imageUrl}
										<img class="media-entry__art" src={item.imageUrl} alt={item.imageAlt} />
									{:else}
										<div class="media-entry__fallback" aria-hidden="true">Album</div>
									{/if}
								</a>

								{#if item.summary}
									<p class="media-timeline__lede media-timeline__lede--compact">{item.summary}</p>
								{/if}

								{#if item.links.length}
									<div class="media-timeline__actions">
										{#each item.links as link}
											<a
												class="tag-pill media-timeline__action"
												href={link.url}
												target={link.external ? '_blank' : undefined}
												rel={link.external ? 'noreferrer' : undefined}
											>
												{link.label}
											</a>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</section>
{:else}
	<section class="section-block">
		<p class="page-head__lede">No media notes are available yet.</p>
	</section>
{/if}

<style>
	.media-timeline {
		--timeline-date-column: 4.5rem;
		--timeline-rail-column: 1.4rem;
		--timeline-gap: 1rem;
		position: relative;
	}

	.media-timeline::before {
		content: '';
		position: absolute;
		top: 0.78rem;
		bottom: 0.4rem;
		left: calc(
			var(--timeline-date-column) + var(--timeline-gap) + (var(--timeline-rail-column) / 2)
		);
		width: 1px;
		background: color-mix(in srgb, var(--accent) 42%, white 58%);
		border-radius: 999px;
		opacity: 0.55;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.media-timeline__entry {
		display: grid;
		grid-template-columns: var(--timeline-date-column) var(--timeline-rail-column) minmax(0, 1fr);
		gap: var(--timeline-gap);
		align-items: start;
	}

	.media-timeline__entry + .media-timeline__entry {
		margin-top: 2.9rem;
	}

	.media-timeline__date {
		position: sticky;
		top: 5.35rem;
		display: inline-block;
		padding-top: 0.15rem;
		font-size: 0.82rem;
		line-height: 1.25;
		color: var(--muted);
	}

	.media-timeline__rail {
		position: relative;
		min-height: 100%;
	}

	.media-timeline__dot {
		position: absolute;
		top: 0.42rem;
		left: 50%;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 999px;
		background: var(--surface);
		border: 3px solid color-mix(in srgb, var(--accent) 82%, white 18%);
		transform: translateX(-50%);
	}

	.media-timeline__content {
		min-width: 0;
	}

	.media-timeline__kicker {
		margin: 0 0 0.55rem;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.media-timeline__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 0.75rem;
	}

	.media-timeline__title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.media-timeline__title {
		margin: 0;
		font-family: 'Fira Sans', sans-serif;
		font-size: clamp(1.28rem, 2.35vw, 1.72rem);
		line-height: 1.14;
		letter-spacing: -0.02em;
	}

	.media-timeline__title a {
		color: inherit;
		text-decoration: none;
	}

	.media-timeline__jump {
		flex: 0 0 auto;
		color: var(--muted);
		text-decoration: none;
	}

	.media-timeline__jump svg {
		display: block;
		width: 1.2rem;
		height: 1.2rem;
		fill: currentColor;
	}

	.media-timeline__lede,
	.media-timeline__meta {
		margin: 0.85rem 0 0;
	}

	.media-timeline__lede {
		font-size: 1rem;
		line-height: 1.68;
		color: var(--muted);
	}

	.media-timeline__meta {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.media-timeline__meta--artist {
		margin-top: 0.35rem;
	}

	.media-timeline__lede--compact {
		margin-top: 0.55rem;
	}

	.media-timeline__feature {
		margin: 1rem 0 0;
	}

	.media-timeline__feature img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.85rem;
	}

	.media-entry {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		margin-top: 1rem;
		align-items: start;
	}

	.media-entry__body {
		min-width: 0;
	}

	.media-entry__heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.media-timeline__title--media {
		font-size: clamp(1.18rem, 2.1vw, 1.55rem);
	}

	.media-entry__cover {
		display: block;
		width: 100%;
		text-decoration: none;
		color: inherit;
	}

	.media-entry__art {
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 0.85rem;
	}

	.media-entry__fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
		color: var(--muted);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.media-entry__audio {
		margin-top: 0.85rem;
	}

	.media-entry__audio audio {
		display: block;
		width: 100%;
	}

	.media-timeline__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.media-timeline__action {
		text-decoration: none;
	}

	@media (max-width: 640px) {
		.media-timeline__entry {
			display: block;
		}

		.media-timeline__entry + .media-timeline__entry {
			margin-top: 2.4rem;
		}

		.media-timeline::before {
			display: none;
		}

		.media-timeline__meta-column {
			margin-bottom: 0.45rem;
		}

		.media-timeline__date {
			position: static;
			padding-top: 0;
			font-size: 0.78rem;
		}

		.media-timeline__rail,
		.media-timeline__dot {
			display: none;
		}

		.media-entry {
			gap: 0.95rem;
		}
	}
</style>
