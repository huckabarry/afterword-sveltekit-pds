<script lang="ts">
	import CheckinMap from '$lib/components/CheckinMap.svelte';
	import { shouldSurfaceEarlierWebTitle } from '$lib/earlier-web';
	import { excerpt, formatDate } from '$lib/format';
	import type { Checkin } from '$lib/server/atproto';
	import type { EarlierWebOnThisDayPost } from '$lib/server/earlier-web';
	import type { GalleryPhotoItem } from '$lib/server/gallery-assets';
	import type { BlogPost } from '$lib/server/ghost';

	let {
		data
	}: {
		data: {
			intro: {
				title: string;
				description: string;
				paragraphs: string[];
			};
			nowPosts: BlogPost[];
			latestCheckin: Checkin | null;
			latestPhoto: GalleryPhotoItem | null;
			onThisDayPosts: EarlierWebOnThisDayPost[];
		};
	} = $props();

	const latestCheckinText = $derived.by(() =>
		data.latestCheckin ? excerpt(data.latestCheckin.excerpt || data.latestCheckin.note, 180) : ''
	);

</script>

<svelte:head>
	<title>{data.intro.title} | Bryan Robb</title>
	<meta name="description" content={data.intro.description} />
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.intro.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#each data.intro.paragraphs as paragraph}
					<p>{paragraph}</p>
				{/each}
			</section>
		</div>
	</article>
</section>

