<script lang="ts">
	import PostPreview from '$lib/components/home-template/PostPreview.svelte';
	import { formatDate } from '$lib/format';

	type StandardSiteHomePost = {
		title: string;
		href: string;
		description: string;
		publishedAt: string | Date;
	};

	let { posts = [] }: { posts?: StandardSiteHomePost[] } = $props();
</script>

<div class="posts-list">
	{#each posts as post}
		<article class="posts-list__row">
			<div class="posts-list__date">
				<time datetime={post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt}>
					{formatDate(post.publishedAt)}
				</time>
			</div>
			<div class="posts-list__preview">
				<PostPreview post={post} eyebrow={formatDate(post.publishedAt)} />
			</div>
		</article>
	{/each}
</div>

<style>
	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 2.4rem;
	}

	.posts-list__row {
		display: grid;
		grid-template-columns: minmax(8rem, 9rem) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
	}

	.posts-list__date {
		display: flex;
		flex-direction: column;
		padding-top: 0.2rem;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.posts-list__preview :global(.card__eyebrow) {
		display: none;
	}

	@media (max-width: 720px) {
		.posts-list__row {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.posts-list__date {
			display: none;
		}

		.posts-list__preview :global(.card__eyebrow) {
			display: block;
		}
	}
</style>
