<script lang="ts">
	import ResponsiveContentCover from '$lib/components/ResponsiveContentCover.svelte';
	import ArrowRightIcon from '$lib/components/ArrowRightIcon.svelte';
	import PostDate from '$lib/components/home-template/PostDate.svelte';
	import ToC from '$lib/components/ToC.svelte';
	import type { TemplatePost } from '$lib/server/template-posts';
	import { authorName, bio, name } from '$lib/info.js';

	let {
		data
	}: {
		data: {
			latestBlogPosts: Array<{
				title: string;
				excerpt: string;
				path: string;
				coverImage: string | null;
				publishedAt: string;
			}>;
			latestFieldNotes: Array<{
				title: string;
				path: string;
				excerpt: string;
				coverImage: string | null;
				publishedAt: string;
			}>;
			latestPhotos: Array<{
				postTitle: string;
				postPath: string;
				displayUrl: string;
				alt: string;
				publishedAt: string;
			}>;
		};
	} = $props();

	const lanes = [
		{ href: '/', label: 'Home' },
		{ href: '/blog', label: 'Blog' },
		{ href: '/status', label: 'Status' },
		{ href: '/about', label: 'About' }
	];

	const homeSections = [
		{ id: 'home-blog-heading', value: 'Urbanism', depth: 2 },
		{ id: 'home-field-notes-heading', value: 'Field Notes', depth: 2 },
		{ id: 'latest-photos-heading', value: 'Photos', depth: 2 }
	];

	const homeToc: TemplatePost['headings'] = homeSections;
</script>

<svelte:head>
	<title>{name}</title>
	<meta name="description" content="Afterword gathers writing, field notes, and media into one small web home." />
</svelte:head>

