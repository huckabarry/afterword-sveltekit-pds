<script lang="ts">
	import { formatDate } from '$lib/format';
	import ResponsiveContentCover from '$lib/components/ResponsiveContentCover.svelte';
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
					<article class="blog-row home-feature-row">
						<a class="blog-row__link home-feature-row__link" href={blogUrl(post.slug)}>
							{#if post.coverImage}
								<div class="home-feature-row__media">
									<ResponsiveContentCover
										imageClass="home-feature-row__image"
										sourceUrl={post.coverImage}
										alt={post.title}
										hint={post.path}
									/>
								</div>
							{/if}
							<div class="home-feature-row__body">
								<time class="blog-row__date" datetime={post.publishedAt.toISOString()}>
									{formatDate(post.publishedAt)}
								</time>
								<h3>{post.title}</h3>
								<p>{post.excerpt}</p>
							</div>
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
					<article class="blog-row home-feature-row">
						<a class="blog-row__link home-feature-row__link" href={blogUrl(post.slug)}>
							{#if post.coverImage}
								<div class="home-feature-row__media">
									<ResponsiveContentCover
										imageClass="home-feature-row__image"
										sourceUrl={post.coverImage}
										alt={post.title}
										hint={post.path}
									/>
								</div>
							{/if}
							<div class="home-feature-row__body">
								<time class="blog-row__date" datetime={post.publishedAt.toISOString()}>
									{formatDate(post.publishedAt)}
								</time>
								<h3>{post.title}</h3>
								<p>{post.excerpt}</p>
							</div>
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
		padding-bottom: 1.45rem;
		border-bottom: 1px solid var(--border);
	}

	.home-feature-row__link {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.home-feature-row__media {
		display: grid;
	}

	:global(.home-feature-row__image) {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
		height: auto;
		object-fit: cover;
		border-radius: 0.5rem;
	}

	.home-feature-row__body {
		min-width: 0;
	}

	.home-feature-row__body p {
		line-clamp: 4;
		-webkit-line-clamp: 4;
	}

	.empty-state {
		margin: 0;
		color: var(--muted);
	}

	@media (max-width: 640px) {
		.home-feature-row__link {
			grid-template-columns: 1fr;
		}
	}
</style>
