<script lang="ts">
	import ResponsiveContentCover from '$lib/components/ResponsiveContentCover.svelte';
	import ArrowRightIcon from '$lib/components/ArrowRightIcon.svelte';
	import PostDate from '$lib/components/home-template/PostDate.svelte';

	let {
		data
	}: {
		data: {
			posts: Array<{
				title: string;
				excerpt: string;
				path: string;
				coverImage: string | null;
				publishedAt: string | Date;
			}>;
		};
	} = $props();
</script>

<svelte:head>
	<title>Field Notes | Bryan Robb</title>
</svelte:head>

<div class="field-notes">
	<header class="field-notes__header">
		<h1 class="field-notes__title">Field Notes</h1>
		<p class="field-notes__lede">
			Travel, photography, and on-the-ground notes from walks, trains, road trips, and everyday wandering.
		</p>
	</header>

	<div class="field-notes__list" aria-label="Field notes posts">
		{#each data.posts as post}
			<article class="field-notes__row">
				<PostDate class="hidden text-sm md:flex md:flex-col" post={{ publishedAt: post.publishedAt }} />

				<div class="col-span-4 md:col-span-3">
					<article class="field-note-card">
						<div class="field-note-card__hover"></div>
						<a href={post.path} class="field-note-card__link" data-sveltekit-preload-data="hover">
							<span class="field-note-card__hit"></span>

							<div class="field-note-card__inner">
								{#if post.coverImage}
									<div class="field-note-card__media">
										<ResponsiveContentCover
											imageClass="field-note-card__image"
											sourceUrl={post.coverImage}
											alt={post.title}
											hint={post.path}
											variant="feature"
											sizes="(max-width: 768px) 100vw, 42rem"
										/>
									</div>
								{/if}

								<div class="field-note-card__body">
									<h2 class="field-note-card__title">{post.title}</h2>
									<p class="field-note-card__excerpt">{post.excerpt}</p>

									<div aria-hidden="true" class="field-note-card__actions">
										<div class="field-note-card__read">
											<span class="text-sm font-medium">Read</span>
											<ArrowRightIcon class="w-4 h-4 ml-1" />
										</div>
									</div>
								</div>
							</div>
						</a>
					</article>
				</div>
			</article>
		{:else}
			<p class="field-notes__empty">No field notes are available yet.</p>
		{/each}
	</div>
</div>

<style>
	.field-notes {
		display: flex;
		flex-direction: column;
		gap: 4rem;
		padding-bottom: 4rem;
	}

	.field-notes__header {
		padding-top: 1rem;
	}

	.field-notes__title {
		font-size: clamp(2.25rem, 5vw, 3rem);
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.field-notes__lede {
		margin-top: 1.5rem;
		color: #52525b;
	}

	:global(html.dark) .field-notes__lede {
		color: #a1a1aa;
	}

	.field-notes__list {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.field-notes__row {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 2rem;
		align-items: start;
	}

	.field-note-card {
		position: relative;
	}

	.field-note-card__hover {
		position: absolute;
		inset: -1.5rem -1rem;
		z-index: 0;
		background: #f4f4f5;
		opacity: 0;
		transform: scale(0.95);
		transition:
			transform 160ms ease,
			opacity 160ms ease;
	}

	:global(html.dark) .field-note-card__hover {
		background: rgba(39, 39, 42, 0.5);
	}

	.field-note-card:hover .field-note-card__hover,
	.field-note-card:focus-within .field-note-card__hover {
		opacity: 1;
		transform: scale(1);
	}

	.field-note-card__link {
		position: relative;
		display: block;
		color: inherit;
		text-decoration: none;
	}

	.field-note-card__hit {
		position: absolute;
		inset: -1.5rem -1rem;
		z-index: 20;
	}

	.field-note-card__inner {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field-note-card__media {
		overflow: hidden;
		border-radius: 0.75rem;
		background: #f4f4f5;
	}

	:global(html.dark) .field-note-card__media {
		background: rgba(39, 39, 42, 0.75);
	}

	:global(.field-note-card__image) {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		height: auto;
		object-fit: cover;
		object-position: center;
	}

	.field-note-card__body {
		position: relative;
		z-index: 10;
	}

	.field-note-card__title {
		margin-top: 0;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: #27272a;
	}

	:global(html.dark) .field-note-card__title {
		color: #f4f4f5;
	}

	.field-note-card__excerpt {
		margin-top: 0.5rem;
		font-size: 0.95rem;
		line-height: 1.7;
		color: #52525b;
	}

	:global(html.dark) .field-note-card__excerpt {
		color: #a1a1aa;
	}

	.field-note-card__actions {
		margin-top: 1rem;
	}

	.field-note-card__read {
		display: inline-flex;
		align-items: center;
		color: #c06a63;
	}

	:global(html.dark) .field-note-card__read {
		color: #e08a7a;
	}

	.field-notes__empty {
		color: #71717a;
	}

	:global(html.dark) .field-notes__empty {
		color: #a1a1aa;
	}

	@media (min-width: 640px) {
		.field-note-card__hover,
		.field-note-card__hit {
			left: -1.5rem;
			right: -1.5rem;
			border-radius: 1rem;
		}
	}

	@media (min-width: 768px) {
		.field-notes__list {
			border-left: 1px solid #f4f4f5;
			padding-left: 1.5rem;
		}

		:global(html.dark) .field-notes__list {
			border-left-color: rgba(63, 63, 70, 0.4);
		}

		.field-note-card__media {
			border-radius: 0.9rem;
		}
	}
</style>
