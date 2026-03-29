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
	<p class="stream-head__lede">
		The planner side of my brain: housing affordability, transit, public space, growth, and the ways
		places shape daily life whether people notice it or not.
	</p>
</section>

<section class="blog-list blog-list--archive" aria-label="Planning posts">
	{#each data.posts as post}
		<article class="blog-row planning-row">
			<a class="blog-row__link" href={post.path}>
				{#if post.coverImage}
					<div class="planning-row__media">
						<img
							class="planning-row__image"
							src={post.coverImage}
							alt={post.title}
							loading="lazy"
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

	.planning-row__image {
		display: block;
		width: 100%;
		height: auto;
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

	@media (max-width: 640px) {
		.planning-row .blog-row__link {
			grid-template-columns: 1fr;
		}
	}
</style>
