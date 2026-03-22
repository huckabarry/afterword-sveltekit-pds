<script lang="ts">
	import type { AlbumEntry } from '$lib/server/music';

	let {
		data
	}: {
		data: {
			album: AlbumEntry;
			previousAlbum: AlbumEntry | null;
			nextAlbum: AlbumEntry | null;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.album.albumTitle} | Music</title>
</svelte:head>

<article class="entry entry--media">
	<div class="entry__meta">
		<a href="/music">Music</a>
		<time>{data.album.displayDate}</time>
	</div>
	<div class="media-entry">
		{#if data.album.coverImage}
			<figure class="media-entry__cover">
				<img src={data.album.coverImage} alt={data.album.albumTitle} />
			</figure>
		{/if}
		<div class="media-entry__body">
			<h1 class="entry__title">{data.album.albumTitle}</h1>
			{#if data.album.artist}
				<p class="media-entry__credit">{data.album.artist}</p>
			{/if}
			{#if data.album.note}
				<div class="media-entry__note">
					<p>{data.album.note}</p>
				</div>
			{/if}
			<dl class="media-entry__details">
				<div>
					<dt>Added</dt>
					<dd>{data.album.displayDate}</dd>
				</div>
				{#if data.album.sourceUrl}
					<div>
						<dt>Source</dt>
						<dd><a href={data.album.sourceUrl} target="_blank" rel="noreferrer">View on Album Whale</a></dd>
					</div>
				{/if}
			</dl>
			{#if data.album.listenLinks.length}
				<div class="media-entry__links">
					<h2 class="media-entry__links-title">Listen</h2>
					<ul class="media-entry__links-list">
						{#each data.album.listenLinks as link}
							<li><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>

	<footer class="post-actions" aria-label="Post actions">
		<a class="post-action-link" href="/music">Back to all albums</a>
	</footer>

	{#if data.previousAlbum || data.nextAlbum}
		<nav class="post-navigation">
			<ul>
				<li class="post-navigation-item post-navigation-item-previous">
					{#if data.previousAlbum}
						<a class="post-navigation-link" href={data.previousAlbum.localPath}>
							<span class="post-navigation-label">← Previous</span>
							<span class="post-navigation-title">{data.previousAlbum.albumTitle}</span>
						</a>
					{/if}
				</li>
				<li class="post-navigation-item post-navigation-item-next">
					{#if data.nextAlbum}
						<a class="post-navigation-link" href={data.nextAlbum.localPath}>
							<span class="post-navigation-label">Next →</span>
							<span class="post-navigation-title">{data.nextAlbum.albumTitle}</span>
						</a>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
</article>
