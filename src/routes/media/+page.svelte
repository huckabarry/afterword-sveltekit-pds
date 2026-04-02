<script lang="ts">
	import type { MediaTimelineItem, MediaTimelinePage } from '$lib/types/media-timeline';

	let {
		data
	}: {
		data: {
			intro: {
				title: string;
				description: string;
				paragraphs: string[];
			};
			initialTimelinePage: MediaTimelinePage;
		};
	} = $props();

	const initialPageSize = 20;

	let timelineItems = $state<MediaTimelineItem[]>([]);
	let nextOffset = $state<number | null>(null);
	let totalItems = $state<number | null>(null);
	let pageSize = $state(initialPageSize);
	let isLoadingInitial = $state(false);
	let isLoadingMore = $state(false);
	let loadError = $state('');
	let imageOverrides = $state<Record<string, string | null>>({});
	let hiddenImages = $state<Record<string, boolean>>({});
	let hasInitialized = false;

	$effect(() => {
		if (hasInitialized) {
			return;
		}

		hasInitialized = true;
		timelineItems = data.initialTimelinePage.items;
		nextOffset = data.initialTimelinePage.nextOffset;
		totalItems = data.initialTimelinePage.total;
		pageSize = data.initialTimelinePage.limit || initialPageSize;
	});

	function usesPosterRatio(item: MediaTimelineItem) {
		return item.kind === 'popfeed' && (item.mediaType === 'movie' || item.mediaType === 'tv_show');
	}

	function isBookPopfeed(item: MediaTimelineItem) {
		return item.kind === 'popfeed' && item.mediaType === 'book';
	}

	function getItemImageUrl(item: MediaTimelineItem) {
		return imageOverrides[item.id] ?? item.imageUrl;
	}

	function handleImageError(item: MediaTimelineItem) {
		const currentImageUrl = imageOverrides[item.id] ?? item.imageUrl;

		if (item.fallbackImageUrl && currentImageUrl !== item.fallbackImageUrl) {
			imageOverrides = {
				...imageOverrides,
				[item.id]: item.fallbackImageUrl
			};
			return;
		}

		hiddenImages = {
			...hiddenImages,
			[item.id]: true
		};
	}

	function infiniteLoad(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					void loadMore();
				}
			},
			{
				rootMargin: '320px 0px'
			}
		);

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	async function fetchPage(offset: number, mode: 'initial' | 'more') {
		if (mode === 'more' && (isLoadingMore || nextOffset === null)) {
			return;
		}

		if (mode === 'initial') {
			isLoadingInitial = true;
		} else {
			isLoadingMore = true;
		}
		loadError = '';

		try {
			const response = await fetch(
				`/media/timeline.json?offset=${encodeURIComponent(String(offset))}&limit=${encodeURIComponent(String(pageSize))}`
			);

			if (!response.ok) {
				throw new Error(`Timeline request failed with ${response.status}`);
			}

			const page = (await response.json()) as MediaTimelinePage;
			timelineItems = mode === 'initial' ? page.items : [...timelineItems, ...page.items];
			nextOffset = page.nextOffset;
			totalItems = page.total;
			pageSize = page.limit;
		} catch (error) {
			loadError =
				error instanceof Error
					? error.message
					: mode === 'initial'
						? 'Unable to load the media timeline.'
						: 'Unable to load more media items.';
		} finally {
			if (mode === 'initial') {
				isLoadingInitial = false;
			} else {
				isLoadingMore = false;
			}
		}
	}

	async function loadMore() {
		if (nextOffset === null) {
			return;
		}

		await fetchPage(nextOffset, 'more');
	}
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

