<script lang="ts">
	import {
		getFeatureContentCover,
		getResponsiveContentCover
	} from '$lib/content-cover-delivery';

	let {
		sourceUrl,
		alt,
		hint = 'cover',
		variant = 'card',
		sizes = '(max-width: 640px) 100vw, 11rem',
		imageClass = '',
		loading = 'lazy',
		fetchpriority = 'auto'
	}: {
		sourceUrl: string | null;
		alt: string;
		hint?: string;
		variant?: 'card' | 'feature';
		sizes?: string;
		imageClass?: string;
		loading?: 'lazy' | 'eager';
		fetchpriority?: 'high' | 'low' | 'auto';
	} = $props();

	const image = $derived(
		variant === 'feature'
			? getFeatureContentCover(sourceUrl, hint)
			: getResponsiveContentCover(sourceUrl, hint)
	);
</script>

{#if image}
	<img
		class={imageClass}
		src={image.src}
		srcset={image.srcset}
		sizes={sizes}
		alt={alt}
		loading={loading}
		fetchpriority={fetchpriority}
		decoding="async"
	/>
{:else}
	<img
		class={imageClass}
		src={sourceUrl || ''}
		alt={alt}
		loading={loading}
		fetchpriority={fetchpriority}
		decoding="async"
	/>
{/if}