<section class="section-block">
	<h2 class="section-title">Recent Now Posts</h2>
	<p class="page-head__lede">
		A few recent notes about whatever currently has my attention. Books, music, movies, and shows
		live over on <a href="/media">Media</a>.
	</p>

	{#if data.nowPosts.length}
		<div class="now-post-list">
			{#each data.nowPosts as post}
				<a class="now-post-row" href={post.path}>
					<h3 class="now-post-row__title">{post.title}</h3>
					<time class="now-post-row__date" datetime={post.publishedAt.toISOString()}>
						{formatDate(post.publishedAt)}
					</time>
				</a>
			{/each}
		</div>
	{:else}
		<p class="page-head__lede">No now posts are available yet.</p>
	{/if}
</section>

{#if data.latestCheckin || data.latestPhoto}
	<section class="section-block">
		<div class="now-glance">
			{#if data.latestCheckin}
				<article class="now-card">
					<p class="now-card__kicker">Latest Check-In</p>

					<div class="now-card__copy">
						<div class="now-card__meta">
							<time datetime={data.latestCheckin.visitedAt.toISOString()}>
								{formatDate(data.latestCheckin.visitedAt)}
							</time>
						</div>

						<h2 class="now-card__title">
							<a href={data.latestCheckin.canonicalPath}>{data.latestCheckin.name}</a>
						</h2>

						{#if data.latestCheckin.venueCategory}
							<p class="now-card__subhead">{data.latestCheckin.venueCategory}</p>
						{:else}
							<p class="now-card__subhead now-card__subhead--ghost" aria-hidden="true">&nbsp;</p>
						{/if}
					</div>

					{#if data.latestCheckin.latitude !== null && data.latestCheckin.longitude !== null}
						<div class="now-card__map">
							<CheckinMap
								latitude={data.latestCheckin.latitude}
								longitude={data.latestCheckin.longitude}
								name={data.latestCheckin.name}
								compact={true}
							/>
						</div>
					{/if}

					{#if latestCheckinText}
						<p class="now-card__text">{latestCheckinText}</p>
					{/if}

					<div class="now-card__actions">
						<a class="tag-pill now-card__action" href={data.latestCheckin.canonicalPath}>View check-in</a>
						<a class="tag-pill now-card__action" href="/check-ins">All check-ins</a>
					</div>
				</article>
			{/if}

			{#if data.latestPhoto}
				<article class="now-card">
					<p class="now-card__kicker">Latest Photo</p>

					<div class="now-card__copy">
						<div class="now-card__meta">
							<time datetime={data.latestPhoto.postPublishedAt.toISOString()}>
								{formatDate(data.latestPhoto.postPublishedAt)}
							</time>
						</div>

						<h2 class="now-card__title">
							<a href={data.latestPhoto.postPath}>{data.latestPhoto.postTitle}</a>
						</h2>

						<p class="now-card__subhead now-card__subhead--ghost" aria-hidden="true">&nbsp;</p>
					</div>

					<a class="now-photo" href={data.latestPhoto.postPath}>
						<img
							class="now-photo__image"
							src={data.latestPhoto.displayUrl}
							alt={data.latestPhoto.alt || data.latestPhoto.postTitle}
							loading="lazy"
						/>
					</a>

					{#if data.latestPhoto.alt && data.latestPhoto.alt !== data.latestPhoto.postTitle}
						<p class="now-card__text">{data.latestPhoto.alt}</p>
					{/if}

					<div class="now-card__actions">
						<a class="tag-pill now-card__action" href={data.latestPhoto.postPath}>View post</a>
						<a class="tag-pill now-card__action" href="/photos">Gallery</a>
					</div>
				</article>
			{/if}
		</div>
	</section>
{/if}

{#if data.onThisDayPosts.length}
	<section class="section-block">
		<h2 class="section-title">On This Date</h2>
		<p class="page-head__lede">
			A few notes from this day in earlier years, pulled from <a href="/earlier-web">Earlier
				Web</a>.
		</p>

		<div class="on-this-day-list">
			{#each data.onThisDayPosts as post}
				<article class="on-this-day-card">
					<div class="on-this-day-card__meta">
						<time datetime={post.publishedAt}>
							{new Date(post.publishedAt).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
						</time>
					</div>

					{#if post.coverImage}
						<a class="on-this-day-card__image-link" href={post.path}>
							<img
								class="on-this-day-card__image"
								src={post.coverImage}
								alt={post.title}
								loading="lazy"
							/>
						</a>
					{/if}

					{#if shouldSurfaceEarlierWebTitle(post)}
						<h3 class="on-this-day-card__title">
							<a href={post.path}>{post.title}</a>
						</h3>
					{/if}

					<p class="on-this-day-card__excerpt">
						<a href={post.path}>{post.excerpt}</a>
					</p>
				</article>
			{/each}
		</div>
	</section>
{/if}

<style>
	.now-glance {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.now-card {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: color-mix(in srgb, var(--surface) 76%, transparent 24%);
	}

	.now-card__kicker {
		margin: 0;
		color: var(--accent);
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.now-card__copy {
		display: grid;
		gap: 0.35rem;
		align-content: start;
	}

	.now-card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.now-card__title {
		margin: 0;
		font-size: clamp(1.2rem, 2vw, 1.45rem);
		line-height: 1.14;
		min-height: 2.8rem;
	}

	.now-card__title a {
		color: inherit;
		text-decoration: none;
	}

	.now-card__subhead,
	.now-card__text {
		margin: 0;
		color: var(--muted);
	}

	.now-card__subhead {
		font-size: 0.88rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-height: 1.1rem;
	}

	.now-card__subhead--ghost {
		visibility: hidden;
	}

	.now-card__text {
		font-size: 0.97rem;
		line-height: 1.6;
	}

	.now-card__map {
		display: block;
		overflow: hidden;
		border-radius: 0.85rem;
		aspect-ratio: 16 / 10;
	}

	.now-card__map :global(.checkin-map__frame--compact) {
		min-height: 0;
		height: 100%;
	}

	.now-photo {
		display: block;
		text-decoration: none;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: 0.85rem;
	}

	.now-photo__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
	}

	.now-card__actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin-top: auto;
	}

	.now-card__action {
		text-decoration: none;
		justify-content: center;
		text-align: center;
	}

	.now-post-list {
		margin-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.now-post-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: baseline;
		padding: 0.95rem 0;
		text-decoration: none;
		color: inherit;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent 25%);
	}

	.now-post-row__title {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.3;
		font-weight: 600;
	}

	.now-post-row__date {
		color: var(--muted);
		font-size: 0.84rem;
		white-space: nowrap;
	}

	.on-this-day-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.on-this-day-card {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: color-mix(in srgb, var(--surface) 76%, transparent 24%);
	}

	.on-this-day-card__meta {
		font-size: 0.82rem;
		color: var(--accent);
	}

	.on-this-day-card__image-link {
		display: block;
	}

	.on-this-day-card__image {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
	}

	.on-this-day-card__title {
		margin: 0;
		font-size: 1.02rem;
		line-height: 1.3;
	}

	.on-this-day-card__title a {
		color: inherit;
		text-decoration: none;
	}

	.on-this-day-card__excerpt {
		margin: 0;
		line-height: 1.6;
	}

	.on-this-day-card__excerpt a {
		color: var(--muted);
		text-decoration: none;
	}

	@media (max-width: 760px) {
		.now-glance {
			grid-template-columns: 1fr;
		}

		.on-this-day-list {
			grid-template-columns: 1fr;
		}
	}
</style>
