<script lang="ts">
	import ResponsiveContentCover from '$lib/components/ResponsiveContentCover.svelte';

	let {
		data
	}: {
		data: {
			posts: Array<{
				title: string;
				excerpt: string;
				path: string;
				coverImage: string | null;
				coverImageCaption: string | null;
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
	<title>Planning & Urbanism | Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Planning & Urbanism</h1>
	<p class="stream-head__lede">Urbanism, transportation, housing, and public finance writing.</p>
</section>

<section class="blog-list blog-list--archive" aria-label="Planning posts">
	{#each data.posts as post}
		<article class="blog-row planning-row">
			<a class="blog-row__link" href={post.path}>
				{#if post.coverImage}
					<div class="planning-row__media">
						<ResponsiveContentCover
							imageClass="planning-row__image"
							sourceUrl={post.coverImage}
							alt={post.title}
							hint={post.path}
						/>
						{#if post.coverImage.includes('images.unsplash.com') && post.coverImageCaption}
							<span class="planning-row__credit">{post.coverImageCaption}</span>
						{/if}
					</div>
				{/if}
				<div class="planning-row__body">
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
				</div>
			</a>
		</article>
	{:else}
		<article class="blog-row">
			<p>No planning posts are available yet.</p>
		</article>
	{/each}
</section>

<style>
	.planning-row .blog-row__link {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.planning-row__media {
		display: grid;
		gap: 0.45rem;
	}

	:global(.planning-row__image) {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
		height: auto;
		object-fit: cover;
		border-radius: 0.5rem;
	}

	.planning-row__credit {
		display: block;
		color: var(--muted);
		font-size: 0.76rem;
		line-height: 1.35;
	}

	.planning-row__body {
		min-width: 0;
	}

	.planning-row__body h2 {
		font-size: 1.2rem;
	}

	.planning-row__body p {
		line-clamp: 4;
		-webkit-line-clamp: 4;
	}

	@media (max-width: 640px) {
		.planning-row .blog-row__link {
			grid-template-columns: 1fr;
		}
	}
</style>
