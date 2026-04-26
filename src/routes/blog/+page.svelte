<script lang="ts">
	import WritingFeed from '$lib/components/WritingFeed.svelte';
	import { name } from '$lib/info.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{name} | Writing</title>
	<meta
		name="description"
		content="Writing on place, cities, photographs, and whatever else sticks."
	/>
</svelte:head>

<WritingFeed
	latestBlogPosts={data.latestBlogPosts}
	latestFieldNotes={data.latestFieldNotes}
	showPhotos={false}
	showLaneLinks={false}
	showSectionLinks={false}
/>
