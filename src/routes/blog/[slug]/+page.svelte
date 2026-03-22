<script lang="ts">
	import type { BlogPost } from '$lib/server/ghost';

	let {
		data
	}: {
		data: {
			post: BlogPost;
			previousPost: BlogPost | null;
			nextPost: BlogPost | null;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.post.title} | Blog</title>
</svelte:head>

<article class="entry entry--blog">
	<div class="entry__meta">
		<a href="/blog">Blog</a>
		<time>{new Date(data.post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
	</div>

	<h1 class="entry__title">{data.post.title}</h1>

	{#if data.post.coverImage}
		<figure class="entry__figure">
			<img src={data.post.coverImage} alt={data.post.title} />
		</figure>
	{/if}

	<div class="entry__content">
		{@html data.post.html}
	</div>

	<footer class="post-actions" aria-label="Post actions">
		<a class="post-action-link" href="/contact">Reply by email</a>
		<a class="post-action-link" href="/blog">Back to all posts</a>
	</footer>

	{#if data.previousPost || data.nextPost}
		<nav class="post-navigation">
			<ul>
				<li class="post-navigation-item post-navigation-item-previous">
					{#if data.previousPost}
						<a class="post-navigation-link" href={data.previousPost.path}>
							<span class="post-navigation-label">← Previous</span>
							<span class="post-navigation-title">{data.previousPost.title}</span>
						</a>
					{/if}
				</li>
				<li class="post-navigation-item post-navigation-item-next">
					{#if data.nextPost}
						<a class="post-navigation-link" href={data.nextPost.path}>
							<span class="post-navigation-label">Next →</span>
							<span class="post-navigation-title">{data.nextPost.title}</span>
						</a>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
</article>
