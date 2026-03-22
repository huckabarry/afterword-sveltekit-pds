<script lang="ts">
	let {
		data
	}: {
		data: {
			tags: Array<{
				slug: string;
				label: string;
				path: string;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>Tags | Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Tags</h1>
	<p class="stream-head__lede">Browse blog posts by topic.</p>
</section>

<section class="tag-archive" aria-label="Tag archive">
	{#each data.tags as tag}
		<a class="tag-pill tag-archive__tag" href={tag.path}>{tag.label}</a>
	{:else}
		<p class="empty-state">No tags are available yet.</p>
	{/each}
</section>
