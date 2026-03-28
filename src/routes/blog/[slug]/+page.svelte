<script lang="ts">
	import type { BlogPost } from '$lib/server/ghost';
	import type { WebmentionRecord } from '$lib/server/webmentions';

	let {
		data
	}: {
		data: {
			post: BlogPost;
			previousPost: BlogPost | null;
			nextPost: BlogPost | null;
			webmentions: WebmentionRecord[];
			standardSiteDocumentAtUri: string | null;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.post.title} | Blog</title>
	{#if data.standardSiteDocumentAtUri}
		<link rel="site.standard.document" href={data.standardSiteDocumentAtUri} />
	{/if}
</svelte:head>

<article class="entry entry--blog h-entry">
	<div class="entry__meta">
		<a href="/blog">Blog</a>
		<time
			class="dt-published"
			datetime={new Date(data.post.publishedAt).toISOString()}
		>{new Date(data.post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
	</div>

	<h1 class="entry__title p-name">{data.post.title}</h1>
	<a class="p-author h-card" href="/">Bryan Robb</a>

	{#if data.post.publicTags.length}
		<div class="entry__tags">
			{#each data.post.publicTags as tag}
				<a class="tag-pill entry__tag p-category" href={tag.path}>{tag.label}</a>
			{/each}
		</div>
	{/if}

	{#if data.post.coverImage}
		<figure class="entry__figure">
			<img class="u-photo" src={data.post.coverImage} alt={data.post.title} />
		</figure>
	{/if}

	<div class="entry__content e-content">
		{@html data.post.html}
	</div>

	<footer class="post-actions" aria-label="Post actions">
		<a class="post-action-link" href="/contact">Reply by email</a>
		<a class="post-action-link" href="/blog">Back to all posts</a>
	</footer>

	{#if data.webmentions.length}
		<section class="entry-webmentions" aria-labelledby="webmentions-title">
			<h2 id="webmentions-title" class="entry-webmentions__title">Elsewhere</h2>
			<ul class="entry-webmentions__list">
				{#each data.webmentions as mention}
					<li class="entry-webmentions__item">
						<a class="entry-webmentions__link" href={mention.sourceUrl} target="_blank" rel="noreferrer">
							<span class="entry-webmentions__name">{mention.sourceTitle || mention.sourceDomain || mention.sourceUrl}</span>
							{#if mention.sourceDomain}
								<span class="entry-webmentions__meta">{mention.sourceDomain}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

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
