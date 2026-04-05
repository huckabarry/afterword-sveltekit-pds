<script lang="ts">
	let {
		data
	}: {
		data: {
			title: string;
			description: string;
			paragraphs: string[];
			interests: string[];
			page?: {
				title: string;
				summary: string;
				introHtml: string;
				bodyHtml: string;
			} | null;
			profile: {
				aboutBody: string;
				aboutInterests: string[];
			};
		};
	} = $props();

	const aboutParagraphs = $derived.by(() =>
		(data.profile.aboutBody || '')
			.split(/\r?\n\r?\n+/)
			.map((paragraph) => paragraph.replace(/\r?\n/g, ' ').trim())
			.filter(Boolean)
	);
	const aboutInterests = $derived.by(() =>
		data.profile.aboutInterests?.length ? data.profile.aboutInterests : data.interests
	);
</script>

<svelte:head>
	<title>{data.page?.title || data.title} | Bryan Robb</title>
	<meta name="description" content={data.page?.summary || data.description} />
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.page?.title || data.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#if data.page}
					{@html data.page.introHtml}
					{@html data.page.bodyHtml}
				{:else}
					{#each aboutParagraphs.length ? aboutParagraphs : data.paragraphs as paragraph (paragraph)}
						<p>{paragraph}</p>
					{/each}
				{/if}

				<h2>Interests</h2>

				<div class="about-interests" aria-label="Interests">
					{#each aboutInterests as interest (interest)}
						<span class="tag-pill">{interest}</span>
					{/each}
				</div>

				<p class="about-archive-link">
					Some older fragments live in
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href="/earlier-web">From an Earlier Web</a>.
				</p>
			</section>
		</div>
	</article>
</section>

<style>
	.about-archive-link {
		margin-top: 1.5rem;
		font-size: 0.95rem;
		opacity: 0.8;
	}

	.about-archive-link a {
		color: inherit;
	}
</style>
