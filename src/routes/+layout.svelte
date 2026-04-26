<script lang="ts">
	import '../app.css';
	import '../prism.css';
	import { MoonIcon, SunIcon } from 'heroicons-svelte/20/solid';
	import { browser } from '$app/environment';
	import { name } from '$lib/info';

	let { children, data } = $props();

	let isDarkMode = $state(browser ? Boolean(document.documentElement.classList.contains('dark')) : true);
	const isAdminRoute = $derived(String(data.pathname || '').startsWith('/admin'));
	const fullWidth = $derived(String(data.pathname || '').startsWith('/blog/'));
	const pathname = $derived(String(data.pathname || ''));

	const primaryNav = [
		{ href: '/', label: 'Home', match: (path: string) => path === '/' },
		{ href: '/blog', label: 'Blog', match: (path: string) => path.startsWith('/blog') },
		{
			href: '/field-notes',
			label: 'Field Notes',
			match: (path: string) => path.startsWith('/field-notes')
		},
		{ href: '/status', label: 'Status', match: (path: string) => path.startsWith('/status') },
		{ href: '/about', label: 'About', match: (path: string) => path.startsWith('/about') }
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
