<script lang="ts">
	import ArrowRightIcon from '$lib/components/home-template/ArrowRightIcon.svelte';
	import Card from '$lib/components/home-template/Card.svelte';

	type PostPreviewData = {
		title: string;
		href: string;
		description: string;
	};

	let { post, eyebrow }: { post: PostPreviewData; eyebrow?: import('svelte').Snippet } = $props();
</script>

<Card href={post.href} title={post.title} description={post.description} {eyebrow}>
	{#snippet actions()}
		<a href={post.href} data-sveltekit-preload-data="hover" class="template-post-preview__actions">
			<span class="template-post-preview__actions-label">Read</span>
			<ArrowRightIcon class="template-post-preview__actions-icon" />
		</a>
	{/snippet}
</Card>

<style>
	.template-post-preview__actions {
		display: flex;
		align-items: center;
		color: rgb(20 184 166);
		text-decoration: none;
	}

	:global(html.dark) .template-post-preview__actions {
		color: rgb(45 212 191);
	}

	.template-post-preview__actions-label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	:global(.template-post-preview__actions-icon) {
		width: 1rem;
		height: 1rem;
		margin-left: 0.25rem;
	}
</style>
