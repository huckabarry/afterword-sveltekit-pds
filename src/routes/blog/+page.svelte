<script lang="ts">
	import PostsList from '$lib/components/PostsList.svelte';
	import { avatar, authorName, bio, name } from '$lib/info.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{name} | Posts</title>
</svelte:head>

<div class="flex flex-col flex-grow gap-8 pb-16">
	<header class="pt-4">
		<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
			Writings on place, cities, and the human experience of living in them.
		</h1>
		<div class="flex items-center gap-4 mt-8">
			<img
				src={avatar}
				alt={authorName}
				class="w-11 h-11 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
			/>
			<div class="min-w-0">
				<p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
					{authorName}
				</p>
				<p class="text-sm text-zinc-500 dark:text-zinc-400">
					{bio}
				</p>
			</div>
		</div>
	</header>

	<div class="mt-4 sm:mt-8">
		<PostsList posts={data.posts} />
	</div>
</div>
