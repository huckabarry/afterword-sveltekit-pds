<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, preloadCode, preloadData } from '$app/navigation';
	import { tick } from 'svelte';
	import '../app.css';

	let { children, data } = $props();

	type SearchResult = {
		id: string;
		path: string;
		title: string;
		excerpt: string;
		section: string;
		coverImage: string | null;
		publishedAt: string;
		hideTitle?: boolean;
	};

	let searchOpen = $state(false);
	let navMenuOpen = $state(false);
	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let searchState = $state<'idle' | 'loading' | 'ready' | 'empty'>('idle');
	let searchInput = $state<HTMLInputElement | null>(null);
	let navMenu = $state<HTMLElement | null>(null);
	let navMenuButton = $state<HTMLButtonElement | null>(null);
	let searchRequest = 0;
	let galleryThumbsPrewarmed = false;
	const isAdminRoute = $derived(data.pathname.startsWith('/admin'));
	const profile = $derived(data.profile);
	const primaryNavLinks = $derived(
		data.primaryNavLinks?.length
			? data.primaryNavLinks
			: [
					{ href: '/', label: 'Home', openInNewTab: false },
					{ href: '/status', label: 'Status', openInNewTab: false },
					{ href: '/photos', label: 'Gallery', openInNewTab: false },
					{ href: '/about', label: 'About', openInNewTab: false }
				]
	);
	const secondaryNavLinks = $derived(
		data.secondaryNavLinks?.length
			? data.secondaryNavLinks
			: [
					{ href: '/hello', label: 'Hello', openInNewTab: false },
					{ href: '/now', label: 'Now', openInNewTab: false },
					{ href: '/check-ins', label: 'Check-ins', openInNewTab: false },
					{ href: '/media', label: 'Media', openInNewTab: false },
					{ href: '/colophon', label: 'Colophon', openInNewTab: false },
					{ href: '/subscribe', label: 'Subscribe', openInNewTab: false }
				]
	);
	const footerNavLinks = $derived(
		data.footerNavLinks?.length
			? data.footerNavLinks
			: [
					{ href: '/about', label: 'About', openInNewTab: false },
					{ href: '/colophon', label: 'Colophon', openInNewTab: false },
					{ href: '/subscribe', label: 'Subscribe', openInNewTab: false },
					...profile.verificationLinks
						.filter(
							(link) => link.url !== '/' && !['afterword', 'bluesky'].includes(link.label.toLowerCase())
						)
						.map((link) => ({ href: link.url, label: link.label, openInNewTab: true }))
				]
	);

	async function openSearch() {
		navMenuOpen = false;
		searchOpen = true;
		await tick();
		searchInput?.focus();
		searchInput?.select();
	}

	function closeSearch() {
		searchOpen = false;
		searchQuery = '';
		searchResults = [];
		searchState = 'idle';
	}

	function closeNavMenu() {
		navMenuOpen = false;

		if (!browser) return;

		const activeElement = document.activeElement;
		if (!(activeElement instanceof HTMLElement)) return;

		if (activeElement === navMenuButton || navMenu?.contains(activeElement)) {
			activeElement.blur();
		}
	}

	function blurActiveHeaderControl() {
		if (!browser) return;

		const activeElement = document.activeElement;
		if (!(activeElement instanceof HTMLElement)) return;

		if (activeElement.closest('.site-nav-row, .site-title-row')) {
			activeElement.blur();
		}
	}

	function isCurrentPath(href: string) {
		if (href === '/') {
			return data.pathname === '/';
		}

		return data.pathname === href || data.pathname.startsWith(`${href}/`);
	}

	async function prewarmGalleryThumbs() {
		if (!browser || galleryThumbsPrewarmed) {
			return;
		}

		galleryThumbsPrewarmed = true;

		try {
			const response = await fetch('/photos/prewarm.json');

			if (!response.ok) {
				return;
			}

			const payload = (await response.json()) as { urls?: string[] };
			const urls = Array.isArray(payload.urls) ? payload.urls : [];

			for (const url of urls) {
				const normalized = String(url || '').trim();
				if (!normalized) continue;

				const image = new Image();
				image.decoding = 'async';
				image.src = normalized;
			}
		} catch {
			// Ignore prewarm failures; this is only a background hint.
		}
	}

	$effect(() => {
		if (!browser) return;

		function onKeydown(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			const isTypingTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			if (event.key === '/' && !isTypingTarget && !searchOpen) {
				event.preventDefault();
				void openSearch();
			}

			if (event.key === 'Escape' && searchOpen) {
				event.preventDefault();
				closeSearch();
			} else if (event.key === 'Escape' && navMenuOpen) {
				event.preventDefault();
				closeNavMenu();
			}
		}

		function onPointerDown(event: PointerEvent) {
			if (!navMenuOpen || !navMenu) return;

			const target = event.target;
			if (target instanceof Node && !navMenu.contains(target)) {
				closeNavMenu();
			}
		}

		window.addEventListener('keydown', onKeydown);
		window.addEventListener('pointerdown', onPointerDown);
		return () => {
			window.removeEventListener('keydown', onKeydown);
			window.removeEventListener('pointerdown', onPointerDown);
		};
	});

	afterNavigate(() => {
		closeNavMenu();
		blurActiveHeaderControl();
	});

	$effect(() => {
		if (!browser || !searchOpen) return;

		const query = searchQuery.trim();

		if (query.length < 2) {
			searchResults = [];
			searchState = 'idle';
			return;
		}

		const requestId = ++searchRequest;
		const controller = new AbortController();
		searchState = 'loading';

		const timeout = window.setTimeout(async () => {
			try {
				const response = await fetch(`/search.json?q=${encodeURIComponent(query)}`, {
					signal: controller.signal
				});
				const payload = (await response.json()) as { results?: SearchResult[] };

				if (requestId !== searchRequest) return;

				searchResults = Array.isArray(payload.results) ? payload.results : [];
				searchState = searchResults.length ? 'ready' : 'empty';
			} catch (error) {
				if ((error as Error).name === 'AbortError') return;
				if (requestId !== searchRequest) return;
				searchResults = [];
				searchState = 'empty';
			}
		}, 140);

		return () => {
			controller.abort();
			window.clearTimeout(timeout);
		};
	});

	$effect(() => {
		if (!browser || data.pathname !== '/') {
			return;
		}

		const warmupTimeout = window.setTimeout(() => {
			void preloadCode('/status');
			void preloadData('/status');
			void preloadCode('/photos');
			void preloadData('/photos');
			void prewarmGalleryThumbs();
		}, 2500);

		return () => {
			window.clearTimeout(warmupTimeout);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={profile.avatarUrl} />
	<link rel="apple-touch-icon" href={profile.avatarUrl} />
	<link rel="webmention" href="/webmention" />
	<link
		rel="stylesheet"
		href="https://fonts.bunny.net/css?family=fira-sans:400,600,800|ibm-plex-mono:400,400i,500,500i,600,600i,700,700i&display=swap"
	/>
	<meta
		name="description"
		content={data.siteDescription}
	/>
</svelte:head>

{#if isAdminRoute}
	{@render children()}
{:else}
	<div class="site-shell">
		<header class="site-header h-card">
			<a class="site-header-avatar-link u-url u-uid" href="/">
				<img
					class="avatar u-photo"
					src={profile.avatarUrl}
					alt={profile.displayName}
				/>
			</a>

			<div class="site-header-copy">
				<div class="site-title-row">
					<div class="site-title p-name">
						<a class="u-url" href="/">
							<span class="site-title__name">{profile.displayName}</span>
						</a>
					</div>

					<button
						class="site-nav-search site-nav-search--title"
						type="button"
						onclick={() => void openSearch()}
						aria-label="Open search"
						title="Search"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="11" cy="11" r="6.25" />
							<path d="M16 16l4.5 4.5" />
						</svg>
					</button>
				</div>

				<div class="site-nav-row">
					<nav class="site-nav" aria-label="Primary">
						<ul class="site-nav-list">
							{#each primaryNavLinks as link}
								<li class="site-nav-list-item">
									<a
										class="site-nav-item"
										href={link.href}
										target={link.openInNewTab ? '_blank' : undefined}
										rel={link.openInNewTab ? 'noreferrer' : undefined}
										aria-current={isCurrentPath(link.href) ? 'page' : undefined}
										data-sveltekit-preload-data={link.href === '/status' ? 'viewport' : undefined}
										data-sveltekit-preload-code={link.href === '/status' ? 'viewport' : undefined}
									>
										{link.label}
									</a>
								</li>
							{/each}
							<li class="site-nav-list-item site-nav-list-item--menu">
								<div class="site-nav-menu" bind:this={navMenu}>
									<button
										class="site-nav-item site-nav-menu__button"
										bind:this={navMenuButton}
										type="button"
										aria-haspopup="menu"
										aria-expanded={navMenuOpen}
										onclick={() => (navMenuOpen = !navMenuOpen)}
									>
										Menu
									</button>

									{#if navMenuOpen}
										<div class="site-nav-menu__panel" role="menu" aria-label="More pages">
											{#each secondaryNavLinks as link}
												<a
													class="site-nav-menu__link"
													href={link.href}
													target={link.openInNewTab ? '_blank' : undefined}
													rel={link.openInNewTab ? 'noreferrer' : undefined}
													role="menuitem"
													aria-current={isCurrentPath(link.href) ? 'page' : undefined}
													onclick={closeNavMenu}
												>
													{link.label}
												</a>
											{/each}
										</div>
									{/if}
								</div>
							</li>
						</ul>
					</nav>
				</div>
			</div>
		</header>

		{#if data.pathname !== '/'}
			<hr class="site-rule" />
		{/if}

		<main class="site-main">
			{@render children()}
		</main>

		<hr class="site-rule" />

		<footer class="site-foot">
			<div class="site-foot-nav">
				{#each footerNavLinks as link, index}
					{#if index > 0}
						<span class="site-foot-separator">/</span>
					{/if}
					<a
						class="site-foot-nav-item"
						href={link.href}
						target={link.openInNewTab ? '_blank' : undefined}
						rel={link.openInNewTab ? 'noreferrer me' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</div>
		</footer>
	</div>
{/if}

{#if searchOpen && !isAdminRoute}
	<div class="search-modal">
		<button class="search-modal__backdrop" type="button" onclick={closeSearch} aria-label="Close search"></button>
		<div class="search-modal__panel" role="dialog" aria-modal="true" aria-label="Search the site" tabindex="-1">
			<div class="search-modal__head">
				<button class="search-modal__close" type="button" onclick={closeSearch} aria-label="Close search">
					×
				</button>
			</div>

			<div class="search-modal__field-wrap">
				<input
					bind:this={searchInput}
					bind:value={searchQuery}
					id="site-search"
					class="search-modal__field"
					type="search"
					name="q"
					autocomplete="off"
					placeholder="Search posts, places, tags, and ideas"
				/>
			</div>

			<div class="search-modal__results" aria-live="polite">
				{#if searchState === 'loading'}
					<p class="search-modal__empty">Searching…</p>
				{:else if searchState === 'empty'}
					<p class="search-modal__empty">No posts matched that search.</p>
				{:else}
					<ul class="search-results">
						{#each searchResults as result}
							<li>
								<a
									class="search-result"
									class:search-result--no-image={!result.coverImage}
									href={result.path}
									onclick={closeSearch}
								>
									{#if result.coverImage}
										<img class="search-result__image" src={result.coverImage} alt={result.title} loading="lazy" />
									{/if}
									<div class="search-result__body">
										<div class="search-result__meta">
											<span>{result.section}</span>
											<span aria-hidden="true">/</span>
											<time datetime={result.publishedAt}>
												{new Date(result.publishedAt).toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</time>
										</div>
										{#if !result.hideTitle}
											<h2 class="search-result__title">{result.title}</h2>
										{/if}
										<p class="search-result__excerpt">{result.excerpt}</p>
									</div>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
{/if}
