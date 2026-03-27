<script lang="ts">
	let { data, form } = $props();
	const defaultAvatarUrl = '/assets/images/status-avatar.jpg';

	let avatarRemoved = $state(false);
	let headerRemoved = $state(false);

	$effect(() => {
		avatarRemoved = Boolean(form?.removeAvatar);
		headerRemoved = Boolean(form?.removeHeaderImage);
	});

	const currentAvatarUrl = $derived(form?.avatarUrl || data.profile.avatarUrl);
	const currentHeaderUrl = $derived(form?.headerImageUrl || data.profile.headerImageUrl || '');
	const hasCustomAvatar = $derived(Boolean(currentAvatarUrl) && currentAvatarUrl !== defaultAvatarUrl);
	const displayAvatarUrl = $derived(avatarRemoved ? '' : currentAvatarUrl);
	const displayHeaderUrl = $derived(headerRemoved ? '' : currentHeaderUrl);

	const profileSource = $derived(
		form?.success
			? {
					displayName: form.displayName,
					avatarUrl: form.avatarUrl,
					headerImageUrl: form.headerImageUrl,
					bio: form.bio,
					aboutBody: form.aboutBody
				}
			: data.profile
	);

	const previewProfile = $derived({
		...profileSource,
		avatarUrl: avatarRemoved ? defaultAvatarUrl : profileSource.avatarUrl,
		headerImageUrl: displayHeaderUrl || null
	});

	const previewAboutInterestsInput = $derived(form?.aboutInterestsInput || data.aboutInterestsInput);
	const previewLinksInput = $derived(form?.verificationLinksInput || data.verificationLinksInput);
	const previewMigrationAliasesInput = $derived(form?.migrationAliasesInput || data.migrationAliasesInput);
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Edit profile</p>
				<h2>Identity, about copy, and verification links</h2>
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

			<div class="admin-media-field">
				<div class="admin-media-field__head">
					<span>Avatar</span>
					{#if hasCustomAvatar}
						<button class="admin-ghost-button" type="button" onclick={() => (avatarRemoved = !avatarRemoved)}>
							{avatarRemoved ? 'Keep current' : 'Remove'}
						</button>
					{/if}
				</div>

				{#if displayAvatarUrl}
					<img class="admin-media-field__preview admin-media-field__preview--avatar" src={displayAvatarUrl} alt="" />
				{:else}
					<div class="admin-media-field__empty admin-media-field__empty--avatar">
						{#if hasCustomAvatar}
							The current avatar will be removed. The default avatar will be used after save.
						{:else}
							No custom avatar uploaded yet. The default avatar will stay in place.
						{/if}
					</div>
				{/if}

				<input type="hidden" name="removeAvatar" value={avatarRemoved ? '1' : '0'} />

				<label class="admin-upload-control">
					<span class="admin-ghost-button">{displayAvatarUrl ? 'Replace avatar' : 'Upload avatar'}</span>
					<input
						name="avatarFile"
						type="file"
						accept="image/*"
						onchange={() => {
							avatarRemoved = false;
						}}
					/>
				</label>

				<p class="admin-field-note">Upload a square-ish image for the cleanest crop.</p>
			</div>

			<div class="admin-media-field">
				<div class="admin-media-field__head">
					<span>Header image</span>
					{#if currentHeaderUrl}
						<button class="admin-ghost-button" type="button" onclick={() => (headerRemoved = !headerRemoved)}>
							{headerRemoved ? 'Keep current' : 'Remove'}
						</button>
					{/if}
				</div>

				{#if displayHeaderUrl}
					<img class="admin-media-field__preview admin-media-field__preview--header" src={displayHeaderUrl} alt="" />
				{:else}
					<div class="admin-media-field__empty">
						{#if currentHeaderUrl}
							The current header image will be removed after save.
						{:else}
							No header image uploaded yet.
						{/if}
					</div>
				{/if}

				<input type="hidden" name="removeHeaderImage" value={headerRemoved ? '1' : '0'} />

				<label class="admin-upload-control">
					<span class="admin-ghost-button">{displayHeaderUrl ? 'Replace header' : 'Upload header'}</span>
					<input
						name="headerFile"
						type="file"
						accept="image/*"
						onchange={() => {
							headerRemoved = false;
						}}
					/>
				</label>

				<p class="admin-field-note">Wide landscape images work best in the banner slot.</p>
			</div>

			<label class="admin-field">
				<span>Bio</span>
				<textarea name="bio" rows="4">{form?.bio || data.profile.bio}</textarea>
			</label>

			<label class="admin-field">
				<span>About section</span>
				<textarea
					name="aboutBody"
					rows="10"
					placeholder="Write the longer About page copy here. Separate paragraphs with a blank line."
				>{form?.aboutBody || data.profile.aboutBody}</textarea>
			</label>

			<label class="admin-field">
				<span>About interests</span>
				<textarea
					name="aboutInterests"
					rows="8"
					placeholder="One interest per line"
				>{form?.aboutInterestsInput || data.aboutInterestsInput}</textarea>
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

			{#if previewProfile.aboutBody?.trim()}
				<div class="admin-link-list">
					<p><strong>About</strong></p>
					{#each previewProfile.aboutBody.split(/\r?\n\r?\n+/).map((paragraph) => paragraph.replace(/\r?\n/g, ' ').trim()).filter(Boolean) as paragraph}
						<p>{paragraph}</p>
					{/each}
				</div>
			{/if}

			{#if previewAboutInterestsInput.trim()}
				<div class="admin-field-note">
					<strong>Interests:</strong>
					<ul class="admin-link-list">
						{#each previewAboutInterestsInput.split(/\r?\n/).filter(Boolean) as interest}
							<li>{interest}</li>
						{/each}
					</ul>
				</div>
			{/if}

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
