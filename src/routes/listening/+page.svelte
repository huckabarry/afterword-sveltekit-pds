<script lang="ts">
	import type { TrackEntry } from '$lib/server/music';

	let { data }: { data: { tracks: TrackEntry[] } } = $props();
</script>

<svelte:head>
	<title>Listening Now | Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Listening Now</h1>
	<p class="stream-head__lede">Recent track notes mirrored from my Crucial Tracks feed.</p>
</section>

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
					<h2 class="track-row__title">{track.trackTitle}</h2>
					<p class="track-row__artist">{track.artist}</p>
					{#if track.note}
						<p class="track-row__note">{track.excerpt}</p>
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
	{:else}
		<article class="track-row">
			<p>No track notes are available yet.</p>
		</article>
	{/each}
</section>
