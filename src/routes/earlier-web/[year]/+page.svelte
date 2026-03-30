<script lang="ts">
	import type { EarlierWebPostSummary } from '$lib/server/earlier-web';

	let {
		data
	}: {
		data: {
			year: number;
			posts: EarlierWebPostSummary[];
		};
	} = $props();

	const postsByMonth = $derived.by(() => {
		const groups: Record<string, EarlierWebPostSummary[]> = {};

		for (const post of data.posts) {
			const key = String(post.month);
			const monthPosts = groups[key] || [];
			monthPosts.push(post);
			groups[key] = monthPosts;
		}

		return Object.entries(groups)
			.map(([month, posts]) => [Number(month), posts] as const)
			.sort((a, b) => b[0] - a[0]);
	});

	function formatMonth(month: number) {
		return new Date(Date.UTC(data.year, month - 1, 1)).toLocaleString('en-US', { month: 'long' });
	}
</script>

<svelte:head>
	<title>{data.year} | From an Earlier Web</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">From an Earlier Web</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p class="earlier-web-year-back">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href="/earlier-web">All years</a>
				</p>
				<h2>{data.year}</h2>

				{#each postsByMonth as [month, posts] (month)}
					<section class="earlier-web-month">
						<h3>{formatMonth(month)}</h3>
						<div class="earlier-web-post-list">
							{#each posts as post (post.id)}
								<article class="earlier-web-post-list__item">
									<h4>
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={post.path}>{post.title}</a>
									</h4>
									<p>{post.excerpt}</p>
								</article>
							{/each}
						</div>
					</section>
				{/each}
			</section>
		</div>
	</article>
</section>

<style>
	.earlier-web-year-back {
		margin-bottom: 1rem;
	}

	.earlier-web-year-back a {
		color: inherit;
	}

	.earlier-web-month + .earlier-web-month {
		margin-top: 2rem;
	}

	.earlier-web-post-list {
		display: grid;
		gap: 1rem;
	}

	.earlier-web-post-list__item {
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.earlier-web-post-list__item h4 {
		margin: 0 0 0.4rem;
		font-size: 1.05rem;
	}

	.earlier-web-post-list__item a {
		color: inherit;
		text-decoration: none;
	}

	.earlier-web-post-list__item a:hover {
		text-decoration: underline;
	}

	.earlier-web-post-list__item p {
		margin: 0;
		opacity: 0.82;
	}
</style>
