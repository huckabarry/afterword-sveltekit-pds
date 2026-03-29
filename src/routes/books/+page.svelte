<script lang="ts">
	import PopfeedGrid from '$lib/components/PopfeedGrid.svelte';
	import type { PopfeedItem } from '$lib/server/popfeed';

	let { data }: { data: { items: PopfeedItem[] } } = $props();
</script>

<svelte:head>
	<title>Books | Bryan Robb</title>
</svelte:head>

<PopfeedGrid
	title="Books"
	lede="Books I wanted to keep track of here for one reason or another. Sometimes a recommendation, sometimes a rabbit hole, sometimes just the right book at the right time."
	items={data.items}
	emptyMessage="No books are available yet."
/>
