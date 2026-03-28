<script lang="ts">
	import PopfeedGrid from '$lib/components/PopfeedGrid.svelte';
	import type { PopfeedItem } from '$lib/server/popfeed';

	let { data }: { data: { items: PopfeedItem[] } } = $props();
</script>

<svelte:head>
	<title>Shows | Bryan Robb</title>
</svelte:head>

<PopfeedGrid
	title="Shows"
	lede="Shows tracked on Popfeed and published here as local entries."
	items={data.items}
	emptyMessage="No shows are available yet."
/>