{#if isLoadingInitial}
	<section class="section-block">
		<p class="page-head__lede">Loading media timeline…</p>
	</section>
{:else if timelineItems.length}
	<section class="section-block">
		<div class="media-timeline" aria-label="Media timeline">
			{#each timelineItems as item (item.id)}
				<article class="media-timeline__entry" id={item.id}>
					<div class="media-timeline__meta-column">
						<time class="media-timeline__date" datetime={item.dateIso}>
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

						{#if item.kind === 'track'}
							<div class="media-entry media-entry--track">
								<a class="media-entry__cover media-entry__cover--mini" href={item.href}>
									{#if getItemImageUrl(item) && !hiddenImages[item.id]}
										<img
											class="media-entry__art media-entry__art--mini"
											src={getItemImageUrl(item) || ''}
											alt={item.imageAlt}
											loading="lazy"
											onerror={() => handleImageError(item)}
										/>
									{:else}
										<div
											class="media-entry__fallback media-entry__fallback--mini"
											aria-hidden="true"
										>
											Track
										</div>
									{/if}
								</a>

								<div class="media-entry__mini-player">
									<div class="media-entry__body">
										<div class="media-entry__heading">
											<h2
												class="media-timeline__title media-timeline__title--media media-timeline__title--mini"
											>
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

									{#if item.audioUrl}
										<div class="media-entry__audio media-entry__audio--mini">
											<audio
												controls
												preload="none"
												src={item.audioUrl}
												aria-label={`Preview ${item.title}`}
											></audio>
										</div>
									{/if}

									{#if item.summary}
										<p
											class="media-timeline__lede media-timeline__lede--compact media-timeline__lede--mini"
										>
											{item.summary}
										</p>
									{/if}

									{#if item.links.length}
										<div class="media-timeline__actions media-timeline__actions--mini">
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

									{#if item.activityLabel}
										<p class="media-timeline__meta media-timeline__meta--status">
											Latest update: {item.activityLabel}
										</p>
									{/if}
								</div>

								{#if !isBookPopfeed(item) && getItemImageUrl(item) && !hiddenImages[item.id]}
									<a
										class={`media-entry__cover media-entry__cover--full ${usesPosterRatio(item) ? 'media-entry__cover--poster' : 'media-entry__cover--natural'}`}
										href={item.href}
									>
										<img
											class={`media-entry__art ${usesPosterRatio(item) ? 'media-entry__art--poster' : 'media-entry__art--natural'}`}
											src={getItemImageUrl(item) || ''}
											alt={item.imageAlt}
											loading="lazy"
											onerror={() => handleImageError(item)}
										/>
									</a>
								{:else if !isBookPopfeed(item)}
									<a
										class={`media-entry__cover media-entry__cover--full ${usesPosterRatio(item) ? 'media-entry__cover--poster' : 'media-entry__cover--natural'}`}
										href={item.href}
									>
										<div
											class={`media-entry__fallback ${usesPosterRatio(item) ? 'media-entry__fallback--poster' : 'media-entry__fallback--natural'}`}
											aria-hidden="true"
										>
											{item.label}
										</div>
									</a>
								{/if}

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
									{#if getItemImageUrl(item) && !hiddenImages[item.id]}
										<img
											class="media-entry__art"
											src={getItemImageUrl(item) || ''}
											alt={item.imageAlt}
											loading="lazy"
											onerror={() => handleImageError(item)}
										/>
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

		<div class="media-timeline__footer">
			{#if totalItems !== null}
				<p class="media-timeline__status">Showing {timelineItems.length} of {totalItems} items</p>
			{/if}

			{#if nextOffset !== null}
				<div class="media-timeline__load-more" use:infiniteLoad>
					<button
						class="tag-pill media-timeline__load-button"
						type="button"
						disabled={isLoadingMore}
						onclick={loadMore}
					>
						{isLoadingMore ? 'Loading more…' : 'Load more'}
					</button>
				</div>
			{/if}

			{#if loadError}
				<p class="media-timeline__error">{loadError}</p>
			{/if}
		</div>
	</section>
{:else}
	<section class="section-block">
		<p class="page-head__lede">{loadError || 'No media notes are available yet.'}</p>
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

	.media-timeline__meta--status {
		margin-top: 0.35rem;
		font-size: 0.88rem;
		color: color-mix(in srgb, var(--accent) 70%, var(--muted) 30%);
	}

	.media-timeline__lede--compact {
		margin-top: 0.55rem;
	}

	.media-timeline__lede--mini {
		font-size: 0.95rem;
		line-height: 1.55;
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

	.media-entry--track {
		grid-template-columns: minmax(4.9rem, 5.5rem) minmax(0, 1fr);
		gap: 0.95rem;
		padding: 0.95rem;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--surface) 78%, white 22%);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent);
	}

	.media-entry__mini-player {
		display: grid;
		gap: 0.65rem;
		min-width: 0;
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

	.media-timeline__title--mini {
		font-size: clamp(1rem, 1.65vw, 1.18rem);
		line-height: 1.2;
	}

	.media-entry__cover {
		display: block;
		width: 100%;
		text-decoration: none;
		color: inherit;
	}

	.media-entry__cover--mini {
		width: 100%;
		align-self: start;
	}

	.media-entry__art {
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 0.85rem;
	}

	.media-entry__art--mini {
		aspect-ratio: 1 / 1;
		border-radius: 0.95rem;
		box-shadow: 0 0.7rem 1.5rem rgba(0, 0, 0, 0.16);
	}

	.media-entry__art--poster {
		aspect-ratio: 2 / 3;
	}

	.media-entry__art--natural {
		aspect-ratio: auto;
		height: auto;
		object-fit: contain;
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

	.media-entry__fallback--mini {
		border-radius: 0.95rem;
		font-size: 0.74rem;
	}

	.media-entry__fallback--poster {
		aspect-ratio: 2 / 3;
	}

	.media-entry__fallback--natural {
		aspect-ratio: auto;
		min-height: 14rem;
	}

	.media-entry__audio {
		margin-top: 0.85rem;
	}

	.media-entry__audio audio {
		display: block;
		width: 100%;
	}

	.media-entry__audio--mini {
		margin-top: 0;
	}

	.media-entry__audio--mini audio {
		height: 2.2rem;
	}

	.media-timeline__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.media-timeline__actions--mini {
		margin-top: 0.1rem;
	}

	.media-timeline__action {
		text-decoration: none;
	}

	.media-timeline__footer {
		margin-top: 2rem;
		display: grid;
		gap: 0.75rem;
		justify-items: start;
	}

	.media-timeline__status,
	.media-timeline__error {
		margin: 0;
		color: var(--muted);
	}

	.media-timeline__load-more {
		display: flex;
		align-items: center;
	}

	.media-timeline__load-button:disabled {
		opacity: 0.65;
		cursor: wait;
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

		.media-entry--track {
			grid-template-columns: 4.4rem minmax(0, 1fr);
			padding: 0.85rem;
		}
	}
</style>
