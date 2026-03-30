<script lang="ts">
	import { formatDate } from '$lib/format';
	import type { Checkin } from '$lib/server/atproto';
	import CheckinMap from '$lib/components/CheckinMap.svelte';

	let {
		data
	}: {
		data: {
			item: Checkin;
			absoluteUrl: string;
			ogImageUrl: string;
			description: string;
			previousItem: Checkin | null;
			nextItem: Checkin | null;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.item.name} | Check-ins</title>
	<meta name="description" content={data.description} />
	<link rel="canonical" href={data.absoluteUrl} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={`${data.item.name} | Check-ins`} />
	<meta property="og:description" content={data.description} />
	<meta property="og:url" content={data.absoluteUrl} />
	<meta property="og:image" content={data.ogImageUrl} />
	<meta property="og:image:type" content="image/svg+xml" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={`${data.item.name} | Check-ins`} />
	<meta name="twitter:description" content={data.description} />
	<meta name="twitter:image" content={data.ogImageUrl} />
</svelte:head>

<article class="entry entry--checkin">
	<div class="entry__meta">
		<a href="/check-ins">Check-ins</a>
		<time>{formatDate(data.item.visitedAt)}</time>
		{#if data.item.place}
			<span>{data.item.place}</span>
		{/if}
	</div>

	<h1 class="entry__title">{data.item.name}</h1>

	{#if data.item.mapEmbedUrl}
		<section class="checkin-map" aria-label="Map">
			<CheckinMap
				latitude={data.item.latitude}
				longitude={data.item.longitude}
				name={data.item.name}
			/>
			<div class="checkin-map__actions">
				{#if data.item.appleMapsUrl}
					<a class="post-action-link" href={data.item.appleMapsUrl} target="_blank" rel="noreferrer">Open in Apple Maps</a>
				{/if}
				{#if data.item.latitude && data.item.longitude}
					<a
						class="post-action-link"
						href={`https://www.openstreetmap.org/?mlat=${data.item.latitude}&mlon=${data.item.longitude}#map=14/${data.item.latitude}/${data.item.longitude}`}
						target="_blank"
						rel="noreferrer"
					>
						Open in OpenStreetMap
					</a>
				{/if}
			</div>
		</section>
	{/if}

	{#if data.item.coverImage}
		<figure class="entry__figure">
			<img src={data.item.coverImage} alt={data.item.name} />
		</figure>
	{/if}

	{#if data.item.photoUrls.length > 1}
		<section class="checkin-gallery" aria-label="More photos">
			{#each data.item.photoUrls as photo}
				{#if photo !== data.item.coverImage}
					<img class="checkin-gallery__image" src={photo} alt={data.item.name} />
				{/if}
			{/each}
		</section>
	{/if}

	{#if data.item.note}
		<div class="entry__content">
			<p>{data.item.note}</p>
		</div>
	{/if}

	<dl class="checkin-detail__meta">
		{#if data.item.address}
			<div>
				<dt>Address</dt>
				<dd>{data.item.address}</dd>
			</div>
		{/if}
		{#if data.item.venueCategory}
			<div>
				<dt>Category</dt>
				<dd>{data.item.venueCategory}</dd>
			</div>
		{/if}
		{#if data.item.visibility}
			<div>
				<dt>Visibility</dt>
				<dd>{data.item.visibility}</dd>
			</div>
		{/if}
	</dl>

	{#if data.item.tags.length}
		<div class="checkin-card__tags">
			{#each data.item.tags as tag}
				<span class="tag-pill">{tag}</span>
			{/each}
		</div>
	{/if}

	<footer class="post-actions">
		{#if data.item.website}
			<a class="post-action-link" href={data.item.website} target="_blank" rel="noreferrer">Visit place website</a>
		{/if}
		<a class="post-action-link" href="/check-ins">Back to all check-ins</a>
	</footer>

	{#if data.previousItem || data.nextItem}
		<nav class="post-navigation">
			<ul>
				<li class="post-navigation-item post-navigation-item-previous">
					{#if data.previousItem}
						<a class="post-navigation-link" href={data.previousItem.canonicalPath}>
							<span class="post-navigation-label">← Previous</span>
							<span class="post-navigation-title">{data.previousItem.name}</span>
						</a>
					{/if}
				</li>
				<li class="post-navigation-item post-navigation-item-next">
					{#if data.nextItem}
						<a class="post-navigation-link" href={data.nextItem.canonicalPath}>
							<span class="post-navigation-label">Next →</span>
							<span class="post-navigation-title">{data.nextItem.name}</span>
						</a>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
</article>
