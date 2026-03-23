<script lang="ts">
	import { formatDate } from '$lib/format';
	import type { StatusPost } from '$lib/server/atproto';
	import { browser } from '$app/environment';

	let { data }: { data: { statuses: StatusPost[] } } = $props();
	const siteOrigin = browser ? window.location.origin : '';

	function openFediverseReply(targetUrl: string) {
		if (!browser) return;

		const input = window.prompt('Enter your Mastodon or fediverse instance domain', 'mastodon.social');
		const normalized = String(input || '')
			.trim()
			.replace(/^https?:\/\//, '')
			.replace(/\/+$/, '');

		if (!normalized) return;

		window.open(
			`https://${normalized}/authorize_interaction?uri=${encodeURIComponent(targetUrl)}`,
			'_blank',
			'noreferrer'
		);
	}
</script>

<svelte:head>
	<title>Status | Afterword PDS Lab</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Status Updates</h1>
</section>

<section class="status-list">
	{#each data.statuses as post}
		<article class="status-row h-entry">
			<div class="status-row__avatar h-card">
				{#if post.avatar}
					<img class="u-photo" src={post.avatar} alt={post.displayName} loading="lazy" />
				{/if}
			</div>
			<div class="status-row__body">
				{#if post.replyTo}
					<p class="status-row__reply-context">
						In reply to
						<a href={post.replyTo.blueskyUrl} target="_blank" rel="noreferrer">
							{post.replyTo.displayName || post.replyTo.handle}
						</a>
					</p>
				{/if}
				<div class="status-row__meta">
					<div class="status-row__byline">
						<span class="status-row__name p-author h-card">
							<span class="p-name">{post.displayName}</span>
							<span class="u-url" hidden>{post.blueskyUrl}</span>
						</span>
						<span class="status-row__handle p-nickname">{post.handle}</span>
						<span>·</span>
						<time class="dt-published" datetime={new Date(post.date).toISOString()}>{formatDate(post.date)}</time>
					</div>
				</div>
				<a class="status-row__permalink u-url" href={`/status/${post.slug}`}>
					<div class="status-row__content e-content">
						{@html post.html}
					</div>
				</a>
				{#if post.images.length}
					<div class="status-row__media {post.images.length > 1 ? 'status-row__media--multi' : ''}">
						{#each post.images as image}
							<a class="status-row__image" href={`/status/${post.slug}`}>
								<img src={image.thumb} alt={image.alt || 'Bluesky image'} loading="lazy" />
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
				<div class="status-row__actions">
					<div class="status-row__metrics">
						<a class="status-row__action" href={`/status/${post.slug}`}>
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M6.37 3.93c.53-.51 1.28-.83 2.35-.83h8.03c1.07 0 1.82.32 2.35.83.51.49.83 1.18.83 2.18v5.78c0 1-.32 1.69-.83 2.18-.53.51-1.28.83-2.35.83h-2.84l-4.1 4.1c-.24.24-.49.36-.79.36-.57 0-1.01-.42-1.01-.99V14.9H8.72c-1.07 0-1.82-.32-2.35-.83-.51-.49-.83-1.18-.83-2.18V6.11c0-1 .32-1.69.83-2.18Zm2.35.77c-.72 0-1.05.2-1.25.39-.18.17-.33.45-.33 1.02v5.78c0 .57.15.85.33 1.02.2.19.53.39 1.25.39h1.95v3.07l3.07-3.07h3.03c.72 0 1.05-.2 1.25-.39.18-.17.33-.45.33-1.02V6.11c0-.57-.15-.85-.33-1.02-.2-.19-.53-.39-1.25-.39H8.72Z"></path>
							</svg>
						</span>
						<span>{post.replyCount}</span>
						</a>
						<a class="status-row__action" href={`/status/${post.slug}`}>
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M5.05 4.86a.75.75 0 0 1 1.06 0l2.76 2.76a.75.75 0 1 1-1.06 1.06L6.33 7.2v7.05c0 .7.17 1.12.45 1.39.27.27.69.45 1.39.45h5.5a.75.75 0 0 1 0 1.5h-5.5c-1.02 0-1.87-.28-2.45-.86-.58-.58-.89-1.43-.89-2.48V7.2L3.99 8.68a.75.75 0 1 1-1.06-1.06l2.12-2.12Zm13.9 10.46a.75.75 0 0 1 1.06 1.06l-2.76 2.76a.75.75 0 0 1-1.06 0l-2.76-2.76a.75.75 0 1 1 1.06-1.06l1.48 1.48V9.75c0-.7-.17-1.12-.45-1.39-.27-.27-.69-.45-1.39-.45h-5.5a.75.75 0 0 1 0-1.5h5.5c1.02 0 1.87.28 2.45.86.58.58.89 1.43.89 2.48v7.05l1.48-1.48Z"></path>
							</svg>
						</span>
						<span>{post.repostCount}</span>
						</a>
						<a class="status-row__action" href={`/status/${post.slug}`}>
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M16.72 3.8c2.87 0 4.93 2.16 4.93 5.13 0 1.89-.77 3.32-2.08 4.7-1.28 1.35-3.09 2.71-5.17 4.28l-1.89 1.43a.82.82 0 0 1-1 0l-1.89-1.43c-2.08-1.57-3.89-2.93-5.17-4.28-1.31-1.38-2.08-2.81-2.08-4.7 0-2.97 2.06-5.13 4.93-5.13 1.79 0 3.03.89 3.83 1.83.35.41.64.85.87 1.25.23-.4.52-.84.87-1.25.8-.94 2.04-1.83 3.83-1.83Zm0 1.6c-1.19 0-2.02.56-2.61 1.25-.61.71-.96 1.53-1.12 2.03a.82.82 0 0 1-1.56 0c-.16-.5-.51-1.32-1.12-2.03-.59-.69-1.42-1.25-2.61-1.25-1.88 0-3.33 1.38-3.33 3.53 0 1.33.51 2.38 1.64 3.57 1.15 1.21 2.82 2.47 4.94 4.08L12 17.68l1.84-1.39c2.12-1.61 3.79-2.87 4.94-4.08 1.13-1.19 1.64-2.24 1.64-3.57 0-2.15-1.45-3.53-3.33-3.53Z"></path>
							</svg>
						</span>
						<span>{post.likeCount}</span>
						</a>
					</div>
					<div class="status-row__reply-pills">
						<a class="tag-pill status-row__reply-pill" href={post.blueskyUrl} target="_blank" rel="noreferrer">
							<span class="status-row__reply-pill-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false">
									<path d="M5.69 4.78c2.35 1.76 4.88 5.33 5.81 7.27.93-1.94 3.46-5.51 5.81-7.27 1.69-1.27 4.43-2.26 4.43.87 0 .63-.36 5.29-.57 6.05-.72 2.66-3.35 3.34-5.69 2.94 4.09.7 5.13 3.04 2.88 5.39-4.27 4.46-6.14-1.12-6.62-2.55-.09-.26-.13-.38-.24-.38s-.15.12-.24.38c-.48 1.43-2.35 7.01-6.62 2.55-2.25-2.35-1.21-4.69 2.88-5.39-2.34.4-4.97-.28-5.69-2.94-.21-.76-.57-5.42-.57-6.05 0-3.13 2.74-2.14 4.43-.87Z"></path>
								</svg>
							</span>
							<span>Reply on Bluesky</span>
						</a>
						<button
							class="tag-pill status-row__reply-pill status-row__reply-pill--button"
							type="button"
							onclick={() => openFediverseReply(`${siteOrigin}/status/${post.slug}`)}
						>
							<span class="status-row__reply-pill-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false">
									<path d="M17.46 7.85c-.28-2.1-1.76-3.35-4.26-3.35-2.64 0-4.25 1.43-4.25 3.72 0 1.74.95 2.86 2.9 3.3l1.81.42c1.34.31 1.88.8 1.88 1.69 0 1.03-.91 1.72-2.3 1.72-1.45 0-2.33-.64-2.52-1.84H8.2c.16 2.3 1.84 3.67 4.72 3.67 2.84 0 4.66-1.46 4.66-3.82 0-1.79-.92-2.82-3-3.3l-1.66-.39c-1.4-.33-1.93-.78-1.93-1.63 0-.98.86-1.68 2.08-1.68 1.28 0 2.05.61 2.23 1.67h2.16Z"></path>
								</svg>
							</span>
							<span>Reply from Fediverse</span>
						</button>
					</div>
				</div>
			</div>
		</article>
	{/each}
</section>
