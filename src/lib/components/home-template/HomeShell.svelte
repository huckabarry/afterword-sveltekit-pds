<script lang="ts">
	import { browser } from '$app/environment';

	let { title, children }: { title: string; children?: import('svelte').Snippet } = $props();

	let isDarkMode = $state(true);

	function disableTransitionsTemporarily() {
		if (!browser) return;
		document.documentElement.classList.add('template-home-disable-transitions');
		window.setTimeout(() => {
			document.documentElement.classList.remove('template-home-disable-transitions');
		}, 0);
	}

	function applyTheme(nextDarkMode: boolean) {
		if (!browser) return;

		isDarkMode = nextDarkMode;
		localStorage.setItem('templateHomeIsDarkMode', nextDarkMode.toString());
		disableTransitionsTemporarily();

		if (nextDarkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	$effect(() => {
		if (!browser) return;

		const saved = localStorage.getItem('templateHomeIsDarkMode');
		const nextDarkMode =
			saved === 'true' || (saved === null && document.documentElement.classList.contains('dark'));

		applyTheme(nextDarkMode);
	});
</script>

<div class="template-shell">
	<div class="template-shell__inner">
		<header class="template-shell__header">
			<a class="template-shell__brand" href="/">
				{title}
			</a>

			<button
				type="button"
				role="switch"
				aria-label="Toggle Dark Mode"
				aria-checked={isDarkMode}
				class="template-shell__theme-toggle"
				onclick={() => applyTheme(!isDarkMode)}
			>
				{#if isDarkMode}
					<svg viewBox="0 0 24 24" aria-hidden="true" class="template-shell__theme-icon">
						<path
							d="M17.75 15.5a.75.75 0 0 1 .67 1.09A8.25 8.25 0 1 1 7.41 5.58a.75.75 0 0 1 1.09.67 7 7 0 0 0 9.25 9.25Z"
							fill="currentColor"
						/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" aria-hidden="true" class="template-shell__theme-icon">
						<path
							d="M12 4.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V5.5a.75.75 0 0 1 .75-.75Zm0 11.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V17a.75.75 0 0 1 .75-.75Zm7.25-5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5h1.5Zm-12.5 0a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5h1.5Zm8.485-4.735a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.06Zm-8.545 8.545a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.06Zm9.605 1.06a.75.75 0 0 1 1.06-1.06l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06Zm-8.545-8.545a.75.75 0 0 1 1.06-1.06l1.06 1.06A.75.75 0 0 1 8.27 8.636l-1.06-1.06ZM12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z"
							fill="currentColor"
						/>
					</svg>
				{/if}
			</button>
		</header>

		<main class="template-shell__main">
			{@render children?.()}
		</main>
	</div>
</div>

<style>
	:global(html.template-home-disable-transitions),
	:global(html.template-home-disable-transitions *) {
		transition: none !important;
	}

	.template-shell {
		min-height: 100vh;
		background: #fafafa;
		color: #52525b;
	}

	:global(html.dark) .template-shell {
		background: #18181b;
		color: #a1a1aa;
	}

	.template-shell__inner {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		width: 100%;
		padding: 0.5rem 1rem;
	}

	.template-shell__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		max-width: 42rem;
		margin: 0 auto;
		padding: 1rem 0 2rem;
	}

	.template-shell__brand {
		font-size: 1.125rem;
		font-weight: 700;
		text-decoration: none;
		color: transparent;
		background-image: linear-gradient(to right, rgb(20 184 166), rgb(13 148 136));
		background-clip: text;
		-webkit-background-clip: text;
	}

	:global(html.dark) .template-shell__brand {
		background-image: linear-gradient(to right, rgb(45 212 191), rgb(45 212 191));
	}

	.template-shell__theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0.25rem;
		border: 0;
		background: transparent;
		color: #a1a1aa;
		cursor: pointer;
	}

	.template-shell__theme-icon {
		width: 1.25rem;
		height: 1.25rem;
		display: block;
	}

	.template-shell__main {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		width: 100%;
		max-width: 42rem;
		margin: 0 auto;
	}

	@media (min-width: 640px) {
		.template-shell__brand {
			font-size: 1.5rem;
		}
	}

	@media (min-width: 1024px) {
		.template-shell__header {
			padding-bottom: 2rem;
		}
	}
</style>
