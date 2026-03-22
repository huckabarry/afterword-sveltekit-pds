<script lang="ts">
	let {
		data
	}: {
		data: {
			title: string;
			description: string;
			paragraphs: string[];
			interests: string[];
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.title} | Afterword PDS Lab</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#each data.paragraphs as paragraph}
					<p>{paragraph}</p>
				{/each}

				<h2>Interests</h2>

				<div class="about-interests" aria-label="Interests">
					{#each data.interests as interest}
						{#if interest.toLowerCase() === 'photography walks'}
							<span class="tag-pill">{interest}</span>
						{:else if interest.toLowerCase() === 'writing'}
							<a class="tag-pill" href="/blog">{interest}</a>
						{:else if interest === 'Mitski'}
							<span class="tag-pill">{interest}</span>
						{:else}
							<span class="tag-pill">{interest}</span>
						{/if}
					{/each}
				</div>
			</section>
		</div>
	</article>
</section>
