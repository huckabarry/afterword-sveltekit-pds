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
			fediverse: {
				likeCount: number;
				announceCount: number;
				totalCount: number;
			};
			standardSiteDocumentAtUri: string | null;
			replies: Array<{
				noteId: string;
				actorId: string;
				actorName: string | null;
				actorHandle: string | null;
				contentHtml: string;
				publishedAt: string;
				avatarUrl: string | null;
				profileUrl: string;
			}>;
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

	{#if data.fediverse.totalCount > 0}
		<section class="fedi-summary" aria-label="Fediverse interactions">
			<h2 class="fedi-summary__title">Fediverse</h2>
			<p class="fedi-summary__text">
				{#if data.fediverse.announceCount > 0}
					<span>{data.fediverse.announceCount} boost{data.fediverse.announceCount === 1 ? '' : 's'}</span>
				{/if}
				{#if data.fediverse.announceCount > 0 && data.fediverse.likeCount > 0}
					<span> · </span>
				{/if}
				{#if data.fediverse.likeCount > 0}
					<span>{data.fediverse.likeCount} favorite{data.fediverse.likeCount === 1 ? '' : 's'}</span>
				{/if}
			</p>
		</section>
	{/if}

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

	{#if data.replies.length}
		<section class="entry-replies" aria-labelledby="replies-title">
			<h2 id="replies-title" class="entry-webmentions__title">Fediverse replies</h2>
			<ul class="entry-replies__list">
				{#each data.replies as reply}
					<li class="entry-replies__item">
						<div class="entry-replies__avatar">
							{#if reply.avatarUrl}
								<img src={reply.avatarUrl} alt={reply.actorName || reply.actorHandle || reply.actorId} loading="lazy" />
							{:else}
								<span>{(reply.actorName || reply.actorHandle || '?').slice(0, 1).toUpperCase()}</span>
							{/if}
						</div>
						<div class="entry-replies__body">
							<div class="entry-replies__meta">
								<a href={reply.profileUrl} target="_blank" rel="noreferrer">
									{reply.actorName || reply.actorHandle || reply.actorId}
								</a>
								{#if reply.actorHandle}
									<span>{reply.actorHandle}</span>
								{/if}
								<time datetime={reply.publishedAt}>
									{new Date(reply.publishedAt).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}
								</time>
							</div>
							<div class="entry-replies__content">
								{@html reply.contentHtml}
							</div>
						</div>
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
