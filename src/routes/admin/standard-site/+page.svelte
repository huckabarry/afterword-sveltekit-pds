<script lang="ts">
	let { data, form } = $props();
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
			It syncs text first and can attach a cover image when one is available.
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
			<form method="POST" action="?/syncPublication">
				<button class="admin-button" type="submit">Sync publication record</button>
			</form>
		</div>
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Ghost posts</p>
				<h2>Recent posts to sync</h2>
			</div>
		</div>

		<ul class="admin-list">
			{#each data.posts as post}
				<li class="admin-list-item">
					<div>
						<p class="admin-list-item__title">{post.title}</p>
						<p class="admin-list-item__meta">{post.path}</p>
						{#if post.documentAtUri}
							<p class="admin-field-note"><code>{post.documentAtUri}</code></p>
						{/if}
						<p class="admin-field-note">Latest synced document record for this Ghost post.</p>
					</div>

					<form method="POST" action="?/syncPost">
						<input type="hidden" name="slug" value={post.slug} />
						<button class="admin-pill-link" type="submit">Sync post</button>
					</form>
				</li>
			{/each}
		</ul>
	</div>
</section>
