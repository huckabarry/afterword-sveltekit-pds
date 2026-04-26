<script lang="ts">
	import PostsList from '$lib/components/home-template/PostsList.svelte';

	let {
		data
	}: {
		data: {
			posts: Array<{
				title: string;
				description: string;
				href: string;
				publishedAt: string | Date;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>Afterword | Blog</title>
</svelte:head>

<div class="template-blog-index">
	<header class="template-blog-index__header">
		<h1 class="template-blog-index__title">Writing on place, cities, photographs, and whatever else sticks.</h1>
		<p class="template-blog-index__lede">All of my longer writing collected in one place.</p>
	</header>

	<div class="template-blog-index__list">
		<PostsList posts={data.posts} />
	</div>
</div>

<style>
	.template-blog-index {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}

	.template-blog-index__header {
		padding-top: 1rem;
	}

	.template-blog-index__title {
		margin: 0;
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.035em;
		color: #27272a;
	}

	:global(html.dark) .template-blog-index__title {
		color: #f4f4f5;
	}

	.template-blog-index__lede {
		margin: 1.5rem 0 0;
		font-size: 1rem;
		color: #52525b;
	}

	:global(html.dark) .template-blog-index__lede {
		color: #a1a1aa;
	}

	.template-blog-index__list {
		margin-top: 4rem;
	}

	@media (min-width: 640px) {
		.template-blog-index__title {
			font-size: 3rem;
		}

		.template-blog-index__list {
			margin-top: 5rem;
		}
	}
</style>
