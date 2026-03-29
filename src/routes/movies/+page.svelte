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
	lede="Movies logged on Popfeed, mirrored into the site as local entries."
	items={data.items}
	emptyMessage="No movies are available yet."
/>
