<script lang="ts">
	import type { PopfeedItem } from '$lib/server/popfeed';

	let {
		title,
		lede,
		items,
		emptyMessage
	}: {
		title: string;
		lede: string;
		items: PopfeedItem[];
		emptyMessage: string;
	} = $props();

	function getCaption(item: PopfeedItem) {
		return [item.mainCredit, item.listTypeLabel].filter(Boolean).join(' · ');
	}

	function usesPosterRatio(item: PopfeedItem) {
		return item.type === 'movie' || item.type === 'tv_show';
	}
</script>

<section class="stream-head">
	<h1 class="stream-head__title">{title}</h1>
	<p class="stream-head__lede">{lede}</p>
</section>

<section class="media-grid">
	{#each items as item}
		<article class="media-card">
			<a
				class={`media-card__cover ${usesPosterRatio(item) ? 'media-card__cover--poster' : 'media-card__cover--natural'}`}
				href={item.localPath}
			>
				{#if item.posterImage}
					<img src={item.posterImage} alt={item.title} />
				{:else}
					<span
						class={`media-card__fallback ${usesPosterRatio(item) ? 'media-card__fallback--poster' : 'media-card__fallback--natural'}`}
					>
						{item.title}
					</span>
				{/if}
			</a>
			<div class="media-card__caption">
				<a class="media-card__title" href={item.localPath}>{item.title}</a>
				{#if getCaption(item)}
					<p class="media-card__credit">{getCaption(item)}</p>
				{/if}
			</div>
		</article>
	{:else}
		<article class="media-empty">
			<p>{emptyMessage}</p>
		</article>
	{/each}
</section>
