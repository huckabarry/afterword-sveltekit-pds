<script lang="ts">
	let {
		data
	}: {
		data: {
			tag: {
				title: string;
				description: string;
			};
			entries: Array<{
				id: string;
				title: string;
				path: string;
				publishedAt: string;
				summary: string;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.tag.title} | Notebook Tag</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">{data.tag.title}</h1>
	<p class="stream-head__lede">
		{data.tag.description || 'Notebook entries filed under this tag.'}
	</p>
</section>

<section class="blog-list blog-list--archive" aria-label="Tagged notebook entries">
	{#each data.entries as entry}
		<article class="blog-row">
			<a class="blog-row__link" href={entry.path}>
				<div class="blog-row__body">
					<time class="blog-row__date" datetime={entry.publishedAt}>
						{new Date(entry.publishedAt).toLocaleDateString('en-US', {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						})}
					</time>
					<h2>{entry.title}</h2>
					{#if entry.summary}
						<p>{entry.summary}</p>
					{/if}
				</div>
			</a>
		</article>
	{:else}
		<p class="empty-state">No notebook entries use this tag yet.</p>
	{/each}
</section>
