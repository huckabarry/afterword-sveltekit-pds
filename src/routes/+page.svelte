<script lang="ts">
	import ArrowRightIcon from '$lib/components/home-template/ArrowRightIcon.svelte';
	import PostsList from '$lib/components/home-template/PostsList.svelte';
	import SocialLinks from '$lib/components/home-template/SocialLinks.svelte';

	type SocialLink = {
		label: string;
		url: string;
	};

	type HomePost = {
		href: string;
		title: string;
		description: string;
		publishedAt: Date;
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
			profile: Profile;
			posts: HomePost[];
		};
	} = $props();
</script>

<svelte:head>
	<title>{data.profile.displayName}</title>
	<meta name="description" content={data.profile.bio} />
</svelte:head>

<div class="template-home">
	<section class="template-home__hero">
		<div class="template-home__hero-card">
			<img src={data.profile.avatarUrl} alt={data.profile.displayName} class="template-home__avatar" />
			<SocialLinks links={data.profile.verificationLinks || []} />
			<p class="template-home__bio">{data.profile.bio}</p>
		</div>
	</section>

	<section class="template-home__recent">
		<div class="template-home__recent-head">
			<h2>Recently Published</h2>
			<a href="/blog" class="template-home__view-all">
				<span>View All</span>
				<ArrowRightIcon />
			</a>
		</div>

		{#if data.posts.length}
			<PostsList posts={data.posts} />
		{:else}
			<p class="template-home__empty">No published standard.site documents are available yet.</p>
		{/if}
	</section>
</div>

<style>
	.template-home {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		flex-grow: 1;
		padding-bottom: 4rem;
	}

	.template-home__hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4rem;
		padding: 2rem 0 4rem;
	}

	.template-home__hero-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		gap: 1.5rem;
	}

	.template-home__avatar {
		width: 9rem;
		height: 9rem;
		border-radius: 999px;
		object-fit: cover;
		border: 2px solid color-mix(in srgb, var(--border) 85%, transparent);
	}

	.template-home__bio {
		max-width: 38rem;
		margin: 0;
		text-align: center;
		color: var(--muted);
		line-height: 1.7;
	}

	.template-home__recent {
		width: 100%;
	}

	.template-home__recent-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.template-home__recent-head h2 {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 600;
		color: var(--muted);
		letter-spacing: 0;
	}

	.template-home__view-all {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--accent, var(--text));
		text-decoration: none;
	}

	.template-home__empty {
		margin: 0;
		color: var(--muted);
	}
</style>
