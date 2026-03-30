<script lang="ts">
	import { shouldSurfaceEarlierWebTitle } from '$lib/earlier-web';
	import type { EarlierWebSeriesPost } from '$lib/server/earlier-web';

	let { data }: { data: { posts: EarlierWebSeriesPost[] } } = $props();
</script>

<svelte:head>
	<title>Notebook Preview | Afterword</title>
	<meta
		name="robots"
		content="noindex, nofollow"
	/>
</svelte:head>

<section class="section-block notebook-preview">
	<h1 class="section-title">Notebook Preview</h1>
	<p class="page-head__lede">
		A hidden preview of longer, more inward posts drawn from <a href="/earlier-web">From an Earlier Web</a>.
		This isn’t linked anywhere yet. It’s just a way to see how these pieces feel in sequence.
	</p>

	<div class="notebook-preview__list">
		{#each data.posts as post}
			<article class="notebook-preview__entry">
				<div class="notebook-preview__meta">
					<time datetime={post.publishedAt}>
						{new Date(post.publishedAt).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'long',
							day: 'numeric'
						})}
					</time>
					<span>Earlier Web</span>
				</div>

				{#if shouldSurfaceEarlierWebTitle(post)}
					<h2 class="notebook-preview__title">
						<a href={post.path}>{post.title}</a>
					</h2>
				{/if}

				<div class="notebook-preview__body earlier-web-post__body">
					{@html post.bodyHtml}
				</div>

				<p class="notebook-preview__actions">
					<a href={post.path}>View archive post</a>
				</p>
			</article>
		{/each}
	</div>
</section>

<style>
	.notebook-preview {
		max-width: 44rem;
	}

	.notebook-preview__list {
		display: grid;
		gap: 3rem;
	}

	.notebook-preview__entry {
		padding-top: 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
	}

	.notebook-preview__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		margin-bottom: 0.9rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
	}

	.notebook-preview__title {
		margin: 0 0 1rem;
		font-size: clamp(1.6rem, 2.6vw, 2.2rem);
		line-height: 1.05;
	}

	.notebook-preview__title a {
		color: inherit;
		text-decoration: none;
	}

	.notebook-preview__title a:hover,
	.notebook-preview__title a:focus-visible {
		text-decoration: underline;
	}

	.notebook-preview__body :global(p) {
		margin: 0 0 1rem;
		font-size: 1.04rem;
		line-height: 1.72;
	}

	.notebook-preview__body :global(.earlier-web-post__gallery) {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		margin: 1.25rem 0;
	}

	.notebook-preview__body :global(.earlier-web-post__figure) {
		margin: 1.25rem 0;
	}

	.notebook-preview__body :global(img) {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.35rem;
	}

	.notebook-preview__actions {
		margin: 1.1rem 0 0;
		font-size: 0.95rem;
	}
</style>
