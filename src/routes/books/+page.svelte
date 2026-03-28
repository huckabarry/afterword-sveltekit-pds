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
	lede="Books pulled from Popfeed on my PDS and folded into the wider media timeline."
	items={data.items}
	emptyMessage="No books are available yet."
/>
