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
	<section class="template-home__bio-section">
		<div class="template-home__bio-card">
			<img src={data.profile.avatarUrl} alt={data.profile.displayName} class="template-home__avatar" />
			<h1 class="template-home__name">{data.profile.displayName}</h1>
			<div class="template-home__socials">
				<SocialLinks links={data.profile.verificationLinks || []} />
			</div>
			<p class="template-home__bio">{data.profile.bio}</p>
		</div>
	</section>

	<section class="template-home__recent">
		<div class="template-home__recent-head">
			<h2 class="template-home__recent-title">Recently Published</h2>
			<a href="/blog" class="template-home__view-all">
				View All
				<ArrowRightIcon class="template-home__view-all-icon" />
			</a>
		</div>

		<PostsList posts={data.posts} />
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

	.template-home__bio-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4rem;
		padding: 2rem 0 4rem;
	}

	.template-home__bio-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		gap: 1.5rem;
		border-radius: 0.5rem;
	}

	.template-home__avatar {
		width: 9rem;
		height: 9rem;
		margin-left: auto;
		margin-right: auto;
		border-radius: 999px;
		object-fit: cover;
		box-shadow: 0 0 0 2px #e4e4e7;
	}

	:global(html.dark) .template-home__avatar {
		box-shadow: 0 0 0 2px #3f3f46;
	}

	.template-home__socials {
		display: flex;
		gap: 1.5rem;
	}

	.template-home__name {
		margin: -0.5rem 0 0;
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.2;
		text-align: center;
		color: #27272a;
	}

	:global(html.dark) .template-home__name {
		color: #f4f4f5;
	}

	.template-home__bio {
		max-width: 36rem;
		margin: 0;
		font-size: 1rem;
		color: #52525b;
	}

	:global(html.dark) .template-home__bio {
		color: #a1a1aa;
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

	.template-home__recent-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #71717a;
	}

	:global(html.dark) .template-home__recent-title {
		color: #a1a1aa;
	}

	.template-home__view-all {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: rgb(20 184 166);
		text-decoration: none;
	}

	:global(html.dark) .template-home__view-all {
		color: rgb(45 212 191);
	}

	:global(.template-home__view-all-icon) {
		width: 1rem;
		height: 1rem;
	}
</style>
