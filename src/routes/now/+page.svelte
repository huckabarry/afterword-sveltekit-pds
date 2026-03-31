<script lang="ts">
	import CheckinMap from '$lib/components/CheckinMap.svelte';
	import { shouldSurfaceEarlierWebTitle } from '$lib/earlier-web';
	import { excerpt, formatDate } from '$lib/format';
	import type { Checkin } from '$lib/server/atproto';
	import type { EarlierWebOnThisDayPost } from '$lib/server/earlier-web';
	import type { GalleryPhotoItem } from '$lib/server/gallery-assets';
	import type { BlogPost } from '$lib/server/ghost';
	import type { TrackEntry } from '$lib/server/music';

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
			latestTrack: TrackEntry | null;
			latestCheckin: Checkin | null;
			latestPhoto: GalleryPhotoItem | null;
			onThisDayPosts: EarlierWebOnThisDayPost[];
		};
	} = $props();

	let onThisDayIndex = $state(0);

	const latestCheckinText = $derived.by(() =>
		data.latestCheckin ? excerpt(data.latestCheckin.excerpt || data.latestCheckin.note, 180) : ''
	);
	const latestTrackText = $derived.by(() =>
		data.latestTrack ? excerpt(data.latestTrack.note || data.latestTrack.excerpt, 180) : ''
	);
	const currentOnThisDayPost = $derived.by(() =>
		data.onThisDayPosts.length
			? data.onThisDayPosts[((onThisDayIndex % data.onThisDayPosts.length) + data.onThisDayPosts.length) %
					data.onThisDayPosts.length]
			: null
	);
	const currentOnThisDayHasTitle = $derived.by(() =>
		currentOnThisDayPost ? shouldSurfaceEarlierWebTitle(currentOnThisDayPost) : false
	);
	const currentOnThisDayTitle = $derived.by(() => {
		if (!currentOnThisDayPost) return '';
		if (currentOnThisDayHasTitle) return currentOnThisDayPost.title;
		return `A note from ${new Date(currentOnThisDayPost.publishedAt).getFullYear()}`;
	});
	const currentOnThisDayText = $derived.by(() =>
		currentOnThisDayPost ? excerpt(currentOnThisDayPost.excerpt, 180) : ''
	);

	function showPreviousOnThisDay() {
		if (data.onThisDayPosts.length > 1) onThisDayIndex -= 1;
	}

	function showNextOnThisDay() {
		if (data.onThisDayPosts.length > 1) onThisDayIndex += 1;
	}

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
	<h2 class="section-title">Life Lately</h2>

	{#if data.nowPosts.length}
		<div class="now-post-list">
			{#each data.nowPosts as post}
				<a class="now-post-row" href={post.path}>
					<time class="now-post-row__date" datetime={post.publishedAt.toISOString()}>
						{formatDate(post.publishedAt)}
					</time>
					<h3 class="now-post-row__title">{post.title}</h3>
				</a>
			{/each}
		</div>
	{:else}
		<p class="page-head__lede">No now posts are available yet.</p>
	{/if}
</section>

{#if data.latestTrack || data.latestCheckin || data.latestPhoto || currentOnThisDayPost}
	<section class="section-block">
		<h2 class="section-title">Signals</h2>
		<div class="now-glance">
			{#if data.latestTrack}
				<article class="now-card">
					<p class="now-card__kicker">Latest Track</p>

					<div class="now-card__copy">
						<div class="now-card__meta">
							<time datetime={data.latestTrack.publishedAt.toISOString()}>
								{formatDate(data.latestTrack.publishedAt)}
							</time>
						</div>

						<h2 class="now-card__title">
							<a href={data.latestTrack.localPath}>{data.latestTrack.trackTitle}</a>
						</h2>

						{#if data.latestTrack.artist}
							<p class="now-card__subhead">{data.latestTrack.artist}</p>
						{:else}
							<p class="now-card__subhead now-card__subhead--ghost" aria-hidden="true">&nbsp;</p>
						{/if}
					</div>

					{#if data.latestTrack.artworkUrl}
						<a class="now-photo now-photo--artwork" href={data.latestTrack.localPath}>
							<img
								class="now-photo__image"
								src={data.latestTrack.artworkUrl}
								alt={data.latestTrack.artist
									? `${data.latestTrack.trackTitle} by ${data.latestTrack.artist}`
									: data.latestTrack.trackTitle}
								loading="lazy"
							/>
						</a>
					{/if}

					{#if latestTrackText}
						<p class="now-card__text">{latestTrackText}</p>
					{/if}

					<div class="now-card__actions">
						<a class="tag-pill now-card__action" href={data.latestTrack.localPath}>View track</a>
						<a class="tag-pill now-card__action" href="/listening">Listening</a>
					</div>
				</article>
			{/if}

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

						<p class="now-card__subhead">Gallery</p>
					</div>

					<a class="now-photo now-photo--artwork" href={data.latestPhoto.postPath}>
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

			{#if currentOnThisDayPost}
				<article class="now-card">
					<p class="now-card__kicker">On This Date</p>

					<div class="now-card__copy">
						<div class="now-card__meta">
							<time datetime={currentOnThisDayPost.publishedAt}>
								{new Date(currentOnThisDayPost.publishedAt).toLocaleDateString('en-US', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</time>
							{#if data.onThisDayPosts.length > 1}
								<span>
									{((onThisDayIndex % data.onThisDayPosts.length) + data.onThisDayPosts.length) %
										data.onThisDayPosts.length + 1}
									of {data.onThisDayPosts.length}
								</span>
							{/if}
						</div>

						<h2 class="now-card__title">
							<a href={currentOnThisDayPost.path}>{currentOnThisDayTitle}</a>
						</h2>

						<p class="now-card__subhead">Earlier Web</p>
					</div>

					{#if currentOnThisDayPost.coverImage}
						<a class="now-photo now-photo--artwork" href={currentOnThisDayPost.path}>
							<img
								class="now-photo__image"
								src={currentOnThisDayPost.coverImage}
								alt={currentOnThisDayPost.title}
								loading="lazy"
							/>
						</a>
					{/if}

					{#if currentOnThisDayText}
						<p class="now-card__text">
							<a class="now-card__text-link" href={currentOnThisDayPost.path}>
								{currentOnThisDayText}
							</a>
						</p>
					{/if}

					<div class="now-card__actions">
						{#if data.onThisDayPosts.length > 1}
							<button class="tag-pill now-card__action now-card__action-button" type="button" onclick={showPreviousOnThisDay}>
								Previous
							</button>
							<button class="tag-pill now-card__action now-card__action-button" type="button" onclick={showNextOnThisDay}>
								Next
							</button>
						{:else}
							<a class="tag-pill now-card__action" href={currentOnThisDayPost.path}>View post</a>
							<a class="tag-pill now-card__action" href="/earlier-web">Earlier Web</a>
						{/if}
					</div>
				</article>
			{/if}
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
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
	}

	.now-card__text-link {
		color: inherit;
		text-decoration: none;
	}

	.now-card__map {
		display: block;
		overflow: hidden;
		border-radius: 0.85rem;
		aspect-ratio: 1 / 1;
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

	.now-photo--artwork {
		aspect-ratio: 1 / 1;
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

	.now-card__action-button {
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		border: none;
		padding: 0.2rem 0.55rem;
		color: inherit;
		background: transparent;
		font-size: 0.85rem;
		font-style: normal;
		font-weight: 500;
		line-height: 1.2;
	}

	.now-post-list {
		margin-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.now-post-row {
		display: grid;
		grid-template-columns: 7.75rem minmax(0, 1fr);
		gap: 1rem;
		align-items: baseline;
		padding: 0.95rem 0;
		text-decoration: none;
		color: inherit;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent 25%);
	}

	.now-post-row__title {
		margin: 0;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 1rem;
		font-style: italic;
		font-weight: 500;
		line-height: 1.3;
		text-align: left;
	}

	.now-post-row__date {
		color: var(--accent);
		font-family: 'IBM Plex Mono', monospace;
		font-size: 0.94rem;
		font-style: italic;
		white-space: nowrap;
		text-align: left;
	}

	@media (max-width: 760px) {
		.now-glance {
			grid-template-columns: 1fr;
		}
	}
</style>
