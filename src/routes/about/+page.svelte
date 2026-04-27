<script lang="ts">
	let { data }: { data: any } = $props();

	const aboutParagraphs = $derived.by(() =>
		(data.profile.aboutBody || '')
			.split(/\r?\n\r?\n+/)
			.map((paragraph: string) => paragraph.replace(/\r?\n/g, ' ').trim())
			.filter(Boolean)
	);
	const aboutInterests = $derived.by(() =>
		data.profile.aboutInterests?.length ? data.profile.aboutInterests : data.interests
	);
</script>

<svelte:head>
	<title>{data.simpleSite ? 'About / Afterword' : `${data.title} | Bryan Robb`}</title>
</svelte:head>

{#if data.simpleSite}
	<article class="simple-page">
		<h1>About</h1>
		<p>
			This is just a second plain page for testing how a very simple SvelteKit site feels when you
			click around.
		</p>
		<p>
			No CMS, no feed choreography, no extra machinery. Just enough to notice speed and
			structure.
		</p>
	</article>
{:else}
<div class="about-page">
	<header class="about-page__header">
		<div class="about-page__intro">
			<h1 class="about-page__title">{data.title}</h1>
			<p class="about-page__lede">{data.description}</p>
		</div>
	</header>

	<div class="about-page__body">
		<article class="about-page__content">
			{#each aboutParagraphs.length ? aboutParagraphs : data.paragraphs as paragraph (paragraph)}
				<p>{paragraph}</p>
			{/each}

			<section class="about-page__section">
				<h2>Interests</h2>

				<div class="about-page__interests" aria-label="Interests">
					{#each aboutInterests as interest (interest)}
						<span class="tag-pill">{interest}</span>
					{/each}
				</div>
			</section>

			<p class="about-page__archive-link">
				Some older fragments live in
				<a href="/earlier-web">From an Earlier Web</a>.
			</p>
		</article>
	</div>
</div>

<style>
	.about-page {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		padding-top: 1rem;
		padding-bottom: 4rem;
	}

	.about-page__header,
	.about-page__body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.about-page__intro,
	.about-page__content {
		min-width: 0;
	}

	.about-page__title {
		font-size: clamp(2.25rem, 5vw, 3rem);
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.about-page__lede {
		margin-top: 1.5rem;
		font-size: 1rem;
		line-height: 1.75;
		color: #52525b;
	}

	:global(html.dark) .about-page__lede {
		color: #a1a1aa;
	}

	.about-page__content {
		font-size: 0.975rem;
		line-height: 1.8;
		color: #3f3f46;
	}

	:global(html.dark) .about-page__content {
		color: #d4d4d8;
	}

	.about-page__content > p {
		margin: 0;
	}

	.about-page__content > p + p,
	.about-page__section,
	.about-page__archive-link {
		margin-top: 1.5rem;
	}

	.about-page__section h2 {
		margin: 0 0 1rem;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: #27272a;
	}

	:global(html.dark) .about-page__section h2 {
		color: #f4f4f5;
	}

	.about-page__interests {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.about-page__archive-link {
		font-size: 0.95rem;
		color: #71717a;
	}

	:global(html.dark) .about-page__archive-link {
		color: #a1a1aa;
	}

	.about-page__archive-link a {
		color: inherit;
	}

	@media (min-width: 768px) {
		.about-page {
			gap: 3rem;
		}
	}
</style>
{/if}
