<script lang="ts">
	let { data, form } = $props();

	const previewProfile = $derived(
		form?.success
			? {
					displayName: form.displayName,
					avatarUrl: form.avatarUrl,
					headerImageUrl: form.headerImageUrl,
					bio: form.bio
				}
			: data.profile
	);

	const previewLinksInput = $derived(form?.verificationLinksInput || data.verificationLinksInput);
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Edit profile</p>
				<h2>Identity, avatar, and verification links</h2>
			</div>
		</div>

		{#if form?.success || data.saved}
			<p class="admin-form-success">Profile saved.</p>
		{/if}

		<form method="POST" class="admin-compose-form">
			<label class="admin-field">
				<span>Display name</span>
				<input name="displayName" type="text" value={form?.displayName || data.profile.displayName} />
			</label>

			<label class="admin-field">
				<span>Avatar image URL</span>
				<input name="avatarUrl" type="url" value={form?.avatarUrl || data.profile.avatarUrl} />
			</label>

			<label class="admin-field">
				<span>Header image URL</span>
				<input
					name="headerImageUrl"
					type="url"
					value={form?.headerImageUrl || data.profile.headerImageUrl || ''}
					placeholder="Optional banner image"
				/>
			</label>

			<label class="admin-field">
				<span>Bio</span>
				<textarea name="bio" rows="4">{form?.bio || data.profile.bio}</textarea>
			</label>

			<label class="admin-field">
				<span>Verification links</span>
				<textarea
					name="verificationLinks"
					rows="5"
					placeholder="Label | https://service.example/you"
				>{form?.verificationLinksInput || data.verificationLinksInput}</textarea>
			</label>

			<p class="admin-field-note">One link per line, formatted as <code>Label | URL</code>. These are published as <code>rel="me"</code> links.</p>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Save profile</button>
			</div>
		</form>
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Preview</p>
				<h2>Public identity</h2>
			</div>
		</div>

		<div class="admin-profile-preview">
			{#if previewProfile.headerImageUrl}
				<img class="admin-profile-preview__banner" src={previewProfile.headerImageUrl} alt="" />
			{/if}

			<div class="admin-profile-preview__meta">
				<img class="admin-profile-preview__avatar" src={previewProfile.avatarUrl} alt={previewProfile.displayName} />
				<div>
					<h3>{previewProfile.displayName}</h3>
					<p>{previewProfile.bio}</p>
				</div>
			</div>

			{#if previewLinksInput.trim()}
				<ul class="admin-link-list">
					{#each previewLinksInput.split(/\r?\n/).filter(Boolean) as line}
						{@const [label, ...urlParts] = line.split('|')}
						{@const href = urlParts.join('|').trim()}
						{#if label.trim() && href}
							<li><a href={href} target="_blank" rel="noreferrer">{label.trim()}</a></li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</section>
