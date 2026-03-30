<script lang="ts">
	import { browser } from '$app/environment';
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
	let searchQuery = $state('');
	let searchResults = $state<SearchResult[]>([]);
	let searchState = $state<'idle' | 'loading' | 'ready' | 'empty'>('idle');
	let searchInput = $state<HTMLInputElement | null>(null);
	let searchRequest = 0;
	const isAdminRoute = $derived(data.pathname.startsWith('/admin'));
	const profile = $derived(data.profile);

	async function openSearch() {
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
			}
		}

		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
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
		content="Short updates, photos, and longer reflections on place, music, design, and daily life."
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
				</div>

				<div class="site-nav-row">
					<nav class="site-nav" aria-label="Primary">
						<ul class="site-nav-list">
							<li class="site-nav-list-item"><a class="site-nav-item" href="/">Home</a></li>
							<li class="site-nav-list-item"><a class="site-nav-item" href="/now">Now</a></li>
							<li class="site-nav-list-item"><a class="site-nav-item" href="/media">Media</a></li>
							<li class="site-nav-list-item"><a class="site-nav-item" href="/photos">Gallery</a></li>
							<li class="site-nav-list-item"><a class="site-nav-item" href="/hello">Hello</a></li>
						</ul>
					</nav>

					<button
						class="site-nav-search"
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
			</div>
		</header>

		<hr class="site-rule" />

		<main class="site-main">
			{@render children()}
		</main>

		<hr class="site-rule" />

		<footer class="site-foot">
			<div class="site-foot-nav">
				<a class="site-foot-nav-item" href="/about">About</a>
				<span class="site-foot-separator">/</span>
				<a class="site-foot-nav-item" href="/colophon">Colophon</a>
				<span class="site-foot-separator">/</span>
				<a class="site-foot-nav-item" href="/check-ins">Check-ins</a>
				<span class="site-foot-separator">/</span>
				<a class="site-foot-nav-item" href="/earlier-web">Earlier Web</a>
				{#each profile.verificationLinks.filter((link) => link.url !== '/' && !['afterword', 'bluesky'].includes(link.label.toLowerCase())) as link}
					<span class="site-foot-separator">/</span>
					<a class="site-foot-nav-item" href={link.url} target="_blank" rel="noreferrer me">{link.label}</a>
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
				<label class="search-modal__label" for="site-search">Search</label>
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
				<span class="search-modal__hint">Press `/` to search</span>
			</div>

			<div class="search-modal__results" aria-live="polite">
				{#if searchState === 'idle'}
					<p class="search-modal__empty">Start typing to search across field notes, planning, and other writing.</p>
				{:else if searchState === 'loading'}
					<p class="search-modal__empty">Searching…</p>
				{:else if searchState === 'empty'}
					<p class="search-modal__empty">No posts matched that search.</p>
				{:else}
					<ul class="search-results">
						{#each searchResults as result}
							<li>
								<a class="search-result" href={result.path} onclick={closeSearch}>
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
