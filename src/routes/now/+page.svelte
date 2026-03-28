<script lang="ts">
	import CheckinMap from '$lib/components/CheckinMap.svelte';
	import type { Checkin } from '$lib/server/atproto';
	import type { BlogPost } from '$lib/server/ghost';
	import type { AlbumEntry, ListenLink, TrackEntry } from '$lib/server/music';

	type TimelineLink = {
		label: string;
		url: string;
		external?: boolean;
	};

	type BaseTimelineItem = {
		id: string;
		kind: 'post' | 'checkin' | 'track' | 'album';
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

	type CheckinTimelineItem = BaseTimelineItem & {
		kind: 'checkin';
		note: string;
		meta: string;
		latitude: number | null;
		longitude: number | null;
		appleMapsUrl: string | null;
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

	type TimelineItem =
		| PostTimelineItem
		| CheckinTimelineItem
		| TrackTimelineItem
		| AlbumTimelineItem;

	let {
		data
	}: {
		data: {
			intro: {
				title: string;
				description: string;
				paragraphs: string[];
			};
			nowPosts: BlogPost[];
			bookPosts: BlogPost[];
			checkins: Checkin[];
			albums: AlbumEntry[];
			tracks: TrackEntry[];
		};
	} = $props();

	function getNowIntroParagraph() {
		return data.intro.paragraphs[0] || data.intro.description;
	}

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

	function normalizeComparableText(value: string) {
		return stripHtml(value)
			.toLowerCase()
			.replace(/[.!?,;:'"()[\]{}]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
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

	function formatTagLabel(slug: string) {
		return String(slug || '')
			.split('-')
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function getPostTags(post: BlogPost) {
		const tags: string[] = [];

		if (post.tags.includes('now')) tags.push('Now');
		if (post.tags.includes('books')) tags.push('Books');
		if (post.tags.includes('book-reviews')) tags.push('Book Reviews');
		if (post.tags.includes('photography')) tags.push('Photography');
		if (post.tags.includes('gallery')) tags.push('Gallery');

		for (const tag of post.publicTags || []) {
			if (!tags.includes(tag.label)) {
				tags.push(tag.label);
			}
		}

		return tags.slice(0, 4);
	}

	function getPostLabel(post: BlogPost) {
		if (post.tags.includes('books') || post.tags.includes('book-reviews')) {
			return 'Book';
		}

		if (
			post.tags.includes('photography') ||
			post.tags.includes('gallery') ||
			post.tags.includes('hash-gallery')
		) {
			return 'Photo Note';
		}

		return 'Now';
	}

	function mapLinks(links: ListenLink[], limit = 3): TimelineLink[] {
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

	function getPostActionLabel(item: PostTimelineItem) {
		if (item.label === 'Book') {
			return 'Read note';
		}

		if (item.label === 'Photo Note') {
			return 'View post';
		}

		return 'Read post';
	}

	function getCheckinLede(item: CheckinTimelineItem) {
		const lede = stripHtml(item.summary);
		const meta = stripHtml(item.meta);

		if (!lede) {
			return '';
		}

		if (meta && normalizeComparableText(lede) === normalizeComparableText(meta)) {
			return '';
		}

		return lede;
	}

	function getCheckinBody(item: CheckinTimelineItem) {
		const note = stripHtml(item.note);
		const lede = getCheckinLede(item);

		if (!note) {
			return '';
		}

		if (normalizeComparableText(note) === normalizeComparableText(lede)) {
			return '';
		}

		return note;
	}

	function toCheckinTimelineItem(checkin: Checkin): CheckinTimelineItem {
		return {
			id: `checkin-${checkin.slug}`,
			kind: 'checkin',
			label: 'Check-In',
			title: checkin.name,
			href: checkin.canonicalPath,
			date: checkin.visitedAt,
			dateLabel: formatTimelineDate(checkin.visitedAt),
			summary: summarize(checkin.excerpt || checkin.note || checkin.place || ''),
			imageUrl: checkin.coverImage || checkin.photoUrls[0] || null,
			imageAlt: checkin.name,
			tags: (checkin.tags || []).slice(0, 3).map(formatTagLabel),
			note: checkin.note || checkin.excerpt || '',
			meta: checkin.place || checkin.venueCategory || '',
			latitude: checkin.latitude,
			longitude: checkin.longitude,
			appleMapsUrl: checkin.appleMapsUrl
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
			links: [{ label: 'Track note', url: track.localPath }, ...mapLinks(track.listenLinks)]
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
			links: [{ label: 'Album note', url: album.localPath }, ...mapLinks(album.listenLinks)]
		};
	}

	function getTimelineItems(items: TimelineItem[]) {
		return items.slice().sort((a, b) => b.date.getTime() - a.date.getTime());
	}

	function getAllTimelineItems() {
		return getTimelineItems([
			...data.nowPosts.map(toPostTimelineItem),
			...data.bookPosts.map(toPostTimelineItem),
			...data.checkins.map(toCheckinTimelineItem),
			...data.tracks.map(toTrackTimelineItem),
			...data.albums.map(toAlbumTimelineItem)
		]);
	}

	let timelineItems = $derived.by(() => getAllTimelineItems());
	let indexItems = $derived.by(() => timelineItems.slice(0, 6));
</script>

<svelte:head>
	<title>{data.intro.title} | Bryan Robb</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.intro.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p>{getNowIntroParagraph()}</p>
			</section>
		</div>
	</article>
</section>

{#if indexItems.length}
	<section class="section-block">
		<h2 class="section-title">On This Page</h2>
		<div class="now-index-list" aria-label="Current threads">
			{#each indexItems as item}
				<a class="now-index-row" href={`#${item.id}`}>
					<div class="now-index-row__main">
						<span class="now-index-row__kind">{item.label}</span>
						<h3 class="now-index-row__title">{item.title}</h3>
					</div>
					<time class="now-index-row__date" datetime={item.date.toISOString()}>
						{item.dateLabel}
					</time>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if timelineItems.length}
	<section class="section-block">
		<div class="now-timeline" aria-label="Now timeline">
			{#each timelineItems as item}
				<article class="now-timeline__entry" id={item.id}>
					<div class="now-timeline__meta-column">
						<time class="now-timeline__date" datetime={item.date.toISOString()}>
							{item.dateLabel}
						</time>
					</div>

					<div class="now-timeline__rail" aria-hidden="true">
						<span class="now-timeline__dot"></span>
					</div>

					<div class="now-timeline__content">
						<p class="now-timeline__kicker">{item.label}</p>

						{#if item.tags.length}
							<div class="now-timeline__tags">
								{#each item.tags as tag}
									<span class="tag-pill">{tag}</span>
								{/each}
							</div>
						{/if}

						<div class="now-timeline__title-row">
							<h2 class="now-timeline__title">
								<a href={item.href}>{item.title}</a>
							</h2>
							<a class="now-timeline__jump" href={item.href} aria-label={`Open ${item.title}`}>
								<svg viewBox="0 0 32 32" aria-hidden="true">
									<path d="M5.333 14.667v2.667h16L14 24.667l1.893 1.893L26.453 16 15.893 5.44 14 7.333l7.333 7.333h-16z"></path>
								</svg>
							</a>
						</div>

						{#if item.kind === 'post'}
							{#if item.summary}
								<p class="now-timeline__lede">{item.summary}</p>
							{/if}

							{#if item.imageUrl}
								<figure class="now-timeline__feature">
									<img src={item.imageUrl} alt={item.imageAlt} />
								</figure>
							{/if}

							<div class="now-timeline__actions">
								<a class="tag-pill now-timeline__action" href={item.href}>
									{getPostActionLabel(item)}
								</a>
							</div>
						{:else if item.kind === 'checkin'}
							{#if item.meta}
								<p class="now-timeline__meta">{item.meta}</p>
							{/if}

							{#if getCheckinLede(item)}
								<p class="now-timeline__lede">{getCheckinLede(item)}</p>
							{/if}

							{#if item.imageUrl}
								<figure class="now-timeline__feature">
									<img src={item.imageUrl} alt={item.imageAlt} />
								</figure>
							{/if}

							{#if getCheckinBody(item)}
								<p class="now-timeline__body-text">{getCheckinBody(item)}</p>
							{/if}

							{#if item.latitude !== null && item.longitude !== null}
								<section class="now-checkin-map" aria-label="Map">
									<CheckinMap
										latitude={item.latitude}
										longitude={item.longitude}
										name={item.title}
									/>
								</section>
							{/if}

							<div class="now-timeline__actions">
								<a class="tag-pill now-timeline__action" href={item.href}>View check-in</a>
								{#if item.appleMapsUrl}
									<a
										class="tag-pill now-timeline__action"
										href={item.appleMapsUrl}
										target="_blank"
										rel="noreferrer"
									>
										Open in Maps
									</a>
								{/if}
								<a class="tag-pill now-timeline__action" href="/check-ins">All check-ins</a>
							</div>
						{:else if item.kind === 'track'}
							<div class="now-media-entry">
								<div class="now-media-entry__cover">
									{#if item.imageUrl}
										<img class="now-media-entry__art" src={item.imageUrl} alt={item.imageAlt} />
									{:else}
										<div class="now-media-entry__fallback" aria-hidden="true">Track</div>
									{/if}
								</div>

								<div class="now-media-entry__body">
									<p class="now-timeline__meta">{item.artist}</p>

									{#if item.summary}
										<p class="now-timeline__lede now-timeline__lede--compact">{item.summary}</p>
									{/if}

									{#if item.audioUrl}
										<div class="now-media-entry__audio">
											<audio
												controls
												preload="none"
												src={item.audioUrl}
												aria-label={`Preview ${item.title}`}
											></audio>
										</div>
									{/if}

									<div class="now-timeline__actions">
										{#each item.links as link}
											<a
												class="tag-pill now-timeline__action"
												href={link.url}
												target={link.external ? '_blank' : undefined}
												rel={link.external ? 'noreferrer' : undefined}
											>
												{link.label}
											</a>
										{/each}
									</div>
								</div>
							</div>
						{:else}
							<div class="now-media-entry">
								<div class="now-media-entry__cover">
									{#if item.imageUrl}
										<img class="now-media-entry__art" src={item.imageUrl} alt={item.imageAlt} />
									{:else}
										<div class="now-media-entry__fallback" aria-hidden="true">Album</div>
									{/if}
								</div>

								<div class="now-media-entry__body">
									<p class="now-timeline__meta">{item.artist}</p>

									{#if item.summary}
										<p class="now-timeline__lede now-timeline__lede--compact">{item.summary}</p>
									{/if}

									<div class="now-timeline__actions">
										{#each item.links as link}
											<a
												class="tag-pill now-timeline__action"
												href={link.url}
												target={link.external ? '_blank' : undefined}
												rel={link.external ? 'noreferrer' : undefined}
											>
												{link.label}
											</a>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}

<style>
	.now-index-list {
		border-top: 1px solid color-mix(in srgb, var(--line) 85%, transparent 15%);
	}

	.now-timeline {
		--timeline-date-column: 4.5rem;
		--timeline-rail-column: 1.4rem;
		--timeline-gap: 1rem;
	}

	.now-index-row {
		--now-index-kind-column: 8.75rem;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.95rem;
		align-items: center;
		padding: 0.9rem 0;
		text-decoration: none;
		color: inherit;
	}

	.now-index-row__main {
		display: grid;
		grid-template-columns: var(--now-index-kind-column) minmax(0, 1fr);
		align-items: baseline;
		column-gap: 0.7rem;
		min-width: 0;
	}

	.now-index-row__kind {
		color: var(--accent);
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.now-index-row__title {
		margin: 0;
		font-family: 'Fira Sans', sans-serif;
		font-size: 1.02rem;
		line-height: 1.3;
		color: inherit;
		max-width: 100%;
	}

	.now-index-row__date {
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.2;
		white-space: nowrap;
		padding-left: 0.75rem;
	}

	.now-timeline__entry {
		display: grid;
		grid-template-columns: var(--timeline-date-column) var(--timeline-rail-column) minmax(0, 1fr);
		gap: var(--timeline-gap);
		align-items: start;
	}

	.now-timeline__entry + .now-timeline__entry {
		margin-top: 2.9rem;
	}

	.now-timeline__meta-column {
		min-width: 0;
	}

	.now-timeline__date {
		position: sticky;
		top: 5.35rem;
		display: inline-block;
		padding-top: 0.15rem;
		font-size: 0.82rem;
		line-height: 1.25;
		color: var(--muted);
	}

	.now-timeline__rail {
		position: relative;
		min-height: 100%;
	}

	.now-timeline__rail::before {
		content: '';
		position: absolute;
		top: 0.8rem;
		bottom: 0;
		left: 50%;
		width: 2px;
		background: color-mix(in srgb, var(--accent) 70%, white 30%);
		border-radius: 999px;
		opacity: 0.9;
		transform: translateX(-50%);
	}

	.now-timeline__entry:last-child .now-timeline__rail::before {
		bottom: 0.35rem;
	}

	.now-timeline__dot {
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

	.now-timeline__content {
		min-width: 0;
	}

	.now-timeline__kicker {
		margin: 0 0 0.55rem;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.now-timeline__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 0.75rem;
	}

	.now-timeline__title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.now-timeline__title {
		margin: 0;
		font-family: 'Fira Sans', sans-serif;
		font-size: clamp(1.28rem, 2.35vw, 1.72rem);
		line-height: 1.14;
		letter-spacing: -0.02em;
	}

	.now-timeline__title a {
		color: inherit;
		text-decoration: none;
	}

	.now-timeline__jump {
		flex: 0 0 auto;
		color: var(--muted);
		text-decoration: none;
	}

	.now-timeline__jump svg {
		display: block;
		width: 1.2rem;
		height: 1.2rem;
		fill: currentColor;
	}

	.now-timeline__lede,
	.now-timeline__meta,
	.now-timeline__body-text {
		margin: 0.85rem 0 0;
	}

	.now-timeline__lede,
	.now-timeline__body-text {
		font-size: 1rem;
		line-height: 1.68;
		color: var(--muted);
	}

	.now-timeline__meta {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.now-timeline__lede--compact {
		margin-top: 0.55rem;
	}

	.now-timeline__feature {
		margin: 1rem 0 0;
	}

	.now-timeline__feature img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.85rem;
	}

	.now-checkin-map {
		margin-top: 1rem;
	}

	.now-checkin-map :global(.checkin-map__frame--leaflet) {
		height: clamp(14rem, 30vw, 18rem);
		border-radius: 0.85rem;
	}

	.now-media-entry {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		gap: 1rem;
		margin-top: 1rem;
		align-items: start;
	}

	.now-media-entry__cover {
		min-width: 0;
	}

	.now-media-entry__art {
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 0.85rem;
	}

	.now-media-entry__fallback {
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

	.now-media-entry__body {
		min-width: 0;
	}

	.now-media-entry__audio {
		margin-top: 0.85rem;
	}

	.now-media-entry__audio audio {
		display: block;
		width: 100%;
	}

	.now-timeline__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.now-timeline__action {
		text-decoration: none;
	}

	@media (max-width: 640px) {
		.now-index-row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.7rem;
		}

		.now-index-row__main {
			grid-template-columns: 7.75rem minmax(0, 1fr);
			column-gap: 0.6rem;
		}

		.now-timeline__entry {
			display: block;
			padding-left: 0;
		}

		.now-timeline__entry + .now-timeline__entry {
			margin-top: 2.4rem;
		}

		.now-timeline::before {
			display: none;
		}

		.now-timeline__meta-column {
			margin-bottom: 0.45rem;
		}

		.now-timeline__date {
			position: static;
			padding-top: 0;
			font-size: 0.78rem;
		}

		.now-timeline__rail {
			display: none;
		}

		.now-timeline__dot {
			display: none;
		}

		.now-media-entry {
			grid-template-columns: 1fr;
			gap: 0.95rem;
		}

		.now-media-entry__cover {
			max-width: none;
			width: 100%;
		}

		.now-media-entry__art,
		.now-media-entry__fallback {
			width: 100%;
			max-width: none;
		}

		.now-checkin-map :global(.checkin-map__frame--leaflet) {
			height: 12.5rem;
		}
	}
</style>
