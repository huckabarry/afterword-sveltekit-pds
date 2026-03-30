<script lang="ts">
	import { untrack } from 'svelte';
	import type { EarlierWebPostSummary, EarlierWebStreamPage } from '$lib/server/earlier-web';

	let {
		data
	}: {
		data: {
			stream: EarlierWebStreamPage;
		};
	} = $props();

	let posts = $state<EarlierWebPostSummary[]>(untrack(() => data.stream.posts));
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

			const page = (await response.json()) as EarlierWebStreamPage;
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
								{#if post.coverImage}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a class="earlier-web-stream__image-link" href={post.path}>
										<img
											class="earlier-web-stream__image"
											src={post.coverImage}
											alt={post.title}
											loading="lazy"
											decoding="async"
										/>
									</a>
								{/if}

								<div class="earlier-web-stream__body">
									<p class="earlier-web-stream__meta">
										<time datetime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
										<span>·</span>
										<span>{post.year}</span>
									</p>
									<h2>
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={post.path}>{post.title}</a>
									</h2>
									<p>{post.excerpt}</p>
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
		gap: 1rem;
	}

	.earlier-web-stream__entry {
		display: grid;
		grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		align-items: start;
	}

	.earlier-web-stream__image-link {
		display: block;
	}

	.earlier-web-stream__image {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
	}

	.earlier-web-stream__body h2 {
		margin: 0 0 0.45rem;
		font-size: 1.15rem;
		line-height: 1.15;
	}

	.earlier-web-stream__body h2 a {
		color: inherit;
		text-decoration: none;
	}

	.earlier-web-stream__body h2 a:hover {
		text-decoration: underline;
	}

	.earlier-web-stream__body p {
		margin: 0;
	}

	.earlier-web-stream__meta {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
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
