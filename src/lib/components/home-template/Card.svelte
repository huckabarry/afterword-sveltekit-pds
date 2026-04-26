<script lang="ts">
	let {
		href,
		title,
		description,
		eyebrow,
		actions
	}: {
		href?: string;
		title?: string;
		description?: string;
		eyebrow?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
	} = $props();
</script>

<article class:template-card--linked={Boolean(href)} class="template-card">
	{#if eyebrow}
		<div class="template-card__eyebrow">
			{@render eyebrow()}
		</div>
	{/if}

	{#if title}
		<div class="template-card__title-wrap">
			{#if href}
				<div class="template-card__hover"></div>
				<a href={href} data-sveltekit-preload-data="hover" class="template-card__title-link">
					<span class="template-card__title-hit"></span>
					<span class="template-card__title">{title}</span>
				</a>
			{:else}
				<span class="template-card__title">{title}</span>
			{/if}
		</div>
	{/if}

	{#if description}
		<div class="template-card__description">
			<p>{description}</p>
		</div>
	{/if}

	{#if actions}
		<div class="template-card__actions">
			{@render actions()}
		</div>
	{/if}
</article>

<style>
	.template-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.template-card__eyebrow {
		position: relative;
		z-index: 10;
		order: -1;
		margin-bottom: 0.75rem;
	}

	.template-card__title-wrap {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: #27272a;
	}

	:global(html.dark) .template-card__title-wrap {
		color: #f4f4f5;
	}

	.template-card__hover {
		position: absolute;
		z-index: 0;
		top: -1.5rem;
		right: -1rem;
		bottom: -1.5rem;
		left: -1rem;
		background: #f4f4f5;
		opacity: 0;
		transform: scale(0.95);
		transition:
			transform 160ms ease,
			opacity 160ms ease;
	}

	:global(html.dark) .template-card__hover {
		background: rgba(39, 39, 42, 0.5);
	}

	.template-card--linked:hover .template-card__hover,
	.template-card--linked:focus-within .template-card__hover {
		opacity: 1;
		transform: scale(1);
	}

	.template-card__title-link {
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.template-card__title-hit {
		position: absolute;
		z-index: 20;
		top: -1.5rem;
		right: -1rem;
		bottom: -1.5rem;
		left: -1rem;
	}

	.template-card__title {
		position: relative;
		z-index: 10;
	}

	.template-card__description {
		position: relative;
		z-index: 10;
		flex: 1;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #52525b;
	}

	:global(html.dark) .template-card__description {
		color: #a1a1aa;
	}

	.template-card__description p {
		margin: 0;
	}

	.template-card__actions {
		position: relative;
		z-index: 10;
		display: flex;
		align-items: center;
		margin-top: 1rem;
	}

	@media (min-width: 640px) {
		.template-card__hover,
		.template-card__title-hit {
			right: -1.5rem;
			left: -1.5rem;
			border-radius: 1rem;
		}
	}
</style>
