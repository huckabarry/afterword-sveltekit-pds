<script lang="ts">
	import type { EarlierWebYearSummary } from '$lib/server/earlier-web';

	let { data }: { data: { years: EarlierWebYearSummary[] } } = $props();
</script>

<svelte:head>
	<title>From an Earlier Web | Afterword</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">From an Earlier Web</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p>
					Older fragments, status updates, and weblog posts from earlier versions of my life online.
					They vary in polish and mood. That is part of the point.
				</p>

				{#if data.years.length}
					<div class="earlier-web-years">
						{#each data.years as year (year.year)}
							<article class="earlier-web-year">
								<h2>
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={`/earlier-web/${year.year}`}>{year.year}</a>
								</h2>
								<p>{year.postCount} posts</p>
							</article>
						{/each}
					</div>
				{:else}
					<p>The archive has not been imported yet.</p>
				{/if}
			</section>
		</div>
	</article>
</section>

<style>
	.earlier-web-years {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 1rem;
		margin-top: 1.75rem;
	}

	.earlier-web-year {
		padding: 1rem 1.1rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.3rem;
		background: rgba(255, 255, 255, 0.02);
	}

	.earlier-web-year h2 {
		margin: 0 0 0.25rem;
		font-size: 1.15rem;
	}

	.earlier-web-year a {
		color: inherit;
		text-decoration: none;
	}

	.earlier-web-year a:hover {
		text-decoration: underline;
	}

	.earlier-web-year p {
		margin: 0;
		opacity: 0.74;
	}
</style>
