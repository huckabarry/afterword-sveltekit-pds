<script lang="ts">
	import type { GalleryPhotoItem } from '$lib/server/gallery-assets';

	let { data }: { data: { photos: GalleryPhotoItem[] } } = $props();
	let activeIndex = $state<number | null>(null);
	const prefetchedLightboxUrls = new Set<string>();

	function prefetchLightbox(url: string | null | undefined) {
		const normalized = String(url || '').trim();

		if (!normalized || prefetchedLightboxUrls.has(normalized) || typeof Image === 'undefined') {
			return;
		}

		prefetchedLightboxUrls.add(normalized);
		const image = new Image();
		image.decoding = 'async';
		image.src = normalized;
	}

	function openLightbox(index: number) {
		prefetchLightbox(data.photos[index]?.lightboxUrl);
		activeIndex = index;
	}

	function closeLightbox() {
		activeIndex = null;
	}

	function showPrevious() {
		if (activeIndex === null || !data.photos.length) return;
		activeIndex = (activeIndex - 1 + data.photos.length) % data.photos.length;
	}

	function showNext() {
		if (activeIndex === null || !data.photos.length) return;
		activeIndex = (activeIndex + 1) % data.photos.length;
	}

	function getGalleryVariantUrl(url: string, preset: 'thumb-sm' | 'thumb-md' | 'thumb' | 'large') {
		return String(url || '').replace(/\/gallery-images\/[^/]+\//, `/gallery-images/${preset}/`);
	}

	function getPhotoSrcset(url: string) {
		if (!url.includes('/gallery-images/')) {
			return undefined;
		}

		return [
			`${getGalleryVariantUrl(url, 'thumb-sm')} 360w`,
			`${getGalleryVariantUrl(url, 'thumb-md')} 720w`,
			`${getGalleryVariantUrl(url, 'thumb')} 1080w`
		].join(', ');
	}

	function onKeydown(event: KeyboardEvent) {
		if (activeIndex === null) return;

		if (event.key === 'Escape') {
			closeLightbox();
		} else if (event.key === 'ArrowLeft') {
			showPrevious();
		} else if (event.key === 'ArrowRight') {
			showNext();
		}
	}
</script>

<svelte:head>
	<title>Photos | Bryan Robb</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<section class="stream-head">
	<h1 class="stream-head__title">Visual Notes</h1>
	<div class="stream-head__lede">
		<p>
			Most of these are photos of places I've visited, street scenes, and landscapes. Photography is just a hobby for me, and I'm still learning and trying new things. It's just another way for me to express myself.
		</p>
	</div>
</section>

<section class="photo-grid" aria-label="Photo gallery">
	{#each data.photos as photo, index}
		<article class="photo-card">
			<button
				class="photo-card__image-link"
				type="button"
				onclick={() => openLightbox(index)}
				onpointerenter={() => prefetchLightbox(photo.lightboxUrl)}
				onfocus={() => prefetchLightbox(photo.lightboxUrl)}
				onpointerdown={() => prefetchLightbox(photo.lightboxUrl)}
				aria-label={`Open ${photo.postTitle}`}
			>
				<img
					class="photo-card__image"
					src={photo.displayUrl}
					srcset={getPhotoSrcset(photo.displayUrl)}
					sizes="(max-width: 640px) 48vw, 31vw"
					alt={photo.alt || photo.postTitle}
					width={photo.width || undefined}
					height={photo.height || undefined}
					loading="lazy"
					decoding="async"
				/>
				<span class="photo-card__overlay">
					<span class="photo-card__title">{photo.postTitle}</span>
					<span class="photo-card__meta">
						<time class="photo-card__date">
							{new Date(photo.postPublishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
						</time>
						<span class="photo-card__source">View post</span>
					</span>
				</span>
			</button>
		</article>
	{/each}
</section>

{#if activeIndex !== null}
	{@const activePhoto = data.photos[activeIndex]}
	<div class="lightbox is-open" role="dialog" aria-modal="true" aria-label="Photo viewer">
		<button class="lightbox__backdrop" type="button" onclick={closeLightbox} aria-label="Close photo viewer"></button>
		<div class="lightbox__dialog">
			<button class="lightbox__close" type="button" onclick={closeLightbox} aria-label="Close">
				×
			</button>
			<button class="lightbox__nav lightbox__nav--prev" type="button" onclick={showPrevious} aria-label="Previous image">
				‹
			</button>
			<button class="lightbox__nav lightbox__nav--next" type="button" onclick={showNext} aria-label="Next image">
				›
			</button>
			<figure class="lightbox__figure">
				<img
					class="lightbox__image"
					src={activePhoto.lightboxUrl}
					alt={activePhoto.alt || activePhoto.postTitle}
				/>
				<figcaption class="lightbox__caption">
					<a href={activePhoto.postPath}>{activePhoto.postTitle}</a>
					<span>{new Date(activePhoto.postPublishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
				</figcaption>
			</figure>
		</div>
	</div>
{/if}

<style>
	.photo-grid {
		columns: 3;
		column-gap: 0.75rem;
	}

	.photo-card {
		position: relative;
		break-inside: avoid;
		margin: 0 0 0.75rem;
	}

	.photo-card__image-link {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-decoration: none;
		text-align: left;
		overflow: hidden;
		border-radius: 0.25rem;
	}

	.photo-card__image {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
		transition:
			transform 180ms ease,
			filter 180ms ease;
	}

	.photo-card__overlay {
		position: absolute;
		right: 0.8rem;
		bottom: 0.8rem;
		left: 0.8rem;
		display: grid;
		justify-items: start;
		gap: 0.15rem;
		color: #ffffff;
		opacity: 0;
		transform: translateY(0.6rem);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease;
		pointer-events: none;
		z-index: 2;
	}

	.photo-card::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 36%, rgba(0, 0, 0, 0.68) 100%);
		opacity: 0;
		transition: opacity 0.18s ease;
		pointer-events: none;
		border-radius: 0.25rem;
	}

	@media (hover: hover) {
		.photo-card__image-link:hover .photo-card__image,
		.photo-card__image-link:focus-visible .photo-card__image {
			transform: scale(1.012);
			filter: saturate(1.02);
		}

		.photo-card:hover::after,
		.photo-card:hover .photo-card__overlay,
		.photo-card:focus-within::after,
		.photo-card:focus-within .photo-card__overlay {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (hover: none) {
		.photo-card__overlay,
		.photo-card::after {
			display: none;
		}
	}

	.photo-card__title {
		margin: 0;
		font-family: 'Fira Sans', sans-serif;
		font-style: normal;
		font-weight: 700;
		font-size: 1.2rem;
		line-height: 1.15;
	}

	.photo-card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.8rem;
		font-family: 'Fira Sans', sans-serif;
		font-size: 0.72rem;
		font-style: normal;
	}

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 999;
	}

	.lightbox__backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgba(0, 0, 0, 0.82);
	}

	.lightbox__dialog {
		position: relative;
		z-index: 1;
		max-width: 72rem;
		margin: 4vh auto;
		padding: 2rem;
	}

	.lightbox__figure {
		margin: 0;
	}

	.lightbox__image {
		display: block;
		max-width: 100%;
		max-height: 84vh;
		margin: 0 auto;
		border-radius: 0.25rem;
	}

	.lightbox__caption {
		margin-top: 0.8rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem 0.8rem;
		text-align: center;
		color: #ffffff;
		font-family: 'Fira Sans', sans-serif;
		font-style: normal;
	}

	.lightbox__caption a {
		text-decoration: none;
	}

	.lightbox__nav,
	.lightbox__close {
		position: absolute;
		border: 0;
		background: transparent;
		color: #ffffff;
		cursor: pointer;
	}

	.lightbox__nav {
		top: 50%;
		font-size: 2.6rem;
		line-height: 1;
		transform: translateY(-50%);
	}

	.lightbox__nav--prev {
		left: 0.5rem;
	}

	.lightbox__nav--next {
		right: 0.5rem;
	}

	.lightbox__close {
		top: 0.5rem;
		right: 0.75rem;
		font-size: 2rem;
		line-height: 1;
	}

	@media (max-width: 640px) {
		.photo-grid {
			column-width: auto;
			columns: 2;
			column-gap: 0.55rem;
		}

		.photo-card {
			margin: 0 0 0.55rem;
		}

		.lightbox__dialog {
			margin: 2vh auto;
			padding: 1rem;
		}

		.lightbox__nav--prev {
			left: 0;
		}

		.lightbox__nav--next {
			right: 0;
		}
	}
</style>
