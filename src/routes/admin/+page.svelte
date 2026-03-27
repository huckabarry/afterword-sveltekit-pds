<script lang="ts">
	let { data, form } = $props();
	let content = $state('');
	let visibility = $state<'public' | 'followers' | 'direct'>('public');
	let directTo = $state('');

	$effect(() => {
		content = String(form?.content || '');
		visibility = (form?.visibility || data.compose.visibility || 'public') as typeof visibility;
		directTo = String(form?.directTo || data.compose.directTo || '');
	});
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
				<h2>{visibility === 'direct' ? 'Send a direct message' : 'Compose a local note'}</h2>
			</div>
			{#if visibility === 'direct'}
				<a class="admin-pill-link" href="/admin">Back to public composer</a>
			{/if}
		</div>

		{#if data.posted}
			<p class="admin-form-success">Note published.</p>
		{/if}

		{#if data.sent}
			<p class="admin-form-success">Direct message sent.</p>
		{/if}

		<form method="POST" enctype="multipart/form-data" class="admin-compose-form">
			<div class="admin-compose-options">
				<label class="admin-field">
					<span>Audience</span>
					<select name="visibility" bind:value={visibility}>
						<option value="public">Public</option>
						<option value="followers">Followers only</option>
						<option value="direct">Direct message</option>
					</select>
				</label>

				{#if visibility === 'direct'}
					<label class="admin-field">
						<span>Recipient actor URL</span>
						<input
							name="directTo"
							type="url"
							placeholder="https://example.social/users/someone"
							bind:value={directTo}
						/>
						{#if data.compose.directLabel}
							<p class="admin-field-note">Starting a message to {data.compose.directLabel}.</p>
						{:else}
							<p class="admin-field-note">Use a message or people card to prefill this if you do not know the actor URL.</p>
						{/if}
					</label>
				{:else}
					<input name="directTo" type="hidden" value="" />
				{/if}
			</div>

			<label class="admin-field">
				<span>Content</span>
				<textarea
					name="content"
					rows="10"
					placeholder={visibility === 'direct'
						? 'Write a private note for this person...'
						: visibility === 'followers'
							? 'Write a note for followers only...'
							: 'Write a note to federate to your followers...'}
					bind:value={content}
				></textarea>
				<p class="admin-field-note admin-compose-count">{content.length} characters</p>
			</label>

			<label class="admin-field">
				<span>Photos</span>
				<input name="images" type="file" accept="image/*" multiple />
			</label>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">
					{visibility === 'direct' ? 'Send message' : 'Publish note'}
				</button>
			</div>
		</form>
	</div>
</section>
