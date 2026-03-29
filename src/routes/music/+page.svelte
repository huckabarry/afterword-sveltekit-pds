<script lang="ts">
	import type { AlbumEntry } from '$lib/server/music';

	let { data }: { data: { albums: AlbumEntry[] } } = $props();
</script>

<svelte:head>
	<title>Music | Bryan Robb</title>
</svelte:head>

<section class="stream-head">
	<h1 class="stream-head__title">Music</h1>
	<p class="stream-head__lede">
		Albums that have been hanging around long enough to earn a place here. Usually things I kept
		replaying while driving, working, or walking around the neighborhood. For single-song fixations,
		see <a href="/listening/">Listening Now</a>.
	</p>
</section>

<section class="media-grid">
	{#each data.albums as album}
		<article class="media-card">
			<a class="media-card__cover" href={album.localPath}>
				{#if album.coverImage}
					<img src={album.coverImage} alt={album.albumTitle} />
				{:else}
					<span class="media-card__fallback">{album.albumTitle}</span>
				{/if}
			</a>
			<div class="media-card__caption">
				<a class="media-card__title" href={album.localPath}>{album.albumTitle}</a>
				{#if album.artist}
					<p class="media-card__credit">{album.artist}</p>
				{/if}
			</div>
		</article>
	{:else}
		<article class="media-empty">
			<p>No album posts are available yet.</p>
		</article>
	{/each}
</section>
