<script lang="ts">
	type SocialLink = {
		label: string;
		url: string;
	};

	let { links = [] }: { links?: SocialLink[] } = $props();
</script>

{#if links.length}
	<div class="social-links">
		{#each links as link}
			<a class="social-link" href={link.url} target="_blank" rel="noreferrer me">
				{link.label}
			</a>
		{/each}
	</div>
{/if}

<style>
	.social-links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
	}

	.social-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.38rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
		text-decoration: none;
		transition:
			color 160ms ease,
			border-color 160ms ease,
			background-color 160ms ease;
	}

	.social-link:hover {
		color: var(--text);
		border-color: color-mix(in srgb, var(--accent, var(--text)) 45%, var(--border));
		background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
	}
</style>
