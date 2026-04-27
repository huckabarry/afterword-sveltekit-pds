<script lang="ts">
	import { bio, name } from '$lib/info';

	let {
		data
	}: {
		data: {
			urbanism: Array<{
				title: string;
				path: string;
				publishedAt: string;
			}>;
			fieldNotes: Array<{
				title: string;
				path: string;
				publishedAt: string;
			}>;
			photos: Array<{
				postTitle: string;
				postPath: string;
				displayUrl: string;
				alt: string;
			}>;
		};
	} = $props();

	const formatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	function formatDate(value: string) {
		return formatter.format(new Date(value));
	}
</script>

<svelte:head>
	<title>{name} / Home Test</title>
	<meta
		name="description"
		content="A stripped-down home page experiment for Afterword."
	/>
</svelte:head>

<div class="home-test">
	<header class="home-test__header">
		<h1 class="home-test__title">{name}</h1>
		<p class="home-test__bio">{bio}</p>
	</header>

	<section class="home-test__section" aria-labelledby="home-test-urbanism">
		<div class="home-test__section-head">
			<h2 id="home-test-urbanism">Urbanism</h2>
			<a href="/blog">More</a>
		</div>
		<ul class="home-test__list">
			{#each data.urbanism as post}
				<li class="home-test__item">
					<a href={post.path} class="home-test__link">{post.title}</a>
					<span class="home-test__date">{formatDate(post.publishedAt)}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="home-test__section" aria-labelledby="home-test-field-notes">
		<div class="home-test__section-head">
			<h2 id="home-test-field-notes">Field Notes</h2>
			<a href="/blog#field-notes">More</a>
		</div>
		<ul class="home-test__list">
			{#each data.fieldNotes as post}
				<li class="home-test__item">
					<a href={post.path} class="home-test__link">{post.title}</a>
					<span class="home-test__date">{formatDate(post.publishedAt)}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="home-test__section" aria-labelledby="home-test-photos">
		<div class="home-test__section-head">
			<h2 id="home-test-photos">Photos</h2>
			<a href="/photos">More</a>
		</div>
		<div class="home-test__photos">
			{#each data.photos as photo}
				<a href={photo.postPath} class="home-test__photo-link" aria-label={photo.postTitle}>
					<img class="home-test__photo" src={photo.displayUrl} alt={photo.alt} loading="lazy" />
				</a>
			{/each}
		</div>
	</section>
</div>

<style>
	.home-test {
		max-width: 42rem;
		margin: 0 auto;
		padding: 1rem 0 4rem;
	}

	.home-test__header {
		margin-bottom: 3rem;
	}

	.home-test__title {
		font-size: clamp(2rem, 5vw, 3rem);
		line-height: 1;
		font-weight: 700;
		margin: 0 0 0.85rem;
	}

	.home-test__bio {
		margin: 0;
		max-width: 36rem;
		font-size: 1rem;
		line-height: 1.7;
		color: rgb(82 82 91);
	}

	:global(.dark) .home-test__bio {
		color: rgb(161 161 170);
	}

	.home-test__section {
		margin-bottom: 2.75rem;
	}

	.home-test__section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.home-test__section-head h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 600;
	}

	.home-test__section-head a {
		font-size: 0.9rem;
		color: inherit;
		text-decoration: none;
		opacity: 0.7;
	}

	.home-test__section-head a:hover {
		opacity: 1;
	}

	.home-test__list {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 1px solid rgb(228 228 231);
	}

	:global(.dark) .home-test__list {
		border-top-color: rgb(63 63 70);
	}

	.home-test__item {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid rgb(228 228 231);
	}

	:global(.dark) .home-test__item {
		border-bottom-color: rgb(63 63 70);
	}

	.home-test__link {
		color: inherit;
		text-decoration: none;
		line-height: 1.4;
	}

	.home-test__link:hover {
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.home-test__date {
		flex-shrink: 0;
		font-size: 0.85rem;
		color: rgb(113 113 122);
	}

	:global(.dark) .home-test__date {
		color: rgb(161 161 170);
	}

	.home-test__photos {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.home-test__photo-link {
		display: block;
	}

	.home-test__photo {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 4px;
	}

	@media (max-width: 640px) {
		.home-test__item {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.35rem;
		}

		.home-test__photos {
			grid-template-columns: 1fr;
		}
	}
</style>
