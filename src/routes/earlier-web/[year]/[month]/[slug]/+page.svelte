<script lang="ts">
	import { shouldSurfaceEarlierWebTitle } from '$lib/earlier-web';
	import type { EarlierWebPost } from '$lib/server/earlier-web';

	let { data }: { data: { post: EarlierWebPost } } = $props();
</script>

<svelte:head>
	<title>{shouldSurfaceEarlierWebTitle(data.post) ? data.post.title : 'From an Earlier Web'} | From an Earlier Web</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">From an Earlier Web</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p class="earlier-web-post__back">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={`/earlier-web/${data.post.year}`}>Back to {data.post.year}</a>
				</p>

				<header class="earlier-web-post__header">
					{#if shouldSurfaceEarlierWebTitle(data.post)}
						<h2>{data.post.title}</h2>
					{/if}
					<p>
						<time datetime={data.post.publishedAt}>
							{new Date(data.post.publishedAt).toLocaleString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
								hour: 'numeric',
								minute: '2-digit'
							})}
						</time>
					</p>
				</header>

				<div class="earlier-web-post__body">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html data.post.bodyHtml}
				</div>
			</section>
		</div>
	</article>
</section>

<style>
	.earlier-web-post__back a {
		color: inherit;
	}

	.earlier-web-post__header {
		margin-bottom: 1.5rem;
	}

	.earlier-web-post__header h2 {
		margin-bottom: 0.35rem;
	}

	.earlier-web-post__header p {
		margin: 0;
		opacity: 0.72;
	}

	.earlier-web-post__body :global(p) {
		margin: 0 0 1rem;
	}

	.earlier-web-post__body :global(.earlier-web-post__figure) {
		margin: 1.35rem 0;
	}

	.earlier-web-post__body :global(.earlier-web-post__gallery) {
		display: grid;
		gap: 0.9rem;
		margin: 1.35rem 0;
	}

	.earlier-web-post__body :global(.earlier-web-post__gallery .earlier-web-post__figure) {
		margin: 0;
	}

	.earlier-web-post__body :global(img) {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: 0.25rem;
	}
</style>
