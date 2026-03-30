<svelte:head>
	<title>Subscribe | Bryan Robb</title>
	<meta
		name="description"
		content="Subscribe to Afterword by RSS or JSON feed, with options for writing, planning, and status updates."
	/>
</svelte:head>

<script lang="ts">
	const feeds = [
		{
			title: 'Writing',
			description: 'Field notes, planning posts, and other longer writing from Afterword.',
			rssUrl: '/feed.xml',
			jsonUrl: '/feed.json'
		},
		{
			title: 'Planning',
			description: 'Planning and urbanism posts only.',
			rssUrl: '/planning/feed.xml',
			jsonUrl: '/planning/feed.json'
		},
		{
			title: 'Status',
			description: 'Short updates pulled from Bluesky into the site.',
			rssUrl: '/status/feed.xml',
			jsonUrl: '/status/feed-public.json'
		}
	];
</script>

<section class="section-block">
	<h1 class="section-title">Subscribe</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body subscribe-page">
				<p>
					If you’d rather follow this site from your own reader, these are the cleanest feed
					options. RSS is usually the safest choice, but I’ve included JSON feeds too.
				</p>

				<div class="subscribe-feed-list">
					{#each feeds as feed}
						<section class="subscribe-feed-card">
							<h2>{feed.title}</h2>
							<p>{feed.description}</p>
							<div class="subscribe-feed-links">
								<a href={feed.rssUrl}>RSS</a>
								<a href={feed.jsonUrl}>JSON</a>
							</div>
						</section>
					{/each}
				</div>

				<section class="subscribe-planning">
					<h2>Planning via Low Velocity</h2>
					<p>
						My planning posts originate on <a href="https://lowvelocity.org" rel="noreferrer">Low
						Velocity</a>. If you’d rather get them by email, you can subscribe there directly:
					</p>
					<div class="subscribe-embed">
						<div style="height: 40vmin; min-height: 360px;">
							<script
								src="https://cdn.jsdelivr.net/ghost/signup-form@~0.3/umd/signup-form.min.js"
								data-background-color="#1e2021"
								data-text-color="#FFFFFF"
								data-button-color="#4b9cb4"
								data-button-text-color="#FFFFFF"
								data-title="Low Velocity"
								data-description="A journal of cities, places, and the human experience of living in them."
								data-icon="https://lowvelocity.org/content/images/size/w192h192/size/w256h256/2026/02/Low_Velocity_Logo.png"
								data-site="https://lowvelocity.org/"
								data-locale="en"
								async
							></script>
						</div>
					</div>
				</section>
			</section>
		</div>
	</article>
</section>

<style>
	.subscribe-page {
		display: grid;
		gap: 2rem;
	}

	.subscribe-feed-list {
		display: grid;
		gap: 1rem;
	}

	.subscribe-feed-card {
		padding: 1.1rem 1.2rem;
		border: 1px solid rgba(245, 241, 171, 0.18);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.02);
	}

	.subscribe-feed-card h2,
	.subscribe-planning h2 {
		margin: 0 0 0.45rem;
		font-size: 1.05rem;
	}

	.subscribe-feed-card p,
	.subscribe-planning p {
		margin: 0;
	}

	.subscribe-feed-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		margin-top: 0.85rem;
		font-family: var(--font-mono, 'IBM Plex Mono', monospace);
		font-size: 0.92rem;
	}

	.subscribe-feed-links a {
		font-weight: 600;
	}
	
	.subscribe-planning {
		padding-top: 0.25rem;
	}

	.subscribe-embed {
		margin-top: 1rem;
	}
</style>
