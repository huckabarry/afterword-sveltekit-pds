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
		max-width: 42rem;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 4rem;
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
		color: #6f685f;
		text-decoration: none;
	}

	.simple-site-nav a:hover,
	.simple-site-nav a.simple-site-nav__active {
		color: inherit;
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
		color: #6f685f;
	}

	:global(.simple-post time) {
		display: block;
		margin-bottom: 2rem;
		color: #6f685f;
		font-size: 0.88rem;
	}

	:global(.simple-post .back) {
		margin: 0 0 1rem;
	}

	:global(.simple-post .back a) {
		color: #6f685f;
		text-decoration: none;
	}

	:global(.simple-post .back a:hover) {
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}

	@media (max-width: 640px) {
		.simple-site-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.6rem;
		}
	}
</style>
