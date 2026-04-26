<script lang="ts">
	import PostDate from '$lib/components/home-template/PostDate.svelte';
	import PostPreview from '$lib/components/home-template/PostPreview.svelte';

	type HomePost = {
		title: string;
		href: string;
		description: string;
		publishedAt: string | Date;
	};

	let { posts = [] }: { posts?: HomePost[] } = $props();
</script>

<div class="template-posts-list">
	{#each posts as post}
		<article class="template-posts-list__row">
			<PostDate class="template-posts-list__date" {post} />

			<div class="template-posts-list__preview">
				<PostPreview post={post} />
			</div>
		</article>
	{/each}
</div>

<style>
	.template-posts-list {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.template-posts-list__row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 2rem;
		align-items: start;
	}

	:global(.template-post-date.template-posts-list__date) {
		display: none;
		font-size: 0.875rem;
	}

	.template-posts-list__preview {
		grid-column: span 4 / span 4;
	}

	@media (min-width: 768px) {
		.template-posts-list {
			border-left: 1px solid #f4f4f5;
			padding-left: 1.5rem;
		}

		:global(html.dark) .template-posts-list {
			border-left-color: rgba(63, 63, 70, 0.4);
		}

		:global(.template-post-date.template-posts-list__date) {
			display: flex;
			flex-direction: column;
			grid-column: span 1 / span 1;
		}

		.template-posts-list__preview {
			grid-column: span 3 / span 3;
		}
	}
</style>
