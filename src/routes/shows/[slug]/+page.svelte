<script lang="ts">
	import PopfeedDetail from '$lib/components/PopfeedDetail.svelte';
	import type { PopfeedItem } from '$lib/server/popfeed';

	let {
		data
	}: {
		data: {
			item: PopfeedItem;
			previousItem: PopfeedItem | null;
			nextItem: PopfeedItem | null;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.item.title} | Shows</title>
</svelte:head>

<PopfeedDetail
	item={data.item}
	previousItem={data.previousItem}
	nextItem={data.nextItem}
	backHref="/shows"
	backLabel="Shows"
/>
