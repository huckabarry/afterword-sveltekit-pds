<script lang="ts">
	import WritingFeed from '$lib/components/WritingFeed.svelte';
	import { name } from '$lib/info.js';

	let {
		data
	}: {
		data: {
			latestBlogPosts: Array<{
				title: string;
				excerpt: string;
				path: string;
				coverImage: string | null;
				publishedAt: string;
			}>;
			latestFieldNotes: Array<{
				title: string;
				path: string;
				excerpt: string;
				coverImage: string | null;
				publishedAt: string;
			}>;
			latestPhotos: Array<{
				postTitle: string;
				postPath: string;
				displayUrl: string;
				alt: string;
				publishedAt: string;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>{name}</title>
	<meta name="description" content="Afterword gathers writing, field notes, and media into one small web home." />
</svelte:head>

<WritingFeed
	latestBlogPosts={data.latestBlogPosts}
	latestFieldNotes={data.latestFieldNotes}
	latestPhotos={data.latestPhotos}
	showPhotos={true}
	showLaneLinks={true}
/>
