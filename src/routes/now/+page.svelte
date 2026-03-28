<script lang="ts">
	import type { Checkin } from '$lib/server/atproto';
	import type { BlogPost } from '$lib/server/ghost';
	import type { AlbumEntry, TrackEntry } from '$lib/server/music';

	type TimelineLink = {
		label: string;
		url: string;
		external?: boolean;
	};

	type TimelineItem = {
		id: string;
		label: string;
		title: string;
		href: string;
		date: Date;
		dateLabel: string;
		summary: string;
		meta: string;
		imageUrl: string | null;
		imageAlt: string;
		tags: string[];
		audioUrl: string | null;
		links: TimelineLink[];
	};

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

	function getPostTimelineLabel(post: BlogPost) {
		if (post.tags.includes('books') || post.tags.includes('book-reviews')) {
			return 'Book';
		}

		if (
			post.tags.includes('gallery') ||
			post.tags.includes('hash-gallery') ||
			post.tags.includes('photography')
		) {
			return 'Photo Note';
		}

		return 'Now';
	}

	function getPostTimelineTags(post: BlogPost) {
		return (post.tags || [])
			.filter(
				(tag) =>
					tag &&
					!tag.startsWith('hash-') &&
					tag !== 'now' &&
					tag !== 'books' &&
					tag !== 'book-reviews'
			)
			.slice(0, 3)
			.map(formatTagLabel);
	}

	function toPostTimelineItem(post: BlogPost): TimelineItem {
		const isBook = post.tags.includes('books') || post.tags.includes('book-reviews');
		const summary = post.excerpt || summarize(post.html);

		return {
			id: `post-${post.slug}`,
			label: getPostTimelineLabel(post),
			title: post.title,
			href: post.path,
			date: post.publishedAt,
			dateLabel: formatTimelineDate(post.publishedAt),
			summary,
			meta: '',
			imageUrl: post.coverImage || null,
			imageAlt: post.title,
			tags: getPostTimelineTags(post),
			audioUrl: null,
			links: [
				{
					label: isBook ? 'Read note' : 'Read post',
					url: post.path
				}
			]
		};
	}

	function toCheckinTimelineItem(checkin: Checkin): TimelineItem {
		return {
			id: `checkin-${checkin.slug}`,
			label: 'Check-In',
			title: checkin.name,
			href: checkin.canonicalPath,
			date: checkin.visitedAt,
			dateLabel: formatTimelineDate(checkin.visitedAt),
			summary: summarize(checkin.excerpt || checkin.note || checkin.place || ''),
			meta: checkin.place || checkin.venueCategory || '',
			imageUrl: checkin.coverImage || checkin.photoUrls[0] || null,
			imageAlt: checkin.name,
			tags: (checkin.tags || []).slice(0, 3).map(formatTagLabel),
			audioUrl: null,
			links: [
				{ label: 'View check-in', url: checkin.canonicalPath },
				{ label: 'All check-ins', url: '/check-ins' }
			]
		};
	}

	function toTrackTimelineItem(track: TrackEntry): TimelineItem {
		return {
			id: `track-${track.slug}`,
			label: 'Listening',
			title: track.trackTitle,
			href: track.localPath,
			date: track.publishedAt,
			dateLabel: formatTimelineDate(track.publishedAt),
			summary: summarize(track.note || ''),
			meta: track.artist,
			imageUrl: track.artworkUrl || null,
			imageAlt: `${track.trackTitle} by ${track.artist}`,
			tags: [],
			audioUrl: track.previewUrl || null,
			links: [
				{ label: 'Track note', url: track.localPath },
				...track.listenLinks.slice(0, 3).map((link) => ({
					label: link.label,
					url: link.url,
					external: true
				}))
			]
		};
	}

	function toAlbumTimelineItem(album: AlbumEntry): TimelineItem {
		return {
			id: `album-${album.slug}`,
			label: 'Album Rotation',
			title: album.albumTitle,
			href: album.localPath,
			date: album.publishedAt,
			dateLabel: formatTimelineDate(album.publishedAt),
			summary: summarize(album.note || ''),
			meta: album.artist,
			imageUrl: album.coverImage || null,
			imageAlt: `${album.albumTitle} by ${album.artist}`,
			tags: [],
			audioUrl: null,
			links: [
				{ label: 'Album note', url: album.localPath },
				...album.listenLinks.slice(0, 3).map((link) => ({
					label: link.label,
					url: link.url,
					external: true
				}))
			]
		};
	}

	function getTimelineItems() {
		return [
			...data.nowPosts.map(toPostTimelineItem),
			...data.bookPosts.map(toPostTimelineItem),
			...data.checkins.map(toCheckinTimelineItem),
			...data.tracks.map(toTrackTimelineItem),
			...data.albums.map(toAlbumTimelineItem)
		]
			.sort((a, b) => b.date.getTime() - a.date.getTime())
			.slice(0, 12);
	}

	let timelineItems = $derived.by(() => getTimelineItems());
	let indexItems = $derived.by(() => timelineItems.slice(0, 8));
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
		<ol class="now-index" aria-label="Current threads">
			{#each indexItems as item}
				<li class="now-index__row">
					<a class="now-index__item" href={`#${item.id}`}>
						<time class="now-index__date" datetime={item.date.toISOString()}>
							{item.dateLabel}
						</time>
						<span class="now-index__rail" aria-hidden="true">
							<span class="now-index__dot"></span>
						</span>
						<div class="now-index__body">
							<span class="now-index__label">{item.label}</span>
							<strong class="now-index__title">{item.title}</strong>
							<div class:now-index__detail--thumb={Boolean(item.imageUrl)} class="now-index__detail">
								{#if item.imageUrl}
									<img class="now-index__thumb" src={item.imageUrl} alt={item.imageAlt} />
								{/if}
								{#if item.summary}
									<p class="now-index__summary">{item.summary}</p>
								{/if}
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ol>
	</section>
{/if}

{#if timelineItems.length}
	<section class="section-block">
		<div class="now-flow" aria-label="Now timeline">
			{#each timelineItems as item}
				<article class="now-flow__entry" id={item.id}>
					<div class="now-flow__date-column">
						<time class="now-flow__date" datetime={item.date.toISOString()}>
							{item.dateLabel}
						</time>
					</div>
					<div class="now-flow__rail" aria-hidden="true">
						<span class="now-flow__dot"></span>
					</div>
					<div class="now-flow__content">
						<div class="now-flow__kicker-row">
							<span class="now-flow__kicker">{item.label}</span>
							{#if item.meta}
								<span class="now-flow__meta">{item.meta}</span>
							{/if}
						</div>

						<h2 class="now-flow__title">
							<a href={item.href}>{item.title}</a>
						</h2>

						{#if item.tags.length}
							<div class="now-flow__tags">
								{#each item.tags as tag}
									<span class="tag-pill">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if item.imageUrl}
							<a class="now-flow__media-link" href={item.href}>
								<img class="now-flow__media" src={item.imageUrl} alt={item.imageAlt} />
							</a>
						{/if}

						{#if item.summary}
							<p class="now-flow__summary">{item.summary}</p>
						{/if}

						{#if item.audioUrl}
							<div class="now-flow__audio">
								<audio controls preload="none" src={item.audioUrl} aria-label={`Preview ${item.title}`}></audio>
							</div>
						{/if}

						{#if item.links.length}
							<div class="now-flow__actions">
								{#each item.links as link}
									<a
										class="tag-pill now-flow__action"
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
				</article>
			{/each}
		</div>
	</section>
{/if}

<style>
	.now-index {
		list-style: none;
		margin: 0;
		padding: 0;
		position: relative;
	}

	.now-index__row + .now-index__row {
		margin-top: 0.95rem;
	}

	.now-index__item {
		display: grid;
		grid-template-columns: 5.5rem 1.2rem minmax(0, 1fr);
		gap: 0.85rem;
		align-items: start;
		padding: 0.2rem 0;
		text-decoration: none;
		color: inherit;
		transition: opacity 140ms ease;
	}

	.now-index__item:hover,
	.now-index__item:focus-visible {
		opacity: 0.86;
	}

	.now-index__date,
	.now-flow__date {
		font-size: 0.8rem;
		line-height: 1.35;
		color: var(--muted);
	}

	.now-index__date {
		padding-top: 0.15rem;
	}

	.now-index__body,
	.now-flow__content {
		min-width: 0;
	}

	.now-index__rail,
	.now-flow__rail {
		position: relative;
		display: block;
		min-height: 100%;
	}

	.now-index__rail::before,
	.now-flow__rail::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		width: 1px;
		background: color-mix(in srgb, var(--line) 82%, transparent 18%);
		transform: translateX(-50%);
	}

	.now-index__rail::before {
		bottom: -1.1rem;
	}

	.now-index__row:last-child .now-index__rail::before {
		bottom: 0.2rem;
	}

	.now-index__dot,
	.now-flow__dot {
		position: absolute;
		left: 50%;
		width: 0.58rem;
		height: 0.58rem;
		border-radius: 999px;
		background: var(--surface);
		border: 2px solid color-mix(in srgb, var(--accent) 45%, var(--line) 55%);
		transform: translateX(-50%);
	}

	.now-index__dot {
		top: 0.42rem;
	}

	.now-index__label,
	.now-flow__kicker {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.now-index__label {
		margin-bottom: 0.18rem;
	}

	.now-index__title,
	.now-flow__title {
		display: block;
		font-family: 'Fira Sans', sans-serif;
		line-height: 1.18;
	}

	.now-index__title {
		font-size: 1.08rem;
	}

	.now-index__detail {
		margin-top: 0.45rem;
	}

	.now-index__detail--thumb {
		display: grid;
		grid-template-columns: 4.35rem minmax(0, 1fr);
		gap: 0.7rem;
		align-items: start;
	}

	.now-index__thumb {
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
	}

	.now-index__summary {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.now-flow {
		position: relative;
	}

	.now-flow__entry {
		display: grid;
		grid-template-columns: 5.5rem 1.2rem minmax(0, 1fr);
		gap: 0.95rem;
		align-items: start;
	}

	.now-flow__entry + .now-flow__entry {
		margin-top: 2.4rem;
	}

	.now-flow__date-column {
		position: relative;
	}

	.now-flow__date {
		position: sticky;
		top: 5.5rem;
		display: inline-block;
		padding-top: 0.15rem;
	}

	.now-flow__rail::before {
		bottom: -2.5rem;
	}

	.now-flow__entry:last-child .now-flow__rail::before {
		bottom: 0;
	}

	.now-flow__dot {
		top: 0.46rem;
	}

	.now-flow__kicker-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 0.42rem;
	}

	.now-flow__meta {
		font-size: 0.9rem;
		color: var(--muted);
	}

	.now-flow__title {
		margin: 0;
		font-size: clamp(1.25rem, 2.3vw, 1.72rem);
	}

	.now-flow__title a {
		color: inherit;
		text-decoration: none;
	}

	.now-flow__title a:hover,
	.now-flow__title a:focus-visible {
		color: var(--accent);
	}

	.now-flow__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.72rem;
	}

	.now-flow__media-link {
		display: block;
		margin-top: 1rem;
		text-decoration: none;
	}

	.now-flow__media {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.9rem;
		background: color-mix(in srgb, var(--surface) 86%, white 14%);
	}

	.now-flow__summary {
		margin: 0.95rem 0 0;
		font-size: 1rem;
		line-height: 1.68;
		color: var(--muted);
	}

	.now-flow__audio {
		margin-top: 0.95rem;
	}

	.now-flow__audio audio {
		display: block;
		width: 100%;
	}

	.now-flow__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.95rem;
	}

	.now-flow__action {
		text-decoration: none;
	}

	@media (max-width: 640px) {
		.now-index__item,
		.now-flow__entry {
			grid-template-columns: 4.25rem 1rem minmax(0, 1fr);
			gap: 0.72rem;
		}

		.now-index__detail--thumb {
			grid-template-columns: 3.4rem minmax(0, 1fr);
		}

		.now-flow__date {
			top: 4.8rem;
		}

		.now-flow__entry + .now-flow__entry {
			margin-top: 1.9rem;
		}
	}
</style>
