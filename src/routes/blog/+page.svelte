<script lang="ts">
	let {
		data
	}: {
		data: {
			posts: Array<{
				title: string;
				excerpt: string;
				path: string;
				coverImage: string | null;
				publishedAt: string | Date;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>Blog | Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Latest writing</h1>
	<p class="stream-head__lede">
		A compact archive for field notes, gallery posts, and urbanism writing.
	</p>
</section>

<section class="blog-list blog-list--archive" aria-label="Blog posts">
	{#each data.posts as post}
		<article class="blog-row blog-row--with-image h-entry">
			<a class="blog-row__link u-url" href={post.path}>
				{#if post.coverImage}
					<img class="blog-row__image" src={post.coverImage} alt={post.title} loading="lazy" />
				{/if}
				<div class="blog-row__body">
					<time class="blog-row__date dt-published" datetime={new Date(post.publishedAt).toISOString()}>
						{new Date(post.publishedAt).toLocaleDateString('en-GB', {
							day: '2-digit',
							month: 'short',
							year: 'numeric'
						})}
					</time>
					<h2 class="p-name">{post.title}</h2>
					<p class="p-summary">{post.excerpt}</p>
					<span class="blog-row__read-more">Read more <span aria-hidden="true">→</span></span>
				</div>
			</a>
		</article>
	{:else}
		<article class="blog-row">
			<p>No blog posts are available yet.</p>
		</article>
	{/each}
</section>

<style>
	.blog-row--with-image .blog-row__link {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.blog-row__image {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
	}

	.blog-row__body {
		min-width: 0;
	}

	@media (max-width: 640px) {
		.blog-row--with-image .blog-row__link {
			grid-template-columns: 1fr;
		}
	}
</style>
