<script lang="ts">
	import type { Checkin } from '$lib/server/atproto';
	import { formatDate } from '$lib/format';
	import CheckinMap from '$lib/components/CheckinMap.svelte';
	import type { BlogPost } from '$lib/server/ghost';
	import type { AlbumEntry, TrackEntry } from '$lib/server/music';

	let {
		data
	}: {
		data: {
			intro: {
				title: string;
				description: string;
				paragraphs: string[];
			};
			nowPost: BlogPost | null;
			nowImages: Array<{
				id: string;
				imageUrl: string;
				alt: string;
			}>;
			nowContentHtml: string;
			latestCheckin: Checkin | null;
			albums: AlbumEntry[];
			tracks: TrackEntry[];
		};
	} = $props();

	let nowImageIndex = $state(0);
	let currentAlbumPage = $state(0);
	let touchStartX = 0;
	let touchDeltaX = 0;

	function showPrevNowImage() {
		nowImageIndex = (nowImageIndex - 1 + data.nowImages.length) % data.nowImages.length;
	}

	function showNextNowImage() {
		nowImageIndex = (nowImageIndex + 1) % data.nowImages.length;
	}

	function getAlbumPageCount() {
		return Math.max(1, Math.ceil(data.albums.length / 2));
	}

	function getVisibleAlbums() {
		const start = currentAlbumPage * 2;
		return data.albums.slice(start, start + 2);
	}

	function showPreviousAlbumPage() {
		currentAlbumPage = (currentAlbumPage - 1 + getAlbumPageCount()) % getAlbumPageCount();
	}

	function showNextAlbumPage() {
		currentAlbumPage = (currentAlbumPage + 1) % getAlbumPageCount();
	}

	function handleNowTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0]?.clientX ?? 0;
		touchDeltaX = 0;
	}

	function handleNowTouchMove(event: TouchEvent) {
		const currentX = event.touches[0]?.clientX ?? touchStartX;
		touchDeltaX = currentX - touchStartX;
	}

	function handleNowTouchEnd() {
		if (Math.abs(touchDeltaX) < 40) {
			touchDeltaX = 0;
			return;
		}

		if (touchDeltaX < 0) {
			showNextNowImage();
		} else {
			showPrevNowImage();
		}

		touchDeltaX = 0;
	}

	function getNowIntroParagraph() {
		return data.intro.paragraphs[0] || data.intro.description;
	}
</script>

<svelte:head>
	<title>{data.intro.title} | Bryan Robb</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.intro.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p>{getNowIntroParagraph()}</p>
			</section>
		</div>
	</article>
</section>

