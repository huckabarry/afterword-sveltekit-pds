<script lang="ts">
	import type { GalleryPhotoItem } from '$lib/server/gallery-assets';

	let { data }: { data: { photos: GalleryPhotoItem[] } } = $props();
	let activeIndex = $state<number | null>(null);

	function openLightbox(index: number) {
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
	<title>Photos | Afterword PDS Lab</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<section class="stream-head">
	<h1 class="stream-head__title">Visual Notes</h1>
	<p class="stream-head__lede">
		A masonry view of every image pulled from Ghost posts across the site.
	</p>
</section>

<section class="photo-grid" aria-label="Photo gallery">
	{#each data.photos as photo, index}
		<article class="photo-card">
			<button
				class="photo-card__image-link"
				type="button"
				onclick={() => openLightbox(index)}
				aria-label={`Open ${photo.postTitle}`}
			>
				<img class="photo-card__image" src={photo.displayUrl} alt={photo.alt || photo.postTitle} loading="lazy" />
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
				<img class="lightbox__image" src={activePhoto.displayUrl} alt={activePhoto.alt || activePhoto.postTitle} />
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
		column-width: 16rem;
		column-gap: 0.75rem;
	}

	.photo-card {
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
		overflow: hidden;
		border-radius: 0.25rem;
	}

	.photo-card__image {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.25rem;
		opacity: 0.82;
		transition:
			transform 180ms ease,
			opacity 180ms ease;
	}

	.photo-card__image-link:hover .photo-card__image,
	.photo-card__image-link:focus-visible .photo-card__image {
		transform: scale(1.015);
		opacity: 1;
	}

	.photo-card__overlay {
		position: absolute;
		right: 0.8rem;
		bottom: 0.8rem;
		left: 0.8rem;
		display: grid;
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

	.photo-card:hover::after,
	.photo-card:hover .photo-card__overlay,
	.photo-card:focus-within::after,
	.photo-card:focus-within .photo-card__overlay {
		opacity: 1;
		transform: translateY(0);
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
