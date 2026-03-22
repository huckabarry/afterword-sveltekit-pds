<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link
		rel="stylesheet"
		href="https://fonts.bunny.net/css?family=fira-sans:400,600,800|ibm-plex-mono:400,400i,500,500i,600,600i,700,700i&display=swap"
	/>
	<meta
		name="description"
		content="Short updates, photos, and longer reflections on place, music, design, and daily life."
	/>
</svelte:head>

<div class="site-shell">
	<header class="site-header">
		<a class="site-header-avatar-link" href="/">
			<img
				class="avatar"
				src="/assets/images/status-avatar.jpg"
				alt="Bryan Robb"
			/>
		</a>

		<div class="site-header-copy">
			<div class="site-title-row">
				<div class="site-title">
					<a href="/">
						<span class="site-title__name">Bryan Robb</span>
					</a>
				</div>
			</div>

			<nav class="site-nav" aria-label="Primary">
				<ul class="site-nav-list">
					<li class="site-nav-list-item"><a class="site-nav-item" href="/">Home</a></li>
					<li class="site-nav-list-item"><a class="site-nav-item" href="/blog">Blog</a></li>
					<li class="site-nav-list-item"><a class="site-nav-item" href="/photos">Gallery</a></li>
					<li class="site-nav-list-item"><a class="site-nav-item" href="/now">Now</a></li>
					<li class="site-nav-list-item"><a class="site-nav-item" href="/about">About</a></li>
				</ul>
			</nav>
		</div>
	</header>

	<hr class="site-rule" />

	<main class="site-main">
		{@render children()}
	</main>

	<hr class="site-rule" />

	<footer class="site-foot">
		<div class="site-foot-nav">
			<a class="site-foot-nav-item" href="/blog">Blog</a>
			<span class="site-foot-separator">/</span>
			<a class="site-foot-nav-item" href="/photos">Gallery</a>
			<span class="site-foot-separator">/</span>
			<a class="site-foot-nav-item" href="/now">Now</a>
			<span class="site-foot-separator">/</span>
			<a class="site-foot-nav-item" href="https://bsky.app/profile/afterword.blog" target="_blank" rel="noreferrer">Bluesky</a>
		</div>
	</footer>
</div>