{#if data.nowPost}
	<section class="section-block">
		<h2 class="section-title">Latest Now</h2>
		<article class="content content-page">
			<div class="post-full-content">
				<section class="content-body">
					<div class="entry__meta">
						<time datetime={data.nowPost.publishedAt.toISOString()}>
							{formatDate(data.nowPost.publishedAt)}
						</time>
					</div>
					<h3 class="entry__title">
						<a href={data.nowPost.path}>{data.nowPost.title}</a>
					</h3>
					{#if data.nowImages.length > 1}
						<section class="now-carousel" aria-label="Now post images">
							<div
								class="now-carousel__frame"
								role="group"
								aria-label="Now post image carousel"
								ontouchstart={handleNowTouchStart}
								ontouchmove={handleNowTouchMove}
								ontouchend={handleNowTouchEnd}
							>
								<div class="now-carousel__viewport">
									{#each data.nowImages as image, index}
										{#if index === nowImageIndex}
											<a
												class="now-carousel__slide"
												href={image.imageUrl}
												target="_blank"
												rel="noreferrer"
											>
												<img
													class="now-carousel__image"
													src={image.imageUrl}
													alt={image.alt || data.nowPost.title}
												/>
											</a>
										{/if}
									{/each}
								</div>
								<div class="now-carousel__controls">
									<button class="now-carousel__button" type="button" onclick={showPrevNowImage}>
										Prev
									</button>
									<span class="now-carousel__position">
										{nowImageIndex + 1} / {data.nowImages.length}
									</span>
									<button class="now-carousel__button" type="button" onclick={showNextNowImage}>
										Next
									</button>
								</div>
								<div class="now-carousel__dots" aria-hidden="true">
									{#each data.nowImages as _, index}
										<span class:now-carousel__dot--active={index === nowImageIndex} class="now-carousel__dot"></span>
									{/each}
								</div>
							</div>
						</section>
					{/if}
					<div class="entry__content">
						{@html data.nowContentHtml}
					</div>
				</section>
			</div>
		</article>
	</section>
{/if}

{#if data.latestCheckin}
	<section class="section-block section-block-checkin">
		<h2 class="section-title">Latest Check-In</h2>
		<article class="checkin-card checkin-card--featured">
			{#if data.latestCheckin.coverImage}
				<a class="checkin-card__media" href={data.latestCheckin.canonicalPath}>
					<img
						class="checkin-card__image"
						src={data.latestCheckin.coverImage}
						alt={data.latestCheckin.name}
					/>
				</a>
			{/if}
			<div class="checkin-card__body">
				<div class="checkin-card__meta">
					<time datetime={data.latestCheckin.visitedAt.toISOString()}>
						{formatDate(data.latestCheckin.visitedAt)}
					</time>
					{#if data.latestCheckin.place}
						<span>{data.latestCheckin.place}</span>
					{/if}
				</div>
				<h3 class="checkin-card__title">
					<a href={data.latestCheckin.canonicalPath}>{data.latestCheckin.name}</a>
				</h3>
				{#if data.latestCheckin.excerpt || data.latestCheckin.note}
					<p class="checkin-card__excerpt">
						{data.latestCheckin.excerpt || data.latestCheckin.note}
					</p>
				{/if}
			</div>
		</article>
		{#if data.latestCheckin.mapEmbedUrl}
			<section class="checkin-map" aria-label="Map">
				<CheckinMap
					latitude={data.latestCheckin.latitude}
					longitude={data.latestCheckin.longitude}
					name={data.latestCheckin.name}
				/>
				<div class="checkin-map__actions">
					{#if data.latestCheckin.appleMapsUrl}
						<a class="post-action-link" href={data.latestCheckin.appleMapsUrl} target="_blank" rel="noreferrer">
							Open in Maps
						</a>
					{/if}
					<a class="post-action-link" href={data.latestCheckin.canonicalPath}>View full check-in</a>
					<a class="post-action-link" href="/check-ins">All check-ins</a>
				</div>
			</section>
		{/if}
	</section>
{/if}

{#if data.tracks.length}
	<section class="section-block">
		<div class="section-head section-head--now">
			<h2 class="section-title">Listening Now</h2>
		</div>
		<section class="track-list">
			{#each data.tracks as track}
				<article class="track-row track-row--now">
					{#if track.artworkUrl}
						<a class="track-row__art-link" href={track.localPath}>
							<img class="track-row__art" src={track.artworkUrl} alt={track.trackTitle} />
						</a>
					{/if}
					<div class="track-row__body track-row__body--now">
						<a class="track-row__link" href={track.localPath}>
							<time class="track-row__date" datetime={track.publishedAt.toISOString()}>
								{track.displayDate}
							</time>
							<h3 class="track-row__title">{track.trackTitle}</h3>
							<p class="track-row__artist">{track.artist}</p>
						</a>
					</div>
					{#if track.note}
						<p class="track-row__note track-row__note--now">{track.note}</p>
					{/if}
					{#if track.previewUrl}
						<div class="track-preview track-preview--inline track-preview--now">
							<audio
								controls
								preload="none"
								src={track.previewUrl}
								aria-label={`Preview ${track.trackTitle} by ${track.artist}`}
							></audio>
						</div>
					{/if}
					<div class="track-row__actions track-row__actions--now">
						{#each track.listenLinks as link}
							<a class="tag-pill track-row__action" href={link.url} target="_blank" rel="noreferrer">
								{link.label}
							</a>
						{/each}
					</div>
				</article>
			{/each}
		</section>
		<div class="home-stream-tags">
			<a class="tag-pill" href="/listening">Tracks</a>
			<a class="home-updates__more-link" href="/listening">More listening notes <span aria-hidden="true">→</span></a>
		</div>
	</section>
{/if}

{#if data.albums.length}
	<section class="section-block">
		<div class="section-head section-head--now">
			<h2 class="section-title">Album Rotation</h2>
			{#if data.albums.length > 2}
				<div class="home-updates__controls">
					<button class="home-updates__button" type="button" onclick={showPreviousAlbumPage}>
						Back
					</button>
					<button class="home-updates__button" type="button" onclick={showNextAlbumPage}>
						Next
					</button>
				</div>
			{/if}
		</div>
		<section class="cover-grid">
			{#each getVisibleAlbums() as album}
				<article class="cover-card">
					<a class="cover-card-link" href={album.localPath}>
						{#if album.coverImage}
							<img class="cover-card-image" src={album.coverImage} alt={album.albumTitle} />
						{:else}
							<span class="cover-card-image cover-card-image-fallback" aria-hidden="true"></span>
						{/if}
						<span class="cover-card-title">{album.albumTitle}</span>
						{#if album.artist}
							<span class="cover-card-subtitle">{album.artist}</span>
						{/if}
					</a>
				</article>
			{/each}
		</section>
		{#if data.albums.length > 2}
			<div class="now-albums__position-row" aria-hidden="true">
				<span class="now-albums__position">{currentAlbumPage + 1} / {getAlbumPageCount()}</span>
			</div>
		{/if}
		<div class="home-stream-tags">
			<a class="tag-pill" href="/music">Albums</a>
			<a class="home-updates__more-link" href="/music">See all albums <span aria-hidden="true">→</span></a>
		</div>
	</section>
{/if}

<style>
	.section-head--now {
		margin-bottom: 1.15rem;
	}

	.track-row--now {
		grid-template-columns: clamp(5.25rem, 20vw, 7.75rem) minmax(0, 1fr);
		column-gap: 1rem;
		row-gap: 0.7rem;
	}

	.track-row__body--now {
		min-width: 0;
		align-self: center;
	}

	.track-row--now .track-row__art-link {
		display: block;
		width: 100%;
	}

	.track-row--now .track-row__art {
		width: 100%;
		height: auto;
		aspect-ratio: 1 / 1;
	}

	.track-row--now .track-row__date {
		margin-bottom: 0.08rem;
	}

	.track-row--now .track-row__title {
		font-size: 1.08rem;
	}

	.track-row--now .track-row__artist {
		margin-top: 0.08rem;
		font-size: 0.98rem;
	}

	.track-row__note--now,
	.track-preview--now,
	.track-row__actions--now {
		grid-column: 1 / -1;
		width: 100%;
	}

	.track-row__note--now {
		margin: 0;
	}

	.track-preview--now {
		margin-top: 0;
	}

	.track-preview--now audio {
		width: 100%;
		max-width: none;
	}

	.track-row__actions--now {
		margin-top: 0;
		width: 100%;
	}

	.now-albums__position-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.55rem;
	}

	.now-albums__position {
		display: inline-flex;
		align-items: center;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1;
	}

	.now-carousel {
		margin: 0 0 1.15rem;
	}

	.now-carousel__frame {
		position: relative;
	}

	.now-carousel__viewport {
		overflow: hidden;
		border-radius: 0.75rem;
	}

	.now-carousel__slide {
		display: block;
	}

	.now-carousel__image {
		display: block;
		width: 100%;
		max-height: 36rem;
		object-fit: cover;
		border-radius: 0.75rem;
	}

	.now-carousel__controls {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: rgba(23, 24, 25, 0.72);
		backdrop-filter: blur(8px);
		color: #d4d7d8;
		font-size: 0.84rem;
	}

	.now-carousel__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.18rem 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.03);
		color: #d4d7d8;
		font: inherit;
		cursor: pointer;
	}

	.now-carousel__button:hover {
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.25);
	}

	.now-carousel__position {
		white-space: nowrap;
		font-size: 0.8rem;
		line-height: 1;
	}

	.now-carousel__dots {
		display: none;
	}

	.now-carousel__dot {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.28);
	}

	.now-carousel__dot--active {
		background: #f2f4a3;
	}

	@media (max-width: 640px) {
		.track-row--now {
			grid-template-columns: 4.5rem minmax(0, 1fr);
			column-gap: 0.85rem;
		}

		.track-row--now .track-row__art-link {
			width: 4.5rem;
		}

		.track-row--now .track-row__art {
			width: 4.5rem;
			height: 4.5rem;
		}

		.cover-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.now-carousel__viewport {
			overflow: hidden;
		}

		.now-carousel__image {
			max-height: 21rem;
		}

		.now-carousel__controls {
			display: none;
		}

		.now-carousel__dots {
			display: flex;
			justify-content: center;
			gap: 0.35rem;
			margin-top: 0.55rem;
		}
	}
</style>
