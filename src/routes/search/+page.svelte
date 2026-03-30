<script lang="ts">
	import type { SearchResult } from '$lib/server/search';

	let {
		data
	}: {
		data: {
			query: string;
			results: SearchResult[];
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.query ? `Search: ${data.query}` : 'Search'} | Afterword</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">Search</h1>
	<div class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#if data.query}
					<p>
						Results for <strong>{data.query}</strong>.
					</p>
				{:else}
					<p>Try searching for a place, artist, book, or idea from the site.</p>
				{/if}

				{#if data.query && data.results.length}
					<div class="search-page-results">
						{#each data.results as result (result.id)}
							<article class="search-page-result">
								<p class="search-page-result__eyebrow">{result.section}</p>
								{#if !result.hideTitle}
									<h2 class="search-page-result__title">
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={result.path}>{result.title}</a>
									</h2>
								{/if}
								<p class="search-page-result__excerpt">{result.excerpt}</p>
							</article>
						{/each}
					</div>
				{:else if data.query}
					<p>No posts matched that search.</p>
				{/if}
			</section>
		</div>
	</div>
</section>

<style>
	.search-page-results {
		display: grid;
		gap: 1.25rem;
		margin-top: 1.5rem;
	}

	.search-page-result {
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.search-page-result__eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.68;
	}

	.search-page-result__title {
		margin: 0 0 0.45rem;
		font-size: 1.25rem;
		line-height: 1.15;
	}

	.search-page-result__title a {
		color: inherit;
		text-decoration: none;
	}

	.search-page-result__title a:hover {
		text-decoration: underline;
	}

	.search-page-result__excerpt {
		margin: 0;
		opacity: 0.82;
	}
</style>
