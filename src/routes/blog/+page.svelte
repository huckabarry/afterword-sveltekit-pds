<script lang="ts">
	let {
		data
	}: {
		data: {
			posts: Array<{
				title: string;
				excerpt: string;
				path: string;
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
		<article class="blog-row">
			<a class="blog-row__link" href={post.path}>
				<time class="blog-row__date" datetime={new Date(post.publishedAt).toISOString()}>
					{new Date(post.publishedAt).toLocaleDateString('en-GB', {
						day: '2-digit',
						month: 'short',
						year: 'numeric'
					})}
				</time>
				<h2>{post.title}</h2>
				<p>{post.excerpt}</p>
				<span class="blog-row__read-more">Read more <span aria-hidden="true">→</span></span>
			</a>
		</article>
	{:else}
		<article class="blog-row">
			<p>No blog posts are available yet.</p>
		</article>
	{/each}
</section>
