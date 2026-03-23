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
		<article class="blog-row field-notes-row">
			<a class="blog-row__link" href={post.path}>
				{#if post.coverImage}
					<img class="field-notes-row__image" src={post.coverImage} alt={post.title} loading="lazy" />
				{/if}
				<div class="field-notes-row__body">
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
			<p>No field notes are available yet.</p>
		</article>
	{/each}
</section>

<style>
	.field-notes-row .blog-row__link {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.field-notes-row__image {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 0.5rem;
	}

	.field-notes-row__body {
		min-width: 0;
	}

	@media (max-width: 640px) {
		.field-notes-row .blog-row__link {
			grid-template-columns: 1fr;
		}
	}
</style>
