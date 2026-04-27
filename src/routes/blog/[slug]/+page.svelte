<script lang="ts">
	import { website, name, bio, avatar, authorName } from '$lib/info.js';
	import ToC from '$lib/components/ToC.svelte';
	import ArrowLeftIcon from '$lib/components/ArrowLeftIcon.svelte';
	import SocialLinks from '$lib/components/SocialLinks.svelte';
	import { afterNavigate } from '$app/navigation';
	import PostDate from '$lib/components/PostDate.svelte';
	import type { TemplatePost } from '$lib/server/template-posts';

	let { data }: { data: any } = $props();
	const post = $derived(data.post);
	const formatter = new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});

	const ogImage = $derived.by(
		() =>
			`https://og-image.vercel.app/**${encodeURIComponent(
				post.title
			)}**?theme=light&md=1&fontSize=100px&images=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Ffront%2Fassets%2Fdesign%2Fhyper-color-logo.svg`
	);

	const url = $derived(`${website}/blog/${post.slug}`);

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
	<title>{data.simpleSite ? `${data.simplePost.title} / Afterword` : `${post.title} - ${name}`}</title>
	{#if !data.simpleSite}
		<meta name="description" content={post.preview.text} />
		<meta name="author" content={authorName} />
		<meta property="og:url" content={url} />
		<meta property="og:type" content="website" />
		<meta property="og:title" content={post.title} />
		<meta property="og:description" content={post.preview.text} />
		<meta property="og:image" content={ogImage} />
		<meta name="twitter:card" content="summary_large_image" />
		<meta property="twitter:domain" content={website} />
		<meta property="twitter:url" content={url} />
		<meta name="twitter:title" content={post.title} />
		<meta name="twitter:description" content={post.preview.text} />
		<meta name="twitter:image" content={ogImage} />
	{/if}
</svelte:head>

{#if data.simpleSite}
	<article class="simple-post">
		<p class="back"><a href="/">Back</a></p>
		<h1>{data.simplePost.title}</h1>
		<time datetime={data.simplePost.date}>{formatter.format(new Date(data.simplePost.date))}</time>

		<div class="body">
			{#each data.simplePost.body as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>
	</article>
{:else}
<div class="root max-w-2xl mx-auto lg:max-w-none">
	<div class="hidden lg:block pt-8">
		<div class="sticky top-0 w-full flex justify-end pt-11 pr-8">
			{#if canGoBack}
				<button
					type="button"
					class="items-center justify-center hidden w-10 h-10 mb-8 transition bg-white rounded-full shadow-md -top-1 -left-16 lg:flex group shadow-zinc-800/5 ring-1 ring-zinc-900/5 dark:border dark:border-zinc-700/50 dark:bg-zinc-800 dark:ring-0 dark:focus-visible:ring-2 dark:ring-white/10 dark:hover:border-zinc-700 dark:hover:ring-white/20"
					aria-label="Go back to posts"
					onclick={goBack}
				>
					<ArrowLeftIcon
						class="w-4 h-4 transition stroke-zinc-500 group-hover:stroke-zinc-700 dark:stroke-zinc-500 dark:group-hover:stroke-zinc-400"
					/>
				</button>
			{:else}
				<a
					href="/blog"
					class="items-center justify-center hidden w-10 h-10 mb-8 transition bg-white rounded-full shadow-md -top-1 -left-16 lg:flex group shadow-zinc-800/5 ring-1 ring-zinc-900/5 dark:border dark:border-zinc-700/50 dark:bg-zinc-800 dark:ring-0 dark:focus-visible:ring-2 dark:ring-white/10 dark:hover:border-zinc-700 dark:hover:ring-white/20"
					aria-label="Go back to posts"
				>
					<ArrowLeftIcon
						class="w-4 h-4 transition stroke-zinc-500 group-hover:stroke-zinc-700 dark:stroke-zinc-500 dark:group-hover:stroke-zinc-400"
					/>
				</a>
			{/if}
		</div>
	</div>

	<div class="w-full mx-auto overflow-x-hidden">
		<article>
			<header class="flex flex-col">
				<h1
					class="mt-6 text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl"
				>
					{post.title}
				</h1>
				<PostDate class="text-sm sm:text-base" {post} decorate collapsed />
			</header>

			<div class="prose dark:prose-invert">
				{@html post.html}
			</div>
		</article>

		<hr />
		<div class="py-8">
			<div class="grid gap-8">
				<div class="flex justify-center order-1 col-span-2 gap-6 md:order-2">
					<SocialLinks />
				</div>
				<div class="flex justify-center order-2 md:order-1 md:col-span-2">
					<a href="/" class="inline-block rounded-full">
						<img
							src={avatar}
							alt={authorName}
							class="w-24 h-24 mx-auto rounded-full md:w-28 md:h-28 ring-2 ring-zinc-200 dark:ring-zinc-700"
						/>
					</a>
				</div>
				<p class="order-3 text-base text-zinc-600 dark:text-zinc-400">
					{bio}
				</p>
			</div>
		</div>
	</div>

	{#if post.headings?.length}
		<div class="hidden xl:block pt-10">
			<aside class="sticky hidden w-48 ml-8 xl:block top-8" aria-label="Table of Contents">
				<ToC {post} />
			</aside>
		</div>
	{/if}
</div>

<style lang="postcss">
	.root {
		display: grid;
		grid-template-columns: 1fr;
	}

	@screen lg {
		.root {
			grid-template-columns: 1fr 42rem 1fr;
		}
	}
</style>
{/if}
