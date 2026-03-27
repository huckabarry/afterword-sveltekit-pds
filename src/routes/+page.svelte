<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { formatDate } from '$lib/format';
	import type { StatusPost } from '$lib/server/atproto';
	import type { BlogPost } from '$lib/server/ghost';

	let {
		data
	}: {
		data: { statuses: StatusPost[]; planningPosts: BlogPost[]; fieldNotesPosts: BlogPost[] };
	} = $props();
	let currentStatusIndex = $state(0);
	let activeCardEl = $state<HTMLElement | null>(null);
	let cardHeight = $state<number | null>(null);
	let resizeObserver: ResizeObserver | null = null;

	function showPreviousStatus() {
		if (!data.statuses.length) return;
		currentStatusIndex =
			(currentStatusIndex - 1 + data.statuses.length) % data.statuses.length;
	}

	function showNextStatus() {
		if (!data.statuses.length) return;
		currentStatusIndex = (currentStatusIndex + 1) % data.statuses.length;
	}

	function statusUrl(slug: string) {
		return `/status/${slug}`;
	}

	function blogUrl(slug: string) {
		return `/blog/${slug}`;
	}

	async function syncCardHeight() {
		await tick();
		cardHeight = activeCardEl?.offsetHeight ?? null;
	}

	onMount(() => {
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				cardHeight = activeCardEl?.offsetHeight ?? null;
			});
		}

		return () => {
			resizeObserver?.disconnect();
		};
	});

	$effect(() => {
		currentStatusIndex;
		syncCardHeight();
	});

	$effect(() => {
		if (activeCardEl && resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver.observe(activeCardEl);
			cardHeight = activeCardEl.offsetHeight;
		}
	});
</script>

<svelte:head>
	<title>Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<div class="stream-head__lede">
		<p>
			Urban planner, photographer, gardener, and habitual maker of things. I use this
			space for short updates, photos, and longer reflections on place, music, design, and
			daily life. If you've found your way here and want to say hello, I'd love to hear from
			you.
		</p>
	</div>
</section>

