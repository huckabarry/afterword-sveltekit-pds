<script lang="ts">
	let {
		data
	}: {
		data: {
			title: string;
			description: string;
			paragraphs: string[];
			interests: string[];
			profile: {
				displayName: string;
				avatarUrl: string;
				headerImageUrl: string | null;
				bio: string;
				aboutBody: string;
				aboutInterests: string[];
				verificationLinks: { label: string; url: string }[];
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
	<title>{data.title} | Afterword PDS Lab</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">{data.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				{#each aboutParagraphs.length ? aboutParagraphs : data.paragraphs as paragraph}
					<p>{paragraph}</p>
				{/each}

				<h2>Interests</h2>

				<div class="about-interests" aria-label="Interests">
					{#each aboutInterests as interest}
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