<div class="home-page-root max-w-2xl mx-auto lg:max-w-none">
	<div class="hidden lg:block" aria-hidden="true"></div>

	<section class="home-page__intro">
		<div class="home-page__hero">
			<div class="home-page__hero-copy">
				<h1 class="home-page__hero-title">
					Writing, field notes, photographs, and the usual preoccupations.
				</h1>

				<div class="home-page__hero-header">
					<p class="home-page__hero-name">{authorName}</p>
					<p class="home-page__hero-role">{bio}</p>
				</div>
			</div>
		</div>
	</section>

	<div class="hidden xl:block" aria-hidden="true"></div>

	<div class="hidden lg:block" aria-hidden="true"></div>

	<div class="home-page">
		{#if data.latestBlogPosts.length}
			<section class="home-page__feed-section" id="home-blog" aria-labelledby="home-blog-heading">
			<div class="home-page__section-head">
				<div>
					<p class="feature-card__label">Blog</p>
					<h2 id="home-blog-heading" class="home-page__section-title">Urbanism</h2>
				</div>
				<a class="home-page__section-link" href="/blog">View all</a>
			</div>

			<div class="home-page__field-notes-list" aria-label="Latest blog posts">
				{#each data.latestBlogPosts as post}
					<article class="home-page__field-note-row">
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
											<h3 class="field-note-card__title">{post.title}</h3>
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
				{/each}
			</div>
			</section>
		{/if}

		{#if data.latestFieldNotes.length}
			<section class="home-page__feed-section" id="home-field-notes" aria-labelledby="home-field-notes-heading">
			<div class="home-page__section-head">
				<div>
					<p class="feature-card__label">Field Notes</p>
					<h2 id="home-field-notes-heading" class="home-page__section-title">Field Notes</h2>
				</div>
				<a class="home-page__section-link" href="/blog#field-notes">View all</a>
			</div>

			<div class="home-page__field-notes-list" aria-label="Recent field notes">
				{#each data.latestFieldNotes as post}
					<article class="home-page__field-note-row">
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
											<h3 class="field-note-card__title">{post.title}</h3>
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
				{/each}
			</div>
			</section>
		{/if}

		{#if data.latestPhotos.length}
			<section class="home-page__photos" aria-labelledby="latest-photos-heading">
			<div class="home-page__section-head">
				<div>
					<p class="feature-card__label">Latest Photos</p>
					<h2 id="latest-photos-heading" class="home-page__section-title">Photos</h2>
				</div>
				<a class="home-page__section-link" href="/photos">View all</a>
			</div>

			<div class="home-page__photo-grid">
				{#each data.latestPhotos as photo}
					<a class="home-page__photo-card" href={photo.postPath} aria-label={photo.postTitle}>
						<img
							class="home-page__photo-image"
							src={photo.displayUrl}
							alt={photo.alt}
							loading="lazy"
							decoding="async"
						/>
					</a>
				{/each}
			</div>
			</section>
		{/if}

		<nav class="home-page__lane-links" aria-label="Browse the site">
			{#each lanes as lane}
				<a href={lane.href} class="home-page__lane-link">{lane.label}</a>
			{/each}
		</nav>
	</div>

	<div class="home-page__toc-column hidden xl:block">
		<aside class="home-page__toc-rail" aria-label="On this page">
			<ToC headings={homeToc} />
		</aside>
	</div>
</div>

<style>
	.home-page-root {
		display: grid;
		grid-template-columns: 1fr;
	}

	.home-page {
		display: flex;
		flex-direction: column;
		gap: 3.5rem;
		padding-bottom: 4rem;
		width: 100%;
	}

	.home-page__intro {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-top: 1.5rem;
		padding-bottom: 3.5rem;
		width: 100%;
	}

	.home-page__hero {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-bottom: 0.5rem;
	}

	.home-page__hero-copy {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.home-page__hero-header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.home-page__hero-name,
	.home-page__hero-role,
	.home-page__hero-title {
		margin: 0;
	}

	.home-page__hero-name {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: #18181b;
	}

	:global(html.dark) .home-page__hero-name {
		color: #f4f4f5;
	}

	.home-page__hero-role {
		font-size: 0.92rem;
		line-height: 1.5;
		color: #71717a;
	}

	:global(html.dark) .home-page__hero-role {
		color: #a1a1aa;
	}

	.home-page__hero-title {
		font-size: 2.5rem;
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.04em;
		color: #18181b;
		text-wrap: balance;
	}

	:global(html.dark) .home-page__hero-title {
		color: #f4f4f5;
	}

	.home-page__toc-rail {
		display: none;
	}

	.home-page__toc-column {
		display: none;
	}

	.home-page__section-link {
		display: inline-flex;
		align-items: center;
		color: #71717a;
		text-decoration: none;
	}

	.feature-card__label {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #71717a;
	}

	:global(html.dark) .feature-card__label {
		color: #a1a1aa;
	}

	.home-page__feed-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.home-page__lane-link {
		color: inherit;
		text-decoration: none;
	}

	.home-page__section-link {
		font-size: 0.95rem;
		font-weight: 600;
		color: #c06a63;
	}

	:global(html.dark) .home-page__section-link {
		color: #e08a7a;
	}

	.home-page__photos {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-top: 0.25rem;
	}

	.home-page__section-head {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
		justify-content: space-between;
	}

	.home-page__section-title {
		margin: 0.4rem 0 0;
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #18181b;
	}

	:global(html.dark) .home-page__section-title {
		color: #f4f4f5;
	}

	.home-page__photo-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.home-page__photo-card {
		display: block;
		overflow: hidden;
		border-radius: 0.5rem;
		background: #f4f4f5;
	}

	:global(html.dark) .home-page__photo-card {
		background: rgba(39, 39, 42, 0.75);
	}

	.home-page__photo-image {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		transition: transform 180ms ease;
	}

	.home-page__photo-card:hover .home-page__photo-image,
	.home-page__photo-card:focus-visible .home-page__photo-image {
		transform: scale(1.02);
	}

	.home-page__lane-links {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e4e4e7;
	}

	:global(html.dark) .home-page__lane-links {
		border-top-color: rgba(63, 63, 70, 0.6);
	}

	.home-page__lane-link {
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #71717a;
	}

	.home-page__lane-link:hover {
		color: #18181b;
	}

	:global(html.dark) .home-page__lane-link {
		color: #a1a1aa;
	}

	:global(html.dark) .home-page__lane-link:hover {
		color: #f4f4f5;
	}

	.home-page__field-notes-list {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.home-page__field-note-row {
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

	@media (min-width: 768px) {
		.home-page__hero {
			gap: 1.25rem;
		}

		.home-page__hero-title {
			font-size: 3rem;
		}

		.home-page__field-notes-list {
			border-left: 1px solid #f4f4f5;
			padding-left: 1.5rem;
		}

		:global(html.dark) .home-page__field-notes-list {
			border-left-color: rgba(63, 63, 70, 0.4);
		}

		.field-note-card__media {
			border-radius: 0.9rem;
		}

		.home-page__photo-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 640px) {
		.field-note-card__hover,
		.field-note-card__hit {
			left: -1.5rem;
			right: -1.5rem;
			border-radius: 1rem;
		}
	}

	@media (min-width: 1024px) {
		.home-page-root {
			grid-template-columns: 1fr 42rem 1fr;
		}

		.home-page__intro {
			grid-column: 2;
			grid-row: 1;
		}

		.home-page {
			grid-column: 2;
			grid-row: 2;
		}
	}

	@media (min-width: 1280px) {
		.home-page__toc-column {
			display: block;
			grid-column: 3;
			grid-row: 2;
			padding-top: 2rem;
		}

		.home-page__toc-rail {
			display: block;
			position: sticky;
			top: 2rem;
			width: 12rem;
			margin-left: 2rem;
		}

		.home-page__toc-rail :global(ul) {
			gap: 0.7rem;
		}

		.home-page__toc-rail :global(li) {
			white-space: nowrap;
		}
	}
</style>
