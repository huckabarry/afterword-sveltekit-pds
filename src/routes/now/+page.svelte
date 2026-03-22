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
			latestCheckin: Checkin | null;
			albums: AlbumEntry[];
			tracks: TrackEntry[];
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.nowPost?.title || data.intro.title} | Bryan Robb</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.nowPost?.title || data.intro.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#if data.nowPost}
					<div class="entry__meta">
						<time datetime={data.nowPost.publishedAt.toISOString()}>
							{formatDate(data.nowPost.publishedAt)}
						</time>
					</div>
					<div class="entry__content">
						{@html data.nowPost.html}
					</div>
				{:else}
					{#each data.intro.paragraphs as paragraph}
						<p>{paragraph}</p>
					{/each}
				{/if}
			</section>
		</div>
	</article>
</section>

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
</style>
