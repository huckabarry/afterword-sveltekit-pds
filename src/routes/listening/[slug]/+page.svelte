<script lang="ts">
	import type { TrackEntry } from '$lib/server/music';

	let {
		data
	}: {
		data: {
			track: TrackEntry;
			previousTrack: TrackEntry | null;
			nextTrack: TrackEntry | null;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.track.trackTitle} | Listening Now</title>
</svelte:head>

<article class="entry entry--media">
	<div class="entry__meta">
		<a href="/listening">Listening Now</a>
		<time>{data.track.displayDate}</time>
	</div>
	<div class="media-entry media-entry--track">
		{#if data.track.artworkUrl}
			<figure class="media-entry__cover">
				<img src={data.track.artworkUrl} alt={data.track.trackTitle} />
			</figure>
		{/if}
		<div class="media-entry__body">
			<h1 class="entry__title">{data.track.trackTitle}</h1>
			{#if data.track.artist}
				<p class="media-entry__credit">{data.track.artist}</p>
			{/if}
			{#if data.track.note}
				<div class="media-entry__note">
					<p>{data.track.note}</p>
				</div>
			{/if}
			{#if data.track.previewUrl}
				<div class="track-preview">
					<h2 class="media-entry__links-title">Preview</h2>
					<audio controls preload="none" src={data.track.previewUrl}></audio>
				</div>
			{/if}
			<div class="media-entry__links">
				<h2 class="media-entry__links-title">Listen</h2>
				<ul class="media-entry__links-list">
					{#each data.track.listenLinks as link}
						<li><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<footer class="post-actions" aria-label="Post actions">
		<a class="post-action-link" href="/listening">Back to all track notes</a>
	</footer>

	{#if data.previousTrack || data.nextTrack}
		<nav class="post-navigation">
			<ul>
				<li class="post-navigation-item post-navigation-item-previous">
					{#if data.previousTrack}
						<a class="post-navigation-link" href={data.previousTrack.localPath}>
							<span class="post-navigation-label">← Previous</span>
							<span class="post-navigation-title">{data.previousTrack.trackTitle}</span>
						</a>
					{/if}
				</li>
				<li class="post-navigation-item post-navigation-item-next">
					{#if data.nextTrack}
						<a class="post-navigation-link" href={data.nextTrack.localPath}>
							<span class="post-navigation-label">Next →</span>
							<span class="post-navigation-title">{data.nextTrack.trackTitle}</span>
						</a>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
</article>
