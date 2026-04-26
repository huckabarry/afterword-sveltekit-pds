<script lang="ts">
	import { formatDate } from '$lib/format';

	let {
		post,
		collapsed = false,
		decorate = false,
		class: className = ''
	}: {
		post: { publishedAt: string | Date };
		collapsed?: boolean;
		decorate?: boolean;
		class?: string;
	} = $props();
</script>

<div class={`template-post-date ${className}`.trim()} class:template-post-date--decorate={decorate}>
	{#if decorate}
		<span class="template-post-date__rail" aria-hidden="true">
			<span class="template-post-date__rail-bar"></span>
		</span>
	{/if}
	<div class:template-post-date__stack={!collapsed}>
		<time datetime={post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt}>
			{formatDate(post.publishedAt)}
		</time>
	</div>
</div>

<style>
	.template-post-date {
		position: relative;
		z-index: 10;
		display: flex;
		margin-bottom: 0.75rem;
		color: #71717a;
	}

	:global(html.dark) .template-post-date {
		color: #a1a1aa;
	}

	.template-post-date--decorate {
		padding-left: 0.875rem;
	}

	.template-post-date__rail {
		position: absolute;
		inset: 0 auto 0 0;
		display: flex;
		align-items: center;
		padding: 0.25rem 0;
	}

	.template-post-date__rail-bar {
		width: 0.125rem;
		height: 100%;
		border-radius: 999px;
		background: #e4e4e7;
	}

	:global(html.dark) .template-post-date__rail-bar {
		background: #71717a;
	}

	.template-post-date__stack {
		display: flex;
		flex-direction: column;
	}
</style>
