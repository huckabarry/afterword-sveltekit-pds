<script lang="ts">
	import WritingFeed from '$lib/components/WritingFeed.svelte';
	import { name } from '$lib/info.js';
	let { data }: { data: any } = $props();
	const formatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>{data.simpleSite ? 'Blog / Afterword' : `${name} | Writing`}</title>
	{#if !data.simpleSite}
		<meta
			name="description"
			content="Writing on place, cities, photographs, and whatever else sticks."
		/>
	{/if}
</svelte:head>

{#if data.simpleSite}
	<section class="simple-home">
		<h1>Blog</h1>
		<p>Just titles and dates in a narrow column.</p>

		<ol class="simple-post-list">
			{#each data.posts as post}
				<li class="simple-post-list__item">
					<a class="simple-post-list__link" href={`/blog/${post.slug}`}>{post.title}</a>
					<time class="simple-post-list__date" datetime={post.date}>
						{formatter.format(new Date(post.date))}
					</time>
				</li>
			{/each}
		</ol>
	</section>
{:else}
<WritingFeed
	latestBlogPosts={data.latestBlogPosts}
	latestFieldNotes={data.latestFieldNotes}
	showPhotos={false}
	showLaneLinks={false}
	showSectionLinks={false}
	introTitle="Writings on place, cities, and the human experience of living in them."
	introBody="All of my longer writing collected in one place."
/>
{/if}
