<script lang="ts">
	let { data, form } = $props();
</script>

<section class="admin-panel admin-home">
	<div class="admin-summary-grid">
		<a class="admin-stat" href="/admin/following/accounts">
			<span class="admin-stat__value">{data.stats.followingCount}</span>
			<span class="admin-stat__label">Following</span>
		</a>
		<a class="admin-stat" href="/admin/followers">
			<span class="admin-stat__value">{data.stats.followerCount}</span>
			<span class="admin-stat__label">Followers</span>
		</a>
		<a class="admin-stat" href="/admin/webmentions">
			<span class="admin-stat__value">{data.stats.webmentionCount}</span>
			<span class="admin-stat__label">Webmentions</span>
		</a>
		<a class="admin-stat" href="/admin/messages">
			<span class="admin-stat__value">{data.stats.messageCount}</span>
			<span class="admin-stat__label">Messages</span>
		</a>
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Home</p>
				<h2>Compose a local note</h2>
			</div>
		</div>

		{#if data.posted}
			<p class="admin-form-success">Note published.</p>
		{/if}

		<form method="POST" enctype="multipart/form-data" class="admin-compose-form">
			<label class="admin-field">
				<span>Content</span>
				<textarea
					name="content"
					rows="10"
					placeholder="Write a note to federate to your followers..."
				>{form?.content || ''}</textarea>
			</label>

			<label class="admin-field">
				<span>Photos</span>
				<input name="images" type="file" accept="image/*" multiple />
			</label>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Publish note</button>
			</div>
		</form>
	</div>
</section>
