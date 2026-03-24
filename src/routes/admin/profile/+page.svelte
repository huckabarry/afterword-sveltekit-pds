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
	const previewMigrationAliasesInput = $derived(form?.migrationAliasesInput || data.migrationAliasesInput);
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

		<form method="POST" enctype="multipart/form-data" class="admin-compose-form">
			<label class="admin-field">
				<span>Display name</span>
				<input name="displayName" type="text" value={form?.displayName || data.profile.displayName} />
			</label>

			<label class="admin-field">
				<span>Avatar image URL</span>
				<input
					name="avatarUrl"
					type="text"
					value={form?.avatarUrl || data.profile.avatarUrl}
					placeholder="/media/profile/avatar.jpg or https://example.com/avatar.jpg"
				/>
			</label>

			<label class="admin-field">
				<span>Upload avatar</span>
				<input name="avatarFile" type="file" accept="image/*" />
			</label>

			<label class="admin-field">
				<span>Header image URL</span>
				<input
					name="headerImageUrl"
					type="text"
					value={form?.headerImageUrl || data.profile.headerImageUrl || ''}
					placeholder="/media/profile/header.jpg or https://example.com/header.jpg"
				/>
			</label>

			<label class="admin-field">
				<span>Upload header image</span>
				<input name="headerFile" type="file" accept="image/*" />
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

			<label class="admin-field">
				<span>Migration aliases</span>
				<textarea
					name="migrationAliases"
					rows="3"
					placeholder="https://old.instance/@you"
				>{form?.migrationAliasesInput || data.migrationAliasesInput}</textarea>
			</label>

			<p class="admin-field-note">One ActivityPub account URL per line. These are published on your actor as <code>alsoKnownAs</code> so this account can be recognized as the move target.</p>

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

			{#if previewMigrationAliasesInput.trim()}
				<div class="admin-field-note">
					<strong>Migration aliases:</strong>
					<ul class="admin-link-list">
						{#each previewMigrationAliasesInput.split(/\r?\n/).filter(Boolean) as alias}
							<li>{alias}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>
</section>
