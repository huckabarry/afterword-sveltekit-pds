<script lang="ts">
	import { enhance } from '$app/forms';

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
	const previewMoveTargetHandleInput = $derived(
		form?.moveTargetHandleInput || data.moveTargetHandleInput || ''
	);
	const previewMoveTargetActorUrl = $derived(
		form?.moveTargetActorUrl || data.profile.moveTargetActorUrl || ''
	);
	const previewMoveStartedAt = $derived(form?.moveStartedAt || data.profile.moveStartedAt || '');
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

		<form method="POST" enctype="multipart/form-data" class="admin-compose-form" use:enhance>
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

			<label class="admin-field">
				<span>Move followers to</span>
				<input
					name="moveTargetHandle"
					type="text"
					placeholder="you@example.com"
					value={form?.moveTargetHandleInput || data.moveTargetHandleInput}
				/>
			</label>

			<p class="admin-field-note">
				Enter the new ActivityPub account handle, save this form to resolve it, then use the
				migration card below when you are ready. For Micro.blog, first add this Afterword account
				as an alias in <code>Account → View Mastodon Details → Aliases</code>.
			</p>

			{#if previewMoveTargetActorUrl}
				<p class="admin-field-note">
					<strong>Resolved actor:</strong>
					<code>{previewMoveTargetActorUrl}</code>
				</p>
			{/if}

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Save profile</button>
			</div>
		</form>
	</div>

	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Account move</p>
				<h2>Move ActivityPub followers away from this site</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This activates <code>movedTo</code> on your old Afterword actor and delivers a signed
			<code>Move</code> activity to the follower inboxes stored on this site. You can rerun it
			later to pick up anyone who followed after the first pass.
		</p>

		{#if previewMoveTargetHandleInput}
			<p><strong>Target handle:</strong> {previewMoveTargetHandleInput}</p>
		{/if}

		{#if previewMoveTargetActorUrl}
			<p><strong>Target actor:</strong> <code>{previewMoveTargetActorUrl}</code></p>
		{/if}

		{#if previewMoveStartedAt}
			<p><strong>Move activated:</strong> {new Date(previewMoveStartedAt).toLocaleString()}</p>
		{/if}

		{#if form?.moveSuccess}
			<p class="admin-form-success">
				Move delivery finished. Delivered: {form.moveDelivered}, already delivered:
				{form.moveAlreadyDelivered}, failed: {form.moveFailed}, skipped: {form.moveSkipped}.
			</p>
		{/if}

		{#if form?.moveError}
			<p class="admin-form-error">{form.moveError}</p>
		{/if}

		<form method="POST" action="?/moveFollowers" class="admin-compose-form" use:enhance>
			<div class="admin-form-actions">
				<button class="admin-button" type="submit" disabled={!previewMoveTargetActorUrl}>
					Move followers now
				</button>
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

			{#if previewMoveTargetActorUrl}
				<div class="admin-field-note">
					<strong>Move target:</strong>
					<p>{previewMoveTargetHandleInput || previewMoveTargetActorUrl}</p>
					<p><code>{previewMoveTargetActorUrl}</code></p>
					{#if previewMoveStartedAt}
						<p>This actor will publish <code>movedTo</code>.</p>
					{:else}
						<p>
							This is staged only. It will not publish <code>movedTo</code> until you trigger the
							move.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</section>
