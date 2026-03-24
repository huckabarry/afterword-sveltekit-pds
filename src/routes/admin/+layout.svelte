<script lang="ts">
	let { children, data } = $props();

	const navItems = [
		{ href: '/admin', label: 'Home', shortLabel: 'Home' },
		{ href: '/admin/profile', label: 'Profile', shortLabel: 'Profile' },
		{ href: '/admin/followers', label: 'Followers', shortLabel: 'Followers' },
		{ href: '/admin/following', label: 'Feed', shortLabel: 'Feed' },
		{ href: '/admin/following/accounts', label: 'Following', shortLabel: 'Following' },
		{ href: '/admin/posts', label: 'Posts', shortLabel: 'Posts' },
		{ href: '/admin/compose', label: 'Compose', shortLabel: 'Write' },
		{ href: '/admin/replies', label: 'Replies', shortLabel: 'Replies' },
		{ href: '/admin/webmentions', label: 'Webmentions', shortLabel: 'Mentions' }
	];

	function isActive(href: string) {
		return href === '/admin' ? data.pathname === href : data.pathname === href || data.pathname.startsWith(`${href}/`);
	}
</script>

{#if data.authenticated}
	<div class="admin-app">
		<aside class="admin-sidebar">
			<div class="admin-sidebar__brand">
				<p class="admin-eyebrow">Afterword</p>
				<h1 class="admin-title">Admin</h1>
				<p class="admin-sidebar__tagline">A small social back room for replies, notes, and moderation.</p>
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
							Dashboard
						{:else if data.pathname === '/admin/profile'}
							Edit profile
						{:else if data.pathname === '/admin/followers'}
							Followers
						{:else if data.pathname === '/admin/following'}
							Following feed
						{:else if data.pathname === '/admin/following/accounts'}
							Following
						{:else if data.pathname === '/admin/compose'}
							Compose
						{:else if data.pathname.startsWith('/admin/posts')}
							Posts
						{:else if data.pathname === '/admin/replies'}
							Replies
						{:else if data.pathname === '/admin/webmentions'}
							Webmentions
						{:else}
							Admin
						{/if}
					</p>
				</div>

				<a class="admin-topbar__quick" href="/admin/compose">New note</a>
			</header>

			<div class="admin-content">
				{@render children()}
			</div>

			<nav class="admin-mobile-nav" aria-label="Admin">
				{#each navItems as item}
					<a class:admin-mobile-nav__link--active={isActive(item.href)} class="admin-mobile-nav__link" href={item.href}>
						<span>{item.shortLabel}</span>
					</a>
				{/each}
			</nav>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
