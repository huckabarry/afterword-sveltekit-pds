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
	let touchStartX = 0;
	let touchDeltaX = 0;

	function shouldRenderIntroParagraph(paragraph: string) {
		const normalizedParagraph = paragraph.trim().toLowerCase();
		const normalizedDescription = data.intro.description.trim().toLowerCase();

		if (!normalizedParagraph || normalizedParagraph === normalizedDescription) {
			return false;
		}

		return !normalizedParagraph.startsWith(normalizedDescription.replace(/[.:!?]+$/g, ''));
	}

	function showPrevNowImage() {
		nowImageIndex = (nowImageIndex - 1 + data.nowImages.length) % data.nowImages.length;
	}

	function showNextNowImage() {
		nowImageIndex = (nowImageIndex + 1) % data.nowImages.length;
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
</script>

<svelte:head>
	<title>{data.intro.title} | Bryan Robb</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.intro.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p>{data.intro.description}</p>
				{#each data.intro.paragraphs as paragraph}
					{#if shouldRenderIntroParagraph(paragraph)}
						<p>{paragraph}</p>
					{/if}
				{/each}
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
								<a
									class="now-carousel__image-link"
									href={data.nowImages[nowImageIndex].imageUrl}
									target="_blank"
									rel="noreferrer"
								>
									<img
										class="now-carousel__image"
										src={data.nowImages[nowImageIndex].imageUrl}
										alt={data.nowImages[nowImageIndex].alt || data.nowPost.title}
									/>
								</a>
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
				<article class="track-row">
					{#if track.artworkUrl}
						<a class="track-row__art-link" href={track.localPath}>
							<img class="track-row__art" src={track.artworkUrl} alt={track.trackTitle} />
						</a>
					{/if}
					<div class="track-row__body">
						<a class="track-row__link" href={track.localPath}>
							<time class="track-row__date" datetime={track.publishedAt.toISOString()}>
								{track.displayDate}
							</time>
							<h3 class="track-row__title">{track.trackTitle}</h3>
							<p class="track-row__artist">{track.artist}</p>
							{#if track.note}
								<p class="track-row__note">{track.note}</p>
							{/if}
						</a>
						{#if track.previewUrl}
							<div class="track-preview track-preview--inline">
								<audio
									controls
									preload="none"
									src={track.previewUrl}
									aria-label={`Preview ${track.trackTitle} by ${track.artist}`}
								></audio>
							</div>
						{/if}
						<div class="track-row__actions">
							{#each track.listenLinks as link}
								<a class="tag-pill track-row__action" href={link.url} target="_blank" rel="noreferrer">
									{link.label}
								</a>
							{/each}
						</div>
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
		</div>
		<section class="cover-grid">
			{#each data.albums as album}
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

	.now-carousel {
		margin: 0 0 1.15rem;
	}

	.now-carousel__frame {
		position: relative;
	}

	.now-carousel__image-link {
		display: block;
		overflow: hidden;
		border-radius: 0.75rem;
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

	@media (max-width: 640px) {
		.now-carousel__controls {
			display: none;
		}
	}
</style>