<div class="section-stack">
	<section class="section-block section-block-status">
		<div class="section-head">
			<h2 class="section-title">Recent Updates</h2>
			{#if data.statuses.length > 1}
				<div class="home-updates__controls">
					<button class="home-updates__button" type="button" onclick={showPreviousStatus}>
						Back
					</button>
					<button class="home-updates__button" type="button" onclick={showNextStatus}>
						Next
					</button>
				</div>
			{/if}
		</div>

		{#if data.statuses.length}
			<div
				class="home-updates section-block-status__card"
				style:height={cardHeight ? `${cardHeight}px` : undefined}
			>
				{#each data.statuses as post, index}
					{#if index === currentStatusIndex}
						<article class="status-row" bind:this={activeCardEl}>
							<div class="status-row__avatar">
								{#if post.avatar}
									<img src={post.avatar} alt={post.displayName} loading="lazy" />
								{/if}
							</div>
							<div class="status-row__body">
								<div class="status-row__meta">
									<div class="status-row__byline">
										<span class="status-row__name">{post.displayName}</span>
										<span class="status-row__handle">{post.handle}</span>
										<span>·</span>
										<span>{formatDate(post.date)}</span>
									</div>
								</div>
								<a class="status-row__permalink" href={statusUrl(post.slug)}>
									<div class="status-row__content">
										{@html post.html}
									</div>
								</a>
								{#if post.images.length}
									<div class="status-row__media {post.images.length > 1 ? 'status-row__media--multi' : ''}">
										{#each post.images as image}
											<a class="status-row__image" href={statusUrl(post.slug)}>
												<img src={image.thumb} alt={image.alt || 'Status image'} loading="lazy" />
											</a>
										{/each}
									</div>
								{/if}
								{#if post.external}
									<a class="status-card" href={post.external.uri} target="_blank" rel="noreferrer">
										<span class="status-card__domain">{post.external.domain}</span>
										<strong class="status-card__title">{post.external.title}</strong>
										{#if post.external.description}
											<span class="status-card__description">{post.external.description}</span>
										{/if}
									</a>
								{/if}
								<div class="status-row__actions status-row__actions--compact">
									<div class="status-row__metrics">
										<a class="status-row__action" href={statusUrl(post.slug)}>
											<span class="status-row__icon" aria-hidden="true">
												<svg viewBox="0 0 24 24" focusable="false">
													<path d="M6.37 3.93c.53-.51 1.28-.83 2.35-.83h8.03c1.07 0 1.82.32 2.35.83.51.49.83 1.18.83 2.18v5.78c0 1-.32 1.69-.83 2.18-.53.51-1.28.83-2.35.83h-2.84l-4.1 4.1c-.24.24-.49.36-.79.36-.57 0-1.01-.42-1.01-.99V14.9H8.72c-1.07 0-1.82-.32-2.35-.83-.51-.49-.83-1.18-.83-2.18V6.11c0-1 .32-1.69.83-2.18Zm2.35.77c-.72 0-1.05.2-1.25.39-.18.17-.33.45-.33 1.02v5.78c0 .57.15.85.33 1.02.2.19.53.39 1.25.39h1.95v3.07l3.07-3.07h3.03c.72 0 1.05-.2 1.25-.39.18-.17.33-.45.33-1.02V6.11c0-.57-.15-.85-.33-1.02-.2-.19-.53-.39-1.25-.39H8.72Z"></path>
												</svg>
											</span>
											<span>{post.replyCount}</span>
										</a>
										<a class="status-row__action" href={statusUrl(post.slug)}>
											<span class="status-row__icon" aria-hidden="true">
												<svg viewBox="0 0 24 24" focusable="false">
													<path d="M5.05 4.86a.75.75 0 0 1 1.06 0l2.76 2.76a.75.75 0 1 1-1.06 1.06L6.33 7.2v7.05c0 .7.17 1.12.45 1.39.27.27.69.45 1.39.45h5.5a.75.75 0 0 1 0 1.5h-5.5c-1.02 0-1.87-.28-2.45-.86-.58-.58-.89-1.43-.89-2.48V7.2L3.99 8.68a.75.75 0 1 1-1.06-1.06l2.12-2.12Zm13.9 10.46a.75.75 0 0 1 1.06 1.06l-2.76 2.76a.75.75 0 0 1-1.06 0l-2.76-2.76a.75.75 0 1 1 1.06-1.06l1.48 1.48V9.75c0-.7-.17-1.12-.45-1.39-.27-.27-.69-.45-1.39-.45h-5.5a.75.75 0 0 1 0-1.5h5.5c1.02 0 1.87.28 2.45.86.58.58.89 1.43.89 2.48v7.05l1.48-1.48Z"></path>
												</svg>
											</span>
											<span>{post.repostCount}</span>
										</a>
										<a class="status-row__action" href={statusUrl(post.slug)}>
											<span class="status-row__icon" aria-hidden="true">
												<svg viewBox="0 0 24 24" focusable="false">
													<path d="M16.72 3.8c2.87 0 4.93 2.16 4.93 5.13 0 1.89-.77 3.32-2.08 4.7-1.28 1.35-3.09 2.71-5.17 4.28l-1.89 1.43a.82.82 0 0 1-1 0l-1.89-1.43c-2.08-1.57-3.89-2.93-5.17-4.28-1.31-1.38-2.08-2.81-2.08-4.7 0-2.97 2.06-5.13 4.93-5.13 1.79 0 3.03.89 3.83 1.83.35.41.64.85.87 1.25.23-.4.52-.84.87-1.25.8-.94 2.04-1.83 3.83-1.83Zm0 1.6c-1.19 0-2.02.56-2.61 1.25-.61.71-.96 1.53-1.12 2.03a.82.82 0 0 1-1.56 0c-.16-.5-.51-1.32-1.12-2.03-.59-.69-1.42-1.25-2.61-1.25-1.88 0-3.33 1.38-3.33 3.53 0 1.33.51 2.38 1.64 3.57 1.15 1.21 2.82 2.47 4.94 4.08L12 17.68l1.84-1.39c2.12-1.61 3.79-2.87 4.94-4.08 1.13-1.19 1.64-2.24 1.64-3.57 0-2.15-1.45-3.53-3.33-3.53Z"></path>
												</svg>
											</span>
											<span>{post.likeCount}</span>
										</a>
									</div>
									<a
										class="status-row__action status-row__action--bsky"
										href={post.blueskyUrl}
										target="_blank"
										rel="noreferrer"
										aria-label="Open on Bluesky"
									>
										<span class="status-row__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" focusable="false">
												<path d="M5.69 4.78c2.35 1.76 4.88 5.33 5.81 7.27.93-1.94 3.46-5.51 5.81-7.27 1.69-1.27 4.43-2.26 4.43.87 0 .63-.36 5.29-.57 6.05-.72 2.66-3.35 3.34-5.69 2.94 4.09.7 5.13 3.04 2.88 5.39-4.27 4.46-6.14-1.12-6.62-2.55-.09-.26-.13-.38-.24-.38s-.15.12-.24.38c-.48 1.43-2.35 7.01-6.62 2.55-2.25-2.35-1.21-4.69 2.88-5.39-2.34.4-4.97-.28-5.69-2.94-.21-.76-.57-5.42-.57-6.05 0-3.13 2.74-2.14 4.43-.87Z"></path>
											</svg>
										</span>
									</a>
								</div>
							</div>
						</article>
					{/if}
				{/each}
			</div>
			<div class="home-updates__position-row" aria-hidden="true">
				<span class="status-row__position">{currentStatusIndex + 1} / {data.statuses.length}</span>
			</div>
			<div class="home-stream-tags">
				<a class="tag-pill" href="/status">Status</a>
				<a class="home-updates__more-link" href="/status">Read more status updates <span aria-hidden="true">→</span></a>
			</div>
		{:else}
			<p class="empty-state">No status posts are available yet.</p>
		{/if}
	</section>

	<section class="section-block section-block-writing">
		<h2 class="section-title">Field Notes</h2>
		{#if data.fieldNotesPosts.length}
			<section class="blog-list">
				{#each data.fieldNotesPosts as post}
					<article class="blog-row">
						<a class="blog-row__link" href={blogUrl(post.slug)}>
							<time class="blog-row__date" datetime={post.publishedAt.toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
							<h3>{post.title}</h3>
							<p>{post.excerpt}</p>
						</a>
					</article>
				{/each}
			</section>
			<div class="home-stream-tags">
				<a class="tag-pill" href="/tags/field-notes">Field Notes</a>
				<a class="home-updates__more-link" href="/field-notes">Read more field notes <span aria-hidden="true">→</span></a>
			</div>
		{:else}
			<p class="empty-state">No field notes are available yet.</p>
		{/if}
	</section>

	<section class="section-block section-block-writing">
		<h2 class="section-title">Planning & Urbanism</h2>
		{#if data.planningPosts.length}
			<section class="blog-list">
				{#each data.planningPosts as post}
					<article class="blog-row">
						<a class="blog-row__link" href={blogUrl(post.slug)}>
							<time class="blog-row__date" datetime={post.publishedAt.toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
							<h3>{post.title}</h3>
							<p>{post.excerpt}</p>
						</a>
					</article>
				{/each}
			</section>
			<div class="home-stream-tags">
				<a class="tag-pill" href="/tags/urbanism">Urbanism</a>
				<a class="home-updates__more-link" href="/planning">Read more planning & urbanism posts <span aria-hidden="true">→</span></a>
			</div>
		{:else}
			<p class="empty-state">No planning posts are available yet.</p>
		{/if}
	</section>

</div>

<style>
	.stream-head {
		margin-top: 0.1rem;
	}

	.section-block-status {
		margin-top: 1.2rem;
	}

	.section-head {
		margin-bottom: 1.2rem;
	}

	.section-block-status__card {
		transition: height 180ms ease;
	}

	.section-block-status__card .status-row {
		grid-template-columns: 1fr;
		padding-bottom: 0.8rem;
	}

	.section-block-status__card .status-row__avatar {
		display: none;
	}

	.section-block-status__card .status-row__image img {
		height: 18rem;
		object-fit: cover;
	}

	.section-block-status__card .status-row__media:not(.status-row__media--multi) .status-row__image {
		background: transparent;
	}

	.section-block-status__card .status-row__media:not(.status-row__media--multi) .status-row__image img {
		height: auto;
		max-height: none;
		object-fit: initial;
		background: transparent;
	}

	.section-block-status__card .status-row__media--multi .status-row__image img {
		height: 9rem;
	}

	.empty-state {
		margin: 0;
		color: var(--muted);
	}

	.status-row__position {
		display: inline-flex;
		align-items: center;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1;
	}

	.home-updates__position-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
		padding-right: 0.15rem;
	}

	@media (max-width: 640px) {
		.section-head {
			align-items: center;
			flex-direction: row;
			flex-wrap: wrap;
		}

		.section-block-status__card .status-row__image img {
			height: auto;
		}

		.home-updates__controls {
			margin-left: auto;
		}
	}
</style>
