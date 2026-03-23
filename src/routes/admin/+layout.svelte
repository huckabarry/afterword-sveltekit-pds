<script lang="ts">
	let { children, data } = $props();
</script>

{#if data.authenticated}
	<div class="admin-shell">
		<header class="admin-header">
			<div>
				<p class="admin-eyebrow">Afterword</p>
				<h1 class="admin-title">Admin</h1>
			</div>

			<form method="POST" action="/admin/logout">
				<button class="admin-ghost-button" type="submit">Log out</button>
			</form>
		</header>

		<nav class="admin-nav" aria-label="Admin">
			<a href="/admin">Dashboard</a>
			<a href="/admin/compose">Compose</a>
			<a href="/admin/replies">Replies</a>
			<a href="/admin/webmentions">Webmentions</a>
		</nav>

		<div class="admin-content">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}
