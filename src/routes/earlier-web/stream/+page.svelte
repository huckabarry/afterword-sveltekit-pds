<script lang="ts">
	import { untrack } from 'svelte';
	import type { EarlierWebStreamHydratedPage, EarlierWebStreamPost } from '$lib/server/earlier-web';

	let {
		data
	}: {
		data: {
			stream: EarlierWebStreamHydratedPage;
		};
	} = $props();

	let posts = $state<EarlierWebStreamPost[]>(untrack(() => data.stream.posts));
	let nextCursor = $state<string | null>(untrack(() => data.stream.cursor));
	let isLoadingMore = $state(false);
	let loadError = $state('');
	const pageSize = $derived(data.stream.limit);

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
			{ rootMargin: '320px 0px' }
		);

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	async function loadMore() {
		if (isLoadingMore || !nextCursor) {
			return;
		}

		isLoadingMore = true;
		loadError = '';

		try {
			const response = await fetch(
				`/earlier-web/feed.json?cursor=${encodeURIComponent(nextCursor)}&limit=${encodeURIComponent(String(pageSize))}`
			);

			if (!response.ok) {
				throw new Error(`Archive request failed with ${response.status}`);
			}

			const page = (await response.json()) as EarlierWebStreamHydratedPage;
			posts = [...posts, ...page.posts];
			nextCursor = page.cursor;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Unable to load more archive posts.';
		} finally {
			isLoadingMore = false;
		}
	}

	function formatDate(value: string) {
		return new Date(value).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Earlier Web Stream | Afterword</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">From an Earlier Web</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p>
					A chronological stream of older posts, captions, and fragments from earlier versions of my life online.
				</p>
				<p class="earlier-web-stream__nav">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href="/earlier-web">Browse by year</a>
				</p>
			</section>
		</div>
	</article>
</section>

{#if posts.length}
	<section class="section-block">
		<article class="content content-page">
			<div class="post-full-content">
				<section class="content-body">
					<div class="earlier-web-stream" aria-label="Earlier web stream">
						{#each posts as post (post.id)}
							<article class="earlier-web-stream__entry">
								<div class="earlier-web-stream__body">
									<p class="earlier-web-stream__meta">
										<time datetime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
										<span>·</span>
										<span>{post.year}</span>
									</p>
									<div class="earlier-web-stream__content">
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html post.bodyHtml}
									</div>
									<p class="earlier-web-stream__permalink">
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={post.path}>Open post</a>
									</p>
								</div>
							</article>
						{/each}
					</div>

					<div class="earlier-web-stream__footer">
						<p>Showing {posts.length} posts</p>

						{#if nextCursor}
							<div use:infiniteLoad>
								<button class="tag-pill" type="button" disabled={isLoadingMore} onclick={loadMore}>
									{isLoadingMore ? 'Loading more…' : 'Load older posts'}
								</button>
							</div>
						{/if}

						{#if loadError}
							<p class="earlier-web-stream__error">{loadError}</p>
						{/if}
					</div>
				</section>
			</div>
		</article>
	</section>
{:else}
	<section class="section-block">
		<p>No archive posts are available yet.</p>
	</section>
{/if}

<style>
	.earlier-web-stream__nav a {
		color: inherit;
	}

	.earlier-web-stream {
		display: grid;
		gap: 1.75rem;
	}

	.earlier-web-stream__entry {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		align-items: start;
	}

	.earlier-web-stream__content :global(p) {
		margin: 0 0 1rem;
	}

	.earlier-web-stream__content :global(.earlier-web-post__figure) {
		margin: 1rem 0 1.25rem;
	}

	.earlier-web-stream__content :global(.earlier-web-post__gallery) {
		display: grid;
		gap: 0.9rem;
		margin: 1rem 0 1.25rem;
	}

	.earlier-web-stream__content :global(.earlier-web-post__gallery .earlier-web-post__figure) {
		margin: 0;
	}

	.earlier-web-stream__content :global(img) {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: 0.25rem;
	}

	.earlier-web-stream__permalink {
		margin-top: 0.25rem;
		font-size: 0.92rem;
	}

	.earlier-web-stream__permalink a {
		color: inherit;
		text-decoration: underline;
	}

	.earlier-web-stream__meta {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.7rem;
		font-size: 0.88rem;
		opacity: 0.72;
	}

	.earlier-web-stream__footer {
		display: grid;
		justify-items: start;
		gap: 0.8rem;
		margin-top: 1.25rem;
	}

	.earlier-web-stream__error {
		color: #d97070;
	}

	@media (max-width: 720px) {
		.earlier-web-stream__entry {
			grid-template-columns: 1fr;
		}
	}
</style>
