<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import ArrowLeftIcon from '$lib/components/home-template/ArrowLeftIcon.svelte';
	import Card from '$lib/components/home-template/Card.svelte';
	import PostDate from '$lib/components/home-template/PostDate.svelte';
	import SocialLinks from '$lib/components/home-template/SocialLinks.svelte';
	import ResponsiveContentCover from '$lib/components/ResponsiveContentCover.svelte';
	import type { BlogPost } from '$lib/server/ghost';

	type SocialLink = {
		label: string;
		url: string;
	};

	type Profile = {
		displayName: string;
		avatarUrl: string;
		bio: string;
		verificationLinks: SocialLink[];
	};

	let {
		data
	}: {
		data: {
			post: BlogPost;
			previousPost: BlogPost | null;
			nextPost: BlogPost | null;
			standardSiteDocumentAtUri: string | null;
			profile: Profile;
		};
	} = $props();

	let canGoBack = $state(false);

	afterNavigate(({ from }) => {
		if (from && from.url.pathname.startsWith('/blog')) {
			canGoBack = true;
		}
	});

	function goBack() {
		if (canGoBack) {
			history.back();
		}
	}
</script>

<svelte:head>
	<title>{data.post.title} - {data.profile.displayName}</title>
	<meta name="description" content={data.post.excerpt} />
	{#if data.standardSiteDocumentAtUri}
		<link rel="site.standard.document" href={data.standardSiteDocumentAtUri} />
	{/if}
</svelte:head>

<div class="template-post-root">
	<div class="template-post-root__back-column">
		<div class="template-post-root__back-sticky">
			{#if canGoBack}
				<button class="template-post-back" type="button" aria-label="Go back to posts" onclick={goBack}>
					<ArrowLeftIcon class="template-post-back__icon" />
				</button>
			{:else}
				<a class="template-post-back" href="/blog" aria-label="Go back to posts">
					<ArrowLeftIcon class="template-post-back__icon" />
				</a>
			{/if}
		</div>
	</div>

	<div class="template-post-root__main">
		<article class="template-post-article">
			<header class="template-post-article__header">
				<h1 class="template-post-article__title">{data.post.title}</h1>
				<PostDate class="template-post-article__date" post={data.post} decorate collapsed />
			</header>

			{#if data.post.coverImage}
				<figure class="template-post-article__figure">
					<ResponsiveContentCover
						sourceUrl={data.post.coverImage}
						alt={data.post.title}
						hint={data.post.path}
						variant="feature"
						sizes="(max-width: 760px) 100vw, 42rem"
						loading="eager"
					/>
				</figure>
			{/if}

			<div class="template-post-article__content entry__content">
				{@html data.post.html}
			</div>
		</article>

		<hr class="template-post-divider" />

		<div class="template-post-bio">
			<div class="template-post-bio__grid">
				<div class="template-post-bio__socials">
					<SocialLinks links={data.profile.verificationLinks || []} />
				</div>
				<div class="template-post-bio__avatar-wrap">
					<a href="/" class="template-post-bio__avatar-link">
						<img
							src={data.profile.avatarUrl}
							alt={data.profile.displayName}
							class="template-post-bio__avatar"
						/>
					</a>
				</div>
				<p class="template-post-bio__text">{data.profile.bio}</p>
			</div>
		</div>

		{#if data.previousPost || data.nextPost}
			<hr class="template-post-divider" />

			<nav class="template-post-navigation" aria-label="Related posts">
				{#if data.nextPost}
					<div class="template-post-navigation__item">
						<Card
							href={data.nextPost.path}
							title={data.nextPost.title}
							description={data.nextPost.excerpt}
						>
							{#snippet eyebrow()}
								<span class="template-post-navigation__eyebrow">Newer</span>
							{/snippet}
						</Card>
					</div>
				{/if}

				{#if data.previousPost}
					<div class="template-post-navigation__item">
						<Card
							href={data.previousPost.path}
							title={data.previousPost.title}
							description={data.previousPost.excerpt}
						>
							{#snippet eyebrow()}
								<span class="template-post-navigation__eyebrow">Older</span>
							{/snippet}
						</Card>
					</div>
				{/if}
			</nav>
		{/if}
	</div>
</div>

<style>
	.template-post-root {
		display: grid;
		grid-template-columns: 1fr;
		max-width: 42rem;
		margin: 0 auto;
	}

	.template-post-root__back-column {
		display: none;
		padding-top: 2rem;
	}

	.template-post-root__back-sticky {
		position: sticky;
		top: 0;
		display: flex;
		justify-content: flex-end;
		width: 100%;
		padding-top: 2.75rem;
		padding-right: 2rem;
	}

	.template-post-back {
		display: none;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		margin-bottom: 2rem;
		border-radius: 999px;
		border: 1px solid rgba(24, 24, 27, 0.05);
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(24, 24, 27, 0.05);
		color: #71717a;
		text-decoration: none;
		cursor: pointer;
	}

	:global(html.dark) .template-post-back {
		border-color: rgba(63, 63, 70, 0.5);
		background: #27272a;
		color: #a1a1aa;
		box-shadow: none;
	}

	:global(.template-post-back__icon) {
		width: 1rem;
		height: 1rem;
	}

	.template-post-root__main {
		width: 100%;
		margin: 0 auto;
		overflow-x: hidden;
	}

	.template-post-article__header {
		display: flex;
		flex-direction: column;
	}

	.template-post-article__title {
		margin: 1.5rem 0 0;
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: -0.035em;
		color: #27272a;
	}

	:global(html.dark) .template-post-article__title {
		color: #f4f4f5;
	}

	:global(.template-post-article__date) {
		font-size: 0.875rem;
	}

	:global(.template-post-article__figure) {
		margin: 2rem 0 0;
	}

	.template-post-article__content {
		margin-top: 2rem;
		color: #52525b;
		font-size: 1rem;
		line-height: 1.75;
	}

	:global(html.dark) .template-post-article__content {
		color: #a1a1aa;
	}

	:global(.template-post-article__content h2),
	:global(.template-post-article__content h3),
	:global(.template-post-article__content h4),
	:global(.template-post-article__content h5),
	:global(.template-post-article__content h6) {
		color: #27272a;
	}

	:global(html.dark) :global(.template-post-article__content h2),
	:global(html.dark) :global(.template-post-article__content h3),
	:global(html.dark) :global(.template-post-article__content h4),
	:global(html.dark) :global(.template-post-article__content h5),
	:global(html.dark) :global(.template-post-article__content h6) {
		color: #f4f4f5;
	}

	.template-post-divider {
		margin: 2rem 0;
		border: 0;
		border-top: 1px solid #f4f4f5;
	}

	:global(html.dark) .template-post-divider {
		border-top-color: rgba(63, 63, 70, 0.25);
	}

	.template-post-bio {
		padding: 2rem 0;
	}

	.template-post-bio__grid {
		display: grid;
		gap: 2rem;
	}

	.template-post-bio__socials {
		display: flex;
		justify-content: center;
		order: 1;
		gap: 1.5rem;
	}

	.template-post-bio__avatar-wrap {
		display: flex;
		justify-content: center;
		order: 2;
	}

	.template-post-bio__avatar-link {
		display: inline-block;
		border-radius: 999px;
	}

	.template-post-bio__avatar {
		width: 6rem;
		height: 6rem;
		border-radius: 999px;
		object-fit: cover;
		box-shadow: 0 0 0 2px #e4e4e7;
	}

	:global(html.dark) .template-post-bio__avatar {
		box-shadow: 0 0 0 2px #3f3f46;
	}

	.template-post-bio__text {
		order: 3;
		margin: 0;
		font-size: 1rem;
		color: #52525b;
	}

	:global(html.dark) .template-post-bio__text {
		color: #a1a1aa;
	}

	.template-post-navigation {
		display: grid;
		gap: 1.5rem;
		padding-bottom: 4rem;
	}

	.template-post-navigation__item {
		min-width: 0;
	}

	.template-post-navigation__eyebrow {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #71717a;
	}

	:global(html.dark) .template-post-navigation__eyebrow {
		color: #a1a1aa;
	}

	@media (min-width: 640px) {
		.template-post-article__title {
			font-size: 3rem;
		}

		:global(.template-post-article__date) {
			font-size: 1rem;
		}

		.template-post-bio__avatar {
			width: 7rem;
			height: 7rem;
		}

		.template-post-navigation {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.template-post-root {
			max-width: none;
			grid-template-columns: 1fr 42rem 1fr;
		}

		.template-post-root__back-column {
			display: block;
		}

		.template-post-root__main {
			grid-column: 2;
		}

		.template-post-back {
			display: inline-flex;
		}
	}
</style>
