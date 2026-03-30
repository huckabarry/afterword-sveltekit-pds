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
				<p>
					If you’d rather follow along from your own reader, there’s now a
					<a href="/subscribe">Subscribe page</a> with RSS and JSON feed links, and planning
					posts can also be followed by email on
					<a href="https://lowvelocity.org" rel="noreferrer">Low Velocity</a>.
				</p>
			</section>
		</div>
	</article>
</section>
