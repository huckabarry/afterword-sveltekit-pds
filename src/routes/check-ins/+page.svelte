<script lang="ts">
	import { excerpt, formatDate } from '$lib/format';
	import type { Checkin } from '$lib/server/atproto';
	import CheckinMap from '$lib/components/CheckinMap.svelte';

	let { data }: { data: { checkins: Checkin[] } } = $props();
</script>

<svelte:head>
	<title>Check-ins | Afterword PDS Lab</title>
</svelte:head>

<section class="page-head">
	<h1 class="section-title">Check-ins</h1>
	<p class="page-head__lede">
		Places saved from your custom PDS collection, rendered live through SvelteKit.
	</p>
</section>

<section class="list">
	{#each data.checkins as item}
		<article class="card surface">
			<a class="card__link-wrap" href={item.canonicalPath}>
				<div class="card__copy">
					<div class="card__meta">
						<span>{formatDate(item.visitedAt)}</span>
						{#if item.place}
							<span>{item.place}</span>
						{/if}
						{#if item.visibility}
							<span>{item.visibility}</span>
						{/if}
					</div>
					<h2>{item.name}</h2>
					{#if item.venueCategory}
						<p class="card__kicker">{item.venueCategory}</p>
					{/if}
					{#if item.note || item.excerpt}
						<p>{excerpt(item.excerpt || item.note, 220)}</p>
					{/if}
				</div>
				{#if item.latitude !== null && item.longitude !== null}
					<CheckinMap
						latitude={item.latitude}
						longitude={item.longitude}
						name={item.name}
						compact={true}
					/>
				{/if}
			</a>
		</article>
	{/each}
</section>

<style>
	.page-head {
		margin-bottom: 1.2rem;
	}

	.page-head__lede {
		margin: 0;
		line-height: 1.6;
		color: #b0b3ae;
	}

	.list {
		display: grid;
		gap: 1rem;
	}

	.card {
		display: grid;
	}

	.card__link-wrap {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 1rem;
		text-decoration: none;
	}

	.card__copy {
		display: grid;
		gap: 0.65rem;
	}

	.card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.9rem;
		font-size: 0.82rem;
		color: #b0b3ae;
	}

	.card__kicker {
		margin: -0.1rem 0 0;
		color: #b0b3ae;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	h2,
	p {
		margin: 0;
	}

	h2 {
		color: #ffffff;
	}

	p {
		color: #b0b3ae;
	}

	:global(.card__link-wrap .checkin-map__frame--compact) {
		min-height: 220px;
		border-radius: 0.85rem;
	}

	@media (max-width: 800px) {
		.card__link-wrap {
			grid-template-columns: 1fr;
		}
	}
</style>
