<script lang="ts">
	let {
		data
	}: {
		data: {
			entry: {
				title: string;
				publishedAt: string;
				introHtml: string;
				bodyHtml: string;
				hideFromIndexing: boolean;
				tags: Array<{
					title: string;
					path: string;
				}>;
			};
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.entry.title} | Notebook Preview</title>
	{#if data.entry.hideFromIndexing}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<section class="section-block notebook-entry">
	<p class="notebook-entry__back">
		<a href="/notebook-preview">Back to notebook preview</a>
	</p>

	<header class="notebook-entry__header">
		<time datetime={data.entry.publishedAt}>
			{new Date(data.entry.publishedAt).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			})}
		</time>
		<h1 class="section-title">{data.entry.title}</h1>
		{#if data.entry.tags.length}
			<div class="notebook-entry__tags">
				{#each data.entry.tags as tag}
					<a class="tag-pill" href={tag.path}>{tag.title}</a>
				{/each}
			</div>
		{/if}
	</header>

	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body notebook-entry__body">
				{#if data.entry.introHtml}
					{@html data.entry.introHtml}
				{/if}
				{#if data.entry.bodyHtml}
					{@html data.entry.bodyHtml}
				{/if}
			</section>
		</div>
	</article>
</section>

<style>
	.notebook-entry {
		max-width: 44rem;
	}

	.notebook-entry__back {
		margin: 0 0 1rem;
	}

	.notebook-entry__header {
		margin-bottom: 1.5rem;
	}

	.notebook-entry__header time {
		display: block;
		margin-bottom: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
	}

	.notebook-entry__body :global(p) {
		margin: 0 0 1rem;
		font-size: 1.04rem;
		line-height: 1.72;
	}

	.notebook-entry__body :global(h2) {
		margin: 2rem 0 1rem;
	}

	.notebook-entry__body :global(h3) {
		margin: 1.5rem 0 0.9rem;
	}

	.notebook-entry__body :global(ul),
	.notebook-entry__body :global(ol) {
		margin: 0 0 1rem 1.25rem;
	}

	.notebook-entry__body :global(li + li) {
		margin-top: 0.5rem;
	}

	.notebook-entry__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 1rem;
	}
</style>
