<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const selectedSlug = $derived(form?.selectedSlug || data.selectedSlug);
	const selectedPage = $derived(
		form?.selectedPage ||
			data.pages.find((page) => page.slug === selectedSlug) ||
			data.selectedPage
	);
</script>

<section class="admin-panel admin-cms-grid">
	<div class="admin-card admin-cms-browser">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Pages</p>
				<h2>Editorial surfaces</h2>
			</div>
		</div>

		<p class="admin-field-note">
			Starting small: this first pass manages the richer editorial pages that want a real writing
			workspace instead of hardcoded route text.
		</p>

		<nav class="admin-cms-page-list" aria-label="Editable pages">
			{#each data.pages as page}
				<a
					class:admin-cms-page-list__link--active={page.slug === selectedSlug}
					class="admin-cms-page-list__link"
					href={`/admin/pages?slug=${page.slug}`}
				>
					<strong>{page.title}</strong>
					<span>/{page.slug}</span>
				</a>
			{/each}
		</nav>
	</div>

	<div class="admin-card admin-cms-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Editor</p>
				<h2>{selectedPage?.title || 'Page'}</h2>
			</div>
			{#if selectedPage}
				<a class="admin-ghost-button admin-cms-preview-link" href={`/${selectedPage.slug}`} target="_blank" rel="noreferrer">
					Open page
				</a>
			{/if}
		</div>

		{#if form?.success}
			<p class="admin-form-success">Page saved.</p>
		{/if}

		{#if selectedPage}
			<form method="POST" class="admin-compose-form admin-cms-form" use:enhance>
				<input type="hidden" name="slug" value={selectedPage.slug} />

				<label class="admin-field">
					<span>Title</span>
					<input name="title" type="text" value={form?.selectedPage?.title || selectedPage.title} />
				</label>

				<label class="admin-field">
					<span>Description</span>
					<textarea name="description" rows="3">{form?.selectedPage?.description || selectedPage.description}</textarea>
				</label>

				<label class="admin-field">
					<span>Body</span>
					<textarea class="admin-cms-markdown" name="body" rows="22">{form?.selectedPage?.body || selectedPage.body}</textarea>
				</label>

				<p class="admin-field-note">
					Markdown is supported here so links, lists, and section headings can stay lightweight.
				</p>

				{#if form?.error}
					<p class="admin-form-error">{form.error}</p>
				{/if}

				<div class="admin-form-actions">
					<button class="admin-button" type="submit">Save page</button>
				</div>
			</form>
		{/if}
	</div>
</section>
