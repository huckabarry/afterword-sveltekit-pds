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
				publicTags: Array<{
					slug: string;
					label: string;
					path: string;
				}>;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>Field Notes | Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Field Notes</h1>
	<p class="stream-head__lede">Travel, photography, gallery posts, and on-the-ground notes.</p>
</section>

<section class="blog-list blog-list--archive" aria-label="Field notes posts">
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
				{#if post.publicTags.length}
					<div class="blog-row__tags">
						{#each post.publicTags as tag}
							<span class="tag-pill blog-row__tag">{tag.label}</span>
						{/each}
					</div>
				{/if}
				<h2>{post.title}</h2>
				<p>{post.excerpt}</p>
				<span class="blog-row__read-more">Read more <span aria-hidden="true">→</span></span>
			</a>
		</article>
	{:else}
		<article class="blog-row">
			<p>No field notes are available yet.</p>
		</article>
	{/each}
</section>
