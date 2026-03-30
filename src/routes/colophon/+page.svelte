<script lang="ts">
	let {
		data
	}: {
		data: {
			title: string;
			description: string;
			paragraphs: string[];
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.title} | Bryan Robb</title>
	<meta name="description" content={data.description} />
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#each data.paragraphs as paragraph}
					<p>{paragraph}</p>
				{/each}

				<section class="colophon-follow">
					<h2>Follow Along</h2>
					<p>
						There’s a <a href="/subscribe">Subscribe page</a> with RSS and JSON feeds for
						writing, status updates, and Earlier Web if you’d rather keep up from your own
						reader.
					</p>
					<p>
						Planning posts also originate on
						<a href="https://lowvelocity.org" rel="noreferrer">Low Velocity</a>, where you can
						subscribe by email if that’s more your speed.
					</p>
					<p class="colophon-follow__links">
						<a href="/subscribe">Open subscribe options</a>
						<span aria-hidden="true">/</span>
						<a href="https://lowvelocity.org" rel="noreferrer">Visit Low Velocity</a>
					</p>
				</section>
			</section>
		</div>
	</article>
</section>

<style>
	.colophon-follow {
		margin-top: 2rem;
		padding: 1.2rem 1.25rem;
		border: 1px solid rgba(242, 247, 183, 0.18);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.025);
	}

	.colophon-follow h2 {
		margin: 0 0 0.55rem;
		font-size: 1.05rem;
	}

	.colophon-follow__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: center;
		margin-top: 0.95rem;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 0.92rem;
	}
</style>
