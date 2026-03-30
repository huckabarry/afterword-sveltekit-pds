<script lang="ts">
	import { formatDate } from '$lib/format';
	import type { StatusPost } from '$lib/server/atproto';

	let {
		data
	}: {
		data: {
			post: StatusPost;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.post.displayName} | Status</title>
</svelte:head>

<section class="status-list status-list--single">
	<article class="status-row status-row--single h-entry">
		<div class="status-row__avatar h-card">
			{#if data.post.avatar}
				<img class="u-photo" src={data.post.avatar} alt={data.post.displayName} loading="lazy" />
			{/if}
		</div>
		<div class="status-row__body">
			{#if data.post.replyTo}
				<p class="status-row__reply-context">
					In reply to
					<a href={data.post.replyTo.blueskyUrl} target="_blank" rel="noreferrer">
						{data.post.replyTo.displayName || data.post.replyTo.handle}
					</a>
				</p>
			{/if}
			<div class="status-row__meta">
				<div class="status-row__byline">
					<span class="status-row__name p-author h-card">
						<span class="p-name">{data.post.displayName}</span>
						<span class="u-url" hidden>{data.post.blueskyUrl}</span>
					</span>
					<span class="status-row__handle p-nickname">{data.post.handle}</span>
					<span>·</span>
					<time class="dt-published" datetime={new Date(data.post.date).toISOString()}>{formatDate(data.post.date)}</time>
				</div>
			</div>
			<a class="u-url" href={`/status/${data.post.slug}`} hidden>{`/status/${data.post.slug}`}</a>
			{#if data.post.html}
				<div class="status-row__content e-content">
					{@html data.post.html}
				</div>
			{/if}
			{#if data.post.quotedPost}
				<a class="status-quote" href={data.post.quotedPost.blueskyUrl} target="_blank" rel="noreferrer">
					<div class="status-quote__meta">
						{#if data.post.quotedPost.avatar}
							<img
								class="status-quote__avatar"
								src={data.post.quotedPost.avatar}
								alt={data.post.quotedPost.displayName}
								loading="lazy"
							/>
						{/if}
						<div class="status-quote__byline">
							<strong>{data.post.quotedPost.displayName}</strong>
							<span>{data.post.quotedPost.handle}</span>
							<span>·</span>
							<time datetime={new Date(data.post.quotedPost.date).toISOString()}>
								{formatDate(data.post.quotedPost.date)}
							</time>
						</div>
					</div>
					{#if data.post.quotedPost.html}
						<div class="status-quote__content">
							{@html data.post.quotedPost.html}
						</div>
					{/if}
					{#if data.post.quotedPost.images.length}
						<div
							class="status-row__media status-row__media--quoted {data.post.quotedPost.images.length > 1 ? 'status-row__media--multi' : ''}"
						>
							{#each data.post.quotedPost.images as image}
								<img src={image.fullsize || image.thumb} alt={image.alt || 'Quoted post image'} />
							{/each}
						</div>
					{/if}
					{#if data.post.quotedPost.external}
						<span class="status-card status-card--quoted">
							<span class="status-card__domain">{data.post.quotedPost.external.domain}</span>
							<strong class="status-card__title">{data.post.quotedPost.external.title}</strong>
							{#if data.post.quotedPost.external.description}
								<span class="status-card__description">{data.post.quotedPost.external.description}</span>
							{/if}
						</span>
					{/if}
				</a>
			{/if}
			{#if data.post.images.length}
				<div class="status-row__media {data.post.images.length > 1 ? 'status-row__media--multi' : ''}">
					{#each data.post.images as image}
						<a class="status-row__image" href={data.post.blueskyUrl} target="_blank" rel="noreferrer">
							<img src={image.fullsize || image.thumb} alt={image.alt || 'Status image'} />
						</a>
					{/each}
				</div>
			{/if}
			{#if data.post.external}
				<a class="status-card" href={data.post.external.uri} target="_blank" rel="noreferrer">
					<span class="status-card__domain">{data.post.external.domain}</span>
					<strong class="status-card__title">{data.post.external.title}</strong>
					{#if data.post.external.description}
						<span class="status-card__description">{data.post.external.description}</span>
					{/if}
				</a>
			{/if}
			<div class="status-row__actions">
				<div class="status-row__metrics">
					<a class="status-row__action" href={data.post.blueskyUrl} target="_blank" rel="noreferrer">
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M6.37 3.93c.53-.51 1.28-.83 2.35-.83h8.03c1.07 0 1.82.32 2.35.83.51.49.83 1.18.83 2.18v5.78c0 1-.32 1.69-.83 2.18-.53.51-1.28.83-2.35.83h-2.84l-4.1 4.1c-.24.24-.49.36-.79.36-.57 0-1.01-.42-1.01-.99V14.9H8.72c-1.07 0-1.82-.32-2.35-.83-.51-.49-.83-1.18-.83-2.18V6.11c0-1 .32-1.69.83-2.18Zm2.35.77c-.72 0-1.05.2-1.25.39-.18.17-.33.45-.33 1.02v5.78c0 .57.15.85.33 1.02.2.19.53.39 1.25.39h1.95v3.07l3.07-3.07h3.03c.72 0 1.05-.2 1.25-.39.18-.17.33-.45.33-1.02V6.11c0-.57-.15-.85-.33-1.02-.2-.19-.53-.39-1.25-.39H8.72Z"></path>
							</svg>
						</span>
						<span>{data.post.replyCount}</span>
					</a>
					<a class="status-row__action" href={data.post.blueskyUrl} target="_blank" rel="noreferrer">
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M5.05 4.86a.75.75 0 0 1 1.06 0l2.76 2.76a.75.75 0 1 1-1.06 1.06L6.33 7.2v7.05c0 .7.17 1.12.45 1.39.27.27.69.45 1.39.45h5.5a.75.75 0 0 1 0 1.5h-5.5c-1.02 0-1.87-.28-2.45-.86-.58-.58-.89-1.43-.89-2.48V7.2L3.99 8.68a.75.75 0 1 1-1.06-1.06l2.12-2.12Zm13.9 10.46a.75.75 0 0 1 1.06 1.06l-2.76 2.76a.75.75 0 0 1-1.06 0l-2.76-2.76a.75.75 0 1 1 1.06-1.06l1.48 1.48V9.75c0-.7-.17-1.12-.45-1.39-.27-.27-.69-.45-1.39-.45h-5.5a.75.75 0 0 1 0-1.5h5.5c1.02 0 1.87.28 2.45.86.58.58.89 1.43.89 2.48v7.05l1.48-1.48Z"></path>
							</svg>
						</span>
						<span>{data.post.repostCount}</span>
					</a>
					<a class="status-row__action" href={data.post.blueskyUrl} target="_blank" rel="noreferrer">
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M6.5 4.75A2.75 2.75 0 0 1 9.25 2h8A2.75 2.75 0 0 1 20 4.75v8a2.75 2.75 0 0 1-2.75 2.75H13.7l-4.92 4.1a.75.75 0 0 1-1.23-.58V15.5H6.75A2.75 2.75 0 0 1 4 12.75v-8A2.75 2.75 0 0 1 6.75 2h.5a.75.75 0 0 1 0 1.5h-.5c-.69 0-1.25.56-1.25 1.25v8c0 .69.56 1.25 1.25 1.25H8.3a.75.75 0 0 1 .75.75v2.68l3.87-3.23a.75.75 0 0 1 .48-.17h3.85c.69 0 1.25-.56 1.25-1.25v-8c0-.69-.56-1.25-1.25-1.25h-8c-.69 0-1.25.56-1.25 1.25V9a.75.75 0 0 1-1.5 0V4.75Z"></path>
							</svg>
						</span>
						<span>{data.post.quoteCount}</span>
					</a>
					<a class="status-row__action" href={data.post.blueskyUrl} target="_blank" rel="noreferrer">
						<span class="status-row__icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M16.72 3.8c2.87 0 4.93 2.16 4.93 5.13 0 1.89-.77 3.32-2.08 4.7-1.28 1.35-3.09 2.71-5.17 4.28l-1.89 1.43a.82.82 0 0 1-1 0l-1.89-1.43c-2.08-1.57-3.89-2.93-5.17-4.28-1.31-1.38-2.08-2.81-2.08-4.7 0-2.97 2.06-5.13 4.93-5.13 1.79 0 3.03.89 3.83 1.83.35.41.64.85.87 1.25.23-.4.52-.84.87-1.25.8-.94 2.04-1.83 3.83-1.83Zm0 1.6c-1.19 0-2.02.56-2.61 1.25-.61.71-.96 1.53-1.12 2.03a.82.82 0 0 1-1.56 0c-.16-.5-.51-1.32-1.12-2.03-.59-.69-1.42-1.25-2.61-1.25-1.88 0-3.33 1.38-3.33 3.53 0 1.33.51 2.38 1.64 3.57 1.15 1.21 2.82 2.47 4.94 4.08L12 17.68l1.84-1.39c2.12-1.61 3.79-2.87 4.94-4.08 1.13-1.19 1.64-2.24 1.64-3.57 0-2.15-1.45-3.53-3.33-3.53Z"></path>
							</svg>
						</span>
						<span>{data.post.likeCount}</span>
					</a>
				</div>
				<div class="status-row__reply-pills">
					<a class="status-row__reply-pill" href={data.post.blueskyUrl} target="_blank" rel="noreferrer">
						<span class="status-row__reply-pill-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M5.69 4.78c2.35 1.76 4.88 5.33 5.81 7.27.93-1.94 3.46-5.51 5.81-7.27 1.69-1.27 4.43-2.26 4.43.87 0 .63-.36 5.29-.57 6.05-.72 2.66-3.35 3.34-5.69 2.94 4.09.7 5.13 3.04 2.88 5.39-4.27 4.46-6.14-1.12-6.62-2.55-.09-.26-.13-.38-.24-.38s-.15.12-.24.38c-.48 1.43-2.35 7.01-6.62 2.55-2.25-2.35-1.21-4.69 2.88-5.39-2.34.4-4.97-.28-5.69-2.94-.21-.76-.57-5.42-.57-6.05 0-3.13 2.74-2.14 4.43-.87Z"></path>
							</svg>
						</span>
						<span>Reply on Bluesky</span>
					</a>
				</div>
			</div>
			{#if data.post.replies && data.post.replies.length}
				<section class="status-thread">
					<h2>Replies</h2>
					{#each data.post.replies as reply}
						<article class="status-reply">
							<div class="status-row__meta">
								<div class="status-row__byline">
									<span class="status-row__name">{reply.displayName}</span>
									<span class="status-row__handle">{reply.handle}</span>
								</div>
							</div>
							<div class="status-row__content">
								{@html reply.html}
							</div>
						</article>
					{/each}
				</section>
			{/if}
		</div>
	</article>
</section>

<style>
	.status-thread {
		display: grid;
		gap: 0.85rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}

	.status-thread h2 {
		margin: 0;
		color: #ffffff;
		font-size: 1.1rem;
	}

	.status-reply {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.85rem;
		align-items: start;
		padding-left: 0.9rem;
		border-left: 1px solid var(--border);
	}
</style>
