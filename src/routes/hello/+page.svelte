<script lang="ts">
	let {
		data
	}: {
		data: {
			title: string;
			description: string;
			html: string;
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.title} | Bryan Robb</title>
	<meta name="description" content={data.description} />
</svelte:head>

<section class="section-block hello-page">
	<h1 class="section-title">{data.title}</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body hello-page__body">
				{@html data.html}
			</section>
		</div>
	</article>
</section>

<style>
	.hello-page__body :global(p),
	.hello-page__body :global(ul),
	.hello-page__body :global(ol),
	.hello-page__body :global(h2) {
		margin-top: 0;
	}

	.hello-page__body :global(p + p) {
		margin-top: 1.15rem;
	}

	.hello-page__body :global(h2) {
		margin-top: 2.25rem;
	}

	.hello-page__body :global(h2 + ul),
	.hello-page__body :global(h2 + ol) {
		margin-top: 0.85rem;
	}

	.hello-page__body :global(ul),
	.hello-page__body :global(ol) {
		padding-left: 1.2rem;
		line-height: 1.65;
	}

	.hello-page__body :global(li + li) {
		margin-top: 0.7rem;
	}
	
	.hello-page__body :global(ul + h2),
	.hello-page__body :global(ol + h2) {
		margin-top: 2.25rem;
	}
</style>
