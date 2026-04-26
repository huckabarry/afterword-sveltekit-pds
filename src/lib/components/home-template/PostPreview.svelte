<script lang="ts">
	import ArrowRightIcon from '$lib/components/home-template/ArrowRightIcon.svelte';

	type PostPreviewData = {
		title: string;
		href: string;
		description: string;
	};

	let { post, eyebrow = '' }: { post: PostPreviewData; eyebrow?: string } = $props();
</script>

<article class="post-preview">
	{#if eyebrow}
		<div class="post-preview__eyebrow">{eyebrow}</div>
	{/if}

	<h3 class="post-preview__title">
		<a href={post.href} data-sveltekit-preload-data="hover">{post.title}</a>
	</h3>

	<p class="post-preview__description">{post.description}</p>

	<div class="post-preview__actions">
		<span>Read</span>
		<ArrowRightIcon />
	</div>
</article>

<style>
	.post-preview {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.post-preview__eyebrow {
		font-size: 0.88rem;
		color: var(--muted);
	}

	.post-preview__title {
		margin: 0;
		font-size: 1.08rem;
		line-height: 1.25;
	}

	.post-preview__title a {
		color: var(--text);
		text-decoration: none;
	}

	.post-preview__description {
		margin: 0;
		color: var(--muted);
		line-height: 1.65;
	}

	.post-preview__actions {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--accent, var(--text));
	}
</style>
