<script lang="ts">
	let {
		data
	}: {
		data: {
			title: string;
			description: string;
			paragraphs: string[];
			page?: {
				title: string;
				summary: string;
				introHtml: string;
				bodyHtml: string;
			} | null;
		};
	} = $props();
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
					{#each data.paragraphs as paragraph}
						<p>{paragraph}</p>
					{/each}
				{/if}
				<p>
					If you’d rather follow along from your own reader, there’s now a
					<a href="/subscribe">Subscribe page</a> with RSS and JSON feed links for writing,
					planning, and status updates, and planning posts can also be followed by email on
					<a href="https://lowvelocity.org" rel="noreferrer">Low Velocity</a>.
				</p>
			</section>
		</div>
	</article>
</section>
