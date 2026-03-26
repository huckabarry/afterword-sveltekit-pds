<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	let bulkSyncing = $state(false);
	let bulkCompleted = $state(0);
	let bulkSuccesses = 0;
	let bulkFailures = $state<string[]>([]);
	let bulkMessage = $state('');

	async function syncTaggedPosts() {
		if (bulkSyncing || !data.posts.length) return;

		bulkSyncing = true;
		bulkCompleted = 0;
		bulkSuccesses = 0;
		bulkFailures = [];
		bulkMessage = '';

		for (const post of data.posts) {
			try {
				const response = await fetch('/admin/api/standard-site', {
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({ slug: post.slug })
				});
				const payload = await response.json().catch(() => null);

				if (!response.ok || !payload?.ok) {
					bulkFailures = [
						...bulkFailures,
						`${post.title}: ${payload?.error || `Request failed with ${response.status}`}`
					];
				} else {
					bulkSuccesses += 1;
				}
			} catch (error) {
				bulkFailures = [
					...bulkFailures,
					`${post.title}: ${error instanceof Error ? error.message : 'Unexpected sync error.'}`
				];
			} finally {
				bulkCompleted += 1;
			}
		}

		bulkMessage = `Synced ${bulkSuccesses} of ${data.posts.length} field notes and urbanism posts.`;
		bulkSyncing = false;
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Spike</p>
				<h2>Standard Site</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This experimental screen syncs Ghost posts into your PDS as
			<code>site.standard.publication</code> and <code>site.standard.document</code> records.
			It syncs text first, attaches a cover image when one is available, and limits inline image
			imports to keep Worker requests under control.
		</p>

		{#if form?.success}
			<p class="admin-form-success">{form.message}</p>
			{#if form.uri}
				<p class="admin-field-note"><code>{form.uri}</code></p>
			{/if}
		{/if}

		{#if form?.error}
			<p class="admin-form-error">{form.error}</p>
		{/if}

		<div class="admin-link-list">
			<p><strong>Publication AT-URI</strong></p>
			<p><code>{data.publicationAtUri || 'Not configured yet'}</code></p>
			<p><strong>Well-known</strong></p>
			<p><code>/.well-known/site.standard.publication</code></p>
		</div>

		<div class="admin-form-actions">
			<form method="POST" action="/admin/standard-site?/syncPublication" use:enhance>
				<button class="admin-button" type="submit">Sync publication record</button>
			</form>
		</div>
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Ghost posts</p>
				<h2>Field notes + urbanism</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This list includes every Ghost post tagged <code>field-notes</code> or
			<code>urbanism</code>. Bulk sync walks them one at a time so Cloudflare does not try to
			do the whole archive in a single Worker request.
		</p>

		<div class="admin-form-actions">
			<button class="admin-button" type="button" onclick={syncTaggedPosts} disabled={bulkSyncing || !data.posts.length}>
				{#if bulkSyncing}
					Syncing {bulkCompleted} / {data.posts.length}…
				{:else}
					Sync all field notes + urbanism posts
				{/if}
			</button>
		</div>

		{#if bulkMessage}
			<p class="admin-form-success">{bulkMessage}</p>
		{/if}

		{#if bulkFailures.length}
			<div class="admin-link-list">
				<p><strong>Bulk sync issues</strong></p>
				{#each bulkFailures as failure}
					<p class="admin-form-error">{failure}</p>
				{/each}
			</div>
		{/if}

		<ul class="admin-list">
			{#each data.posts as post}
				<li class="admin-list-item">
					<div>
						<p class="admin-list-item__title">{post.title}</p>
						<p class="admin-list-item__meta">{post.path}</p>
						{#if post.matchingTags.length}
							<p class="admin-field-note">{post.matchingTags.join(' · ')}</p>
						{/if}
						{#if post.documentAtUri}
							<p class="admin-field-note"><code>{post.documentAtUri}</code></p>
						{/if}
						<p class="admin-field-note">Manual sync still works here if you want to rerun a single post.</p>
					</div>

					<form method="POST" action="/admin/standard-site?/syncPost" use:enhance>
						<input type="hidden" name="slug" value={post.slug} />
						<button class="admin-pill-link" type="submit">Sync post</button>
					</form>
				</li>
			{/each}
		</ul>
	</div>
</section>
