<script lang="ts">
	import { excerpt, formatDate } from '$lib/format';
	import type { Checkin } from '$lib/server/atproto';

	let { data }: { data: { checkins: Checkin[] } } = $props();
</script>

<svelte:head>
	<title>Check-ins</title>
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
			<a class="card__overlay-link" href={item.canonicalPath} aria-label={`Open check-in for ${item.name}`}>
				<span class="sr-only">Open {item.name}</span>
			</a>
			<div class="card__link-wrap">
				<div class="card__media">
					{#if item.mapEmbedUrl}
						<iframe
							class="card__map-embed"
							src={item.mapEmbedUrl}
							title={`Map showing ${item.name}`}
							loading="lazy"
							aria-hidden="true"
							tabindex="-1"
						></iframe>
					{:else if item.coverImage}
						<img class="card__image" src={item.coverImage} alt={item.name} loading="lazy" />
					{/if}
				</div>
				<div class="card__copy">
					<div class="card__meta">
						<time datetime={item.visitedAt.toISOString()}>{formatDate(item.visitedAt)}</time>
						{#if item.visibility && item.visibility !== 'public'}
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
			</div>
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
		gap: 1.5rem;
	}

	.card {
		display: grid;
		position: relative;
	}

	.card__link-wrap {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		text-decoration: none;
		align-items: stretch;
	}

	.card__overlay-link {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: 1rem;
	}

	.card__overlay-link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
	}

	.card__copy {
		display: grid;
		align-content: start;
		gap: 0.7rem;
		padding: 0.3rem 0;
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
		margin: 0.35rem 0 0;
		color: var(--muted);
		line-height: 1.65;
	}

	.card__media {
		position: relative;
		display: block;
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

	.card__map-embed {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		pointer-events: none;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

</style>
