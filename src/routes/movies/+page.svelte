<script lang="ts">
	import PopfeedGrid from '$lib/components/PopfeedGrid.svelte';
	import type { PopfeedItem } from '$lib/server/popfeed';

	let { data }: { data: { items: PopfeedItem[] } } = $props();
</script>

<svelte:head>
	<title>Movies | Bryan Robb</title>
</svelte:head>

<PopfeedGrid
	title="Movies"
	lede="A running shelf of movies I watched and wanted to remember. Usually some mix of sci-fi, character-driven stuff, older favorites, and whatever feels right when my brain is a little too cooked for anything demanding."
	items={data.items}
	emptyMessage="No movies are available yet."
/>
