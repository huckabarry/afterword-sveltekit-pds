<script lang="ts">
	import { formatDate } from '$lib/format';
	import type { BlogPost } from '$lib/server/ghost';

	let {
		data
	}: {
		data: { planningPosts: BlogPost[]; fieldNotesPosts: BlogPost[] };
	} = $props();

	function blogUrl(slug: string) {
		return `/blog/${slug}`;
	}
</script>

<svelte:head>
	<title>Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<div class="stream-head__lede">
		<p>
			Urban planner, photographer, gardener, and habitual maker of things. I use this
			space for short updates, photos, and longer reflections on place, music, design, and
			daily life. If you've found your way here and want to say hello, I'd love to hear from
			you.
		</p>
	</div>
</section>

<div class="section-stack">
	<section class="section-block section-block-writing">
		<h2 class="section-title">Field Notes</h2>
		{#if data.fieldNotesPosts.length}
			<section class="blog-list">
				{#each data.fieldNotesPosts as post}
					<article class="blog-row">
						<a class="blog-row__link" href={blogUrl(post.slug)}>
							<time class="blog-row__date" datetime={post.publishedAt.toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
							<h3>{post.title}</h3>
							<p>{post.excerpt}</p>
						</a>
					</article>
				{/each}
			</section>
			<div class="home-stream-tags">
				<a class="tag-pill" href="/tags/field-notes">Field Notes</a>
				<a class="home-updates__more-link" href="/field-notes">Read more field notes <span aria-hidden="true">→</span></a>
			</div>
		{:else}
			<p class="empty-state">No field notes are available yet.</p>
		{/if}
	</section>

	<section class="section-block section-block-writing">
		<h2 class="section-title">Planning & Urbanism</h2>
		{#if data.planningPosts.length}
			<section class="blog-list">
				{#each data.planningPosts as post}
					<article class="blog-row">
						<a class="blog-row__link" href={blogUrl(post.slug)}>
							<time class="blog-row__date" datetime={post.publishedAt.toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
							<h3>{post.title}</h3>
							<p>{post.excerpt}</p>
						</a>
					</article>
				{/each}
			</section>
			<div class="home-stream-tags">
				<a class="tag-pill" href="/tags/urbanism">Urbanism</a>
				<a class="home-updates__more-link" href="/planning">Read more planning & urbanism posts <span aria-hidden="true">→</span></a>
			</div>
		{:else}
			<p class="empty-state">No planning posts are available yet.</p>
		{/if}
	</section>

</div>

<style>
	.stream-head {
		margin-top: 0.1rem;
	}

	.empty-state {
		margin: 0;
		color: var(--muted);
	}
</style>
