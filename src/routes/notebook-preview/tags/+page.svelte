<script lang="ts">
	let {
		data
	}: {
		data: {
			tags: Array<{
				title: string;
				path: string;
				description: string;
				entryCount?: number;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>Notebook Tags | Afterword</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Notebook Tags</h1>
	<p class="stream-head__lede">
		Topics and motifs for the more personal side of the site.
	</p>
</section>

<section class="tag-archive" aria-label="Notebook tags">
	{#each data.tags as tag}
		<a class="tag-pill tag-archive__tag" href={tag.path}>
			{tag.title}{#if tag.entryCount} <span aria-hidden="true">({tag.entryCount})</span>{/if}
		</a>
	{:else}
		<p class="empty-state">No notebook tags are available yet.</p>
	{/each}
</section>
