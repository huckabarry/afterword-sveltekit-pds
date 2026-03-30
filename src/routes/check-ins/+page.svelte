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
		Places I’ve saved along the way, with notes, maps, and a little context for why they mattered.
	</p>
</section>

<section class="list">
	{#each data.checkins as item}
		<article class="card surface">
			<a class="card__link-wrap" href={item.canonicalPath}>
				<div class="card__media">
					{#if item.coverImage}
						<img class="card__image" src={item.coverImage} alt={item.name} loading="lazy" />
					{:else if item.latitude !== null && item.longitude !== null}
						<CheckinMap
							latitude={item.latitude}
							longitude={item.longitude}
							name={item.name}
							compact={true}
						/>
					{/if}
				</div>
				<div class="card__copy">
					<div class="card__meta">
						<time datetime={item.visitedAt.toISOString()}>{formatDate(item.visitedAt)}</time>
						{#if item.visibility}
							<span class="card__meta-pill">{item.visibility}</span>
						{/if}
					</div>
					<h2 class="card__title">{item.name}</h2>
					{#if item.place}
						<p class="card__place">{item.place}</p>
					{/if}
					{#if item.venueCategory}
						<p class="card__kicker">{item.venueCategory}</p>
					{/if}
					{#if item.note || item.excerpt}
						<p class="card__excerpt">{excerpt(item.excerpt || item.note, 220)}</p>
					{/if}
				</div>
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
		grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
		gap: 1.2rem;
		text-decoration: none;
		align-items: stretch;
	}

	.card__copy {
		display: grid;
		align-content: start;
		gap: 0.55rem;
		padding: 0.15rem 0;
	}

	.card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.9rem;
		font-size: 0.82rem;
		color: var(--accent);
		align-items: center;
	}

	.card__meta-pill {
		padding: 0.18rem 0.55rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--muted);
		text-transform: capitalize;
	}

	.card__title {
		margin: 0;
		font-size: clamp(1.35rem, 2vw, 1.75rem);
		line-height: 1.08;
		color: #ffffff;
	}

	.card__place {
		margin: 0;
		font-size: 1rem;
		line-height: 1.45;
		color: #d7d8d4;
	}

	.card__kicker {
		margin: 0.1rem 0 0;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.76rem;
		font-weight: 700;
	}

	.card__excerpt {
		margin: 0.2rem 0 0;
		color: var(--muted);
		line-height: 1.65;
	}

	.card__media {
		order: 2;
		overflow: hidden;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
		aspect-ratio: 16 / 10;
	}

	.card__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	:global(.card__media .checkin-map__frame--compact) {
		min-height: 0;
		height: 100%;
		border-radius: 0;
	}

	@media (max-width: 800px) {
		.card__link-wrap {
			grid-template-columns: 1fr;
		}

		.card__media {
			order: 0;
		}
	}
</style>
