<script lang="ts">
	let { children, data } = $props();
	let menuOpen = $state(false);

	const navItems = [
		{ href: '/admin', label: 'Home' },
		{ href: '/admin/profile', label: 'Profile' },
		{ href: '/admin/posts', label: 'Posts' },
		{ href: '/admin/photos', label: 'Images' },
		{ href: '/admin/webmentions', label: 'Webmentions' },
		{ href: '/admin/standard-site', label: 'Standard Site' }
	];

	function isActive(href: string) {
		return href === '/admin' ? data.pathname === href : data.pathname === href || data.pathname.startsWith(`${href}/`);
	}

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function handleDocumentClick(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest('.admin-mobile-drawer')) {
			menuOpen = false;
		}
	}
</script>

<svelte:document onclick={handleDocumentClick} />

{#if data.authenticated}
	<div class="admin-app">
		<aside class="admin-sidebar">
			<div class="admin-sidebar__brand">
				<p class="admin-eyebrow">Afterword</p>
				<h1 class="admin-title">Admin</h1>
				<p class="admin-sidebar__tagline">A quieter publishing workspace for profile, posts, images, and site upkeep.</p>
			</div>

			<nav class="admin-sidebar__nav" aria-label="Admin">
				{#each navItems as item}
					<a class:admin-sidebar__link--active={isActive(item.href)} class="admin-sidebar__link" href={item.href}>
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>

			<form class="admin-sidebar__logout" method="POST" action="/admin/logout">
				<button class="admin-ghost-button" type="submit">Log out</button>
			</form>
		</aside>

		<div class="admin-shell">
			<header class="admin-topbar">
				<div>
					<p class="admin-topbar__eyebrow">Private workspace</p>
					<p class="admin-topbar__title">
						{#if data.pathname === '/admin'}
							Home
						{:else if data.pathname === '/admin/profile'}
							Profile
						{:else if data.pathname.startsWith('/admin/posts')}
							Posts
						{:else if data.pathname === '/admin/photos'}
							Images
						{:else if data.pathname === '/admin/webmentions'}
							Webmentions
						{:else if data.pathname === '/admin/standard-site'}
							Standard Site
						{:else}
							Admin
						{/if}
					</p>
				</div>

				<div class="admin-topbar__actions">
					<div class="admin-mobile-drawer">
						<button
							class="admin-mobile-drawer__toggle"
							type="button"
							aria-expanded={menuOpen}
							aria-controls="admin-mobile-nav"
							onclick={toggleMenu}
						>
							Menu
						</button>
						{#if menuOpen}
							<nav class="admin-mobile-nav" id="admin-mobile-nav" aria-label="Admin">
								{#each navItems as item}
									<a
										class:admin-mobile-nav__link--active={isActive(item.href)}
										class="admin-mobile-nav__link"
										href={item.href}
										onclick={closeMenu}
									>
										<span>{item.label}</span>
									</a>
								{/each}
							</nav>
						{/if}
					</div>
				</div>
			</header>

			<div class="admin-content">
				{@render children()}
			</div>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
