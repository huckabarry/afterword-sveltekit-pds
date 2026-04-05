<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const settings = $derived(form?.success ? form : data.settings);
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow admin-cms-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Site</p>
				<h2>Shell settings and public voice</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This is the top-level framing layer: the site title, the line under the wordmark, and the
			footer copy that makes the place feel intentional.
		</p>

		{#if form?.success}
			<p class="admin-form-success">Site settings saved.</p>
		{/if}

		<form method="POST" class="admin-compose-form admin-cms-form" use:enhance>
			<label class="admin-field">
				<span>Site title</span>
				<input name="siteTitle" type="text" value={form?.siteTitle || data.settings.siteTitle} />
			</label>

			<label class="admin-field">
				<span>Site tagline</span>
				<textarea name="siteTagline" rows="3">{form?.siteTagline || data.settings.siteTagline}</textarea>
			</label>

			<label class="admin-field">
				<span>Footer tagline</span>
				<textarea name="footerTagline" rows="3">{form?.footerTagline || data.settings.footerTagline}</textarea>
			</label>

			<label class="admin-field">
				<span>Search placeholder</span>
				<input
					name="searchPlaceholder"
					type="text"
					value={form?.searchPlaceholder || data.settings.searchPlaceholder}
				/>
			</label>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Save site settings</button>
			</div>
		</form>
	</div>

	<div class="admin-card admin-cms-preview">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Preview</p>
				<h2>Public shell</h2>
			</div>
		</div>

		<div class="admin-cms-shell-preview">
			<div class="admin-cms-shell-preview__bar">
				<strong>{settings.siteTitle}</strong>
				<span>{settings.searchPlaceholder}</span>
			</div>
			<div class="admin-cms-shell-preview__body">
				<p>{settings.siteTagline}</p>
			</div>
			<div class="admin-cms-shell-preview__foot">
				<p>{settings.footerTagline}</p>
			</div>
		</div>
	</div>
</section>
