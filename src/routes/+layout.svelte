<script lang="ts">
	import '../app.css';
	import '../prism.css';
	import { MoonIcon, SunIcon } from 'heroicons-svelte/20/solid';
	import { browser } from '$app/environment';
	import { name } from '$lib/info';
	import { simpleSite } from '$lib/simple-site';

	let { children, data } = $props();

	let isDarkMode = $state(browser ? Boolean(document.documentElement.classList.contains('dark')) : true);
	const isAdminRoute = $derived(String(data.pathname || '').startsWith('/admin'));
	const isSimpleSite = $derived(Boolean(data.simpleSite));
	const fullWidth = $derived(String(data.pathname || '').startsWith('/blog/'));
	const pathname = $derived(String(data.pathname || ''));

	const primaryNav = [
		{ href: '/', label: 'Home', match: (path: string) => path === '/' },
		{ href: '/blog', label: 'Blog', match: (path: string) => path.startsWith('/blog') },
		{ href: '/status', label: 'Status', match: (path: string) => path.startsWith('/status') },
		{ href: '/about', label: 'About', match: (path: string) => path.startsWith('/about') }
	];

	const simpleNav = [
		{ href: '/', label: 'Home', match: (path: string) => path === '/' },
		{ href: '/about', label: 'About', match: (path: string) => path.startsWith('/about') },
		{ href: '/notes', label: 'Notes', match: (path: string) => path.startsWith('/notes') }
	];

	function disableTransitionsTemporarily() {
		document.documentElement.classList.add('[&_*]:!transition-none');
		window.setTimeout(() => {
			document.documentElement.classList.remove('[&_*]:!transition-none');
		}, 0);
	}

	function toggleMode() {
		isDarkMode = !isDarkMode;
		localStorage.setItem('isDarkMode', isDarkMode.toString());
		disableTransitionsTemporarily();

		if (isDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
</script>

<svelte:head>
	{#if data.standardSitePublicationAtUri}
		<link rel="site.standard.publication" href={data.standardSitePublicationAtUri} />
	{/if}
	{#if isSimpleSite}
		<style>
			:root {
				color-scheme: dark;
			}

			html,
			body {
				background: #121110;
				color: #ece7df;
				font-family: Georgia, 'Times New Roman', serif;
			}
		</style>
	{/if}
</svelte:head>

{#if isAdminRoute}
	{@render children()}
{:else if isSimpleSite}
	<div class="simple-site-shell">
		<header class="simple-site-header">
			<a class="simple-site-title" href="/">{simpleSite.title}</a>

			<nav class="simple-site-nav" aria-label="Primary">
				{#each simpleNav as item}
					<a
						href={item.href}
						class:simple-site-nav__active={item.match(pathname)}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</header>

		<main class="simple-site-main">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="flex flex-col min-h-screen">
		<div class="flex flex-col flex-grow w-full px-4 py-2">
			<header class="grid items-center w-full max-w-2xl grid-cols-[1fr_auto_1fr] py-4 mx-auto lg:pb-8">
				<a
					class="text-lg font-bold sm:text-2xl text-[#c06a63] dark:text-[#e08a7a]"
					href="/"
				>
					{name}
				</a>

				<nav aria-label="Primary" class="justify-self-center">
					<ul class="flex items-center gap-4 text-[0.72rem] font-medium uppercase text-zinc-500 dark:text-zinc-400 sm:gap-6">
						{#each primaryNav as item}
							<li>
								<a
									href={item.href}
									class="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
									class:text-zinc-900={item.match(pathname)}
									class:dark:text-zinc-100={item.match(pathname)}
								>
									{item.label}
								</a>
							</li>
						{/each}
					</ul>
				</nav>

				<button
					type="button"
					role="switch"
					aria-label="Toggle Dark Mode"
					aria-checked={isDarkMode}
					class="justify-self-end w-5 h-5 sm:h-8 sm:w-8 sm:p-1"
					onclick={toggleMode}
				>
					<MoonIcon class="hidden text-zinc-500 dark:block" />
					<SunIcon class="block text-zinc-400 dark:hidden" />
				</button>
			</header>

			<main class="flex flex-col flex-grow w-full mx-auto" class:max-w-2xl={!fullWidth}>
				{@render children()}
			</main>
		</div>
	</div>
{/if}

<style>
	.simple-site-shell {
		--simple-bg: #121110;
		--simple-text: #ece7df;
		--simple-muted: #a59d91;
		--simple-rule: #34302c;
		max-width: 42rem;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 4rem;
		min-height: 100vh;
		background: var(--simple-bg);
		color: var(--simple-text);
		font-family: Georgia, 'Times New Roman', serif;
	}

	.simple-site-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2.25rem;
	}

	.simple-site-title {
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		color: inherit;
	}

	.simple-site-nav {
		display: flex;
		gap: 1rem;
		font-size: 0.9rem;
	}

	.simple-site-nav a {
		color: var(--simple-muted);
		text-decoration: none;
	}

	.simple-site-nav a:hover,
	.simple-site-nav a.simple-site-nav__active {
		color: var(--simple-text);
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}

	.simple-site-main {
		max-width: 40rem;
	}

	:global(.simple-home h1),
	:global(.simple-page h1),
	:global(.simple-post h1) {
		margin: 0 0 0.85rem;
		font-size: clamp(2.5rem, 6vw, 4rem);
		line-height: 0.95;
		font-weight: 700;
		color: inherit;
	}

	:global(.simple-home p),
	:global(.simple-page p),
	:global(.simple-post p) {
		font-size: 1rem;
		line-height: 1.75;
	}

	:global(.simple-home p),
	:global(.simple-page p) {
		color: var(--simple-muted);
	}

	:global(.simple-post time) {
		display: block;
		margin-bottom: 2rem;
		color: var(--simple-muted);
		font-size: 0.88rem;
	}

	:global(.simple-post .back) {
		margin: 0 0 1rem;
	}

	:global(.simple-post .back a) {
		color: var(--simple-muted);
		text-decoration: none;
	}

	:global(.simple-post .back a:hover) {
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}

	:global(.simple-post-list) {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 1px solid var(--simple-rule);
	}

	:global(.simple-post-list__item) {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 0;
		border-bottom: 1px solid var(--simple-rule);
	}

	:global(.simple-post-list__link) {
		text-decoration: underline;
		text-underline-offset: 0.16em;
		font-size: 1rem;
		line-height: 1.4;
		color: inherit;
	}

	:global(.simple-post-list__link:hover) {
		color: var(--simple-muted);
	}

	:global(.simple-post-list__date) {
		flex-shrink: 0;
		font-size: 0.84rem;
		color: var(--simple-muted);
	}

	@media (max-width: 640px) {
		.simple-site-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.6rem;
		}

		:global(.simple-post-list__item) {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.3rem;
		}
	}
</style>
