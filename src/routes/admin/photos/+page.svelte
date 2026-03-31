<script lang="ts">
	let { data } = $props();

	type PhotoSyncFailure = {
		postTitle?: string;
		error?: string;
	};

	type PhotoSyncPayload = {
		ok: boolean;
		totalAvailable?: number;
		processed?: number;
		syncedCount?: number;
		nextOffset?: number | null;
		failures?: PhotoSyncFailure[];
		error?: string;
	};

	let syncing = $state(false);
	let syncingSlug = $state(false);
	let processed = $state(0);
	let total = $state<number | null>(null);
	let synced = $state(0);
	let failures = $state<string[]>([]);
	let message = $state('');
	let copiedUrl = $state('');
	let syncSlug = $state('');

	function getCopyUrl(photo: (typeof data.photos)[number]) {
		const source = photo.originalUrl || photo.displayUrl || photo.imageUrl;
		if (!source) return '';

		try {
			return new URL(source, data.siteOrigin).href;
		} catch {
			return source;
		}
	}

	async function copyUrl(photo: (typeof data.photos)[number]) {
		const url = getCopyUrl(photo);

		try {
			await navigator.clipboard.writeText(url);
			copiedUrl = url;
			window.setTimeout(() => {
				if (copiedUrl === url) copiedUrl = '';
			}, 1800);
		} catch {
			copiedUrl = '';
		}
	}

	async function syncPhotos() {
		if (syncing) return;

		syncing = true;
		processed = 0;
		total = null;
		synced = 0;
		failures = [];
		message = '';

		let nextOffset: number | null = 0;

		while (nextOffset !== null) {
			try {
				const response: Response = await fetch('/admin/api/photos-sync', {
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						offset: nextOffset,
						limit: 20
					})
				});
				const payload: PhotoSyncPayload | null = await response.json().catch(() => null);

				if (!response.ok || !payload?.ok) {
					failures = [
						...failures,
						payload?.error || `Batch failed with ${response.status}`
					];
					break;
				}

				total = payload.totalAvailable ?? total ?? 0;
				processed += payload.processed ?? 0;
				synced += payload.syncedCount ?? 0;
				failures = [
					...failures,
					...(payload.failures || []).map(
						(failure: { postTitle?: string; error?: string }) =>
							`${failure.postTitle || 'Photo'}: ${failure.error || 'Unknown sync error.'}`
					)
				];
				nextOffset = payload.nextOffset ?? null;
			} catch (error) {
				failures = [
					...failures,
					error instanceof Error ? error.message : 'Unexpected sync error.'
				];
				break;
			}
		}

		message = total === null
			? 'Photo sync did not start.'
			: `Synced ${synced} of ${total} gallery photos into the manifest.`;
		syncing = false;
	}

	async function syncPhotoSlug() {
		const slug = syncSlug.trim().replace(/^\/+|\/+$/g, '');
		if (!slug || syncing || syncingSlug) return;

		syncingSlug = true;
		failures = [];
		message = '';

		try {
			const response: Response = await fetch('/admin/api/photos-sync', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ slug })
			});
			const payload: PhotoSyncPayload | null = await response.json().catch(() => null);

			if (!response.ok || !payload?.ok) {
				failures = [payload?.error || `Slug sync failed with ${response.status}`];
				message = 'Unable to sync that Ghost post.';
				return;
			}

			message = `Synced gallery images for “${slug}”.`;
		} catch (error) {
			failures = [error instanceof Error ? error.message : 'Unexpected sync error.'];
			message = 'Unable to sync that Ghost post.';
		} finally {
			syncingSlug = false;
		}
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Media</p>
				<h2>Images</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This sync pulls gallery and photo-led field notes from Ghost, saves missing originals to
			R2, captures image dimensions, and writes a D1 manifest for the public
			<code>/photos</code> page. Once populated, the public gallery no longer needs Ghost at
			request time.
		</p>

		<div class="admin-link-list">
			<p><strong>Manifest photos</strong></p>
			<p><code>{data.summary.totalPhotos}</code></p>
			<p><strong>R2-backed entries</strong></p>
			<p><code>{data.summary.syncedToR2}</code></p>
			<p><strong>Last sync</strong></p>
			<p><code>{data.summary.lastSyncedAt || 'Never'}</code></p>
		</div>

		<div class="admin-form-actions">
			<button class="admin-button" type="button" onclick={syncPhotos} disabled={syncing}>
				{#if syncing}
					Syncing {processed}{#if total !== null} / {total}{/if}…
				{:else}
					Sync photos from Ghost
				{/if}
			</button>
		</div>

		<div class="admin-link-list">
			<p><strong>Repair one post</strong></p>
			<p class="admin-field-note">
				Use a Ghost slug like <code>lake-tahoe-2</code> to sync one gallery post without rerunning the full manifest import.
			</p>
			<div class="admin-form-actions">
				<input
					class="admin-input"
					type="text"
					name="slug"
					bind:value={syncSlug}
					placeholder="lake-tahoe-2"
					autocomplete="off"
				/>
				<button
					class="admin-button admin-button--secondary"
					type="button"
					onclick={syncPhotoSlug}
					disabled={syncing || syncingSlug || !syncSlug.trim()}
				>
					{#if syncingSlug}
						Syncing slug…
					{:else}
						Sync this post
					{/if}
				</button>
			</div>
		</div>

		{#if message}
			<p class:admin-form-error={failures.length > 0} class:admin-form-success={failures.length === 0}>
				{message}
			</p>
		{/if}

		{#if failures.length}
			<div class="admin-link-list">
				<p><strong>Sync issues</strong></p>
				{#each failures as failure}
					<p class="admin-form-error">{failure}</p>
				{/each}
			</div>
		{/if}
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Manifest</p>
				<h2>Synced images</h2>
			</div>
			<p class="admin-field-note">
				Showing {data.photos.length ? `${(data.pagination.page - 1) * data.pagination.limit + 1}-${(data.pagination.page - 1) * data.pagination.limit + data.photos.length}` : '0'} of {data.pagination.total}
			</p>
		</div>

		{#if data.pagination.totalPages > 1}
			<nav class="admin-image-pagination" aria-label="Image pages">
				{#if data.pagination.page > 1}
					<a class="admin-pill-link" href={`/admin/photos?page=${data.pagination.page - 1}`}>Previous</a>
				{/if}
				<span class="admin-field-note">Page {data.pagination.page} of {data.pagination.totalPages}</span>
				{#if data.pagination.page < data.pagination.totalPages}
					<a class="admin-pill-link" href={`/admin/photos?page=${data.pagination.page + 1}`}>Next</a>
				{/if}
			</nav>
		{/if}

		{#if data.photos.length}
			<div class="admin-image-grid">
				{#each data.photos as photo}
					<article class="admin-image-card">
						<a
							class="admin-image-card__thumb"
							href={photo.lightboxUrl || photo.displayUrl || photo.originalUrl || photo.imageUrl}
							target="_blank"
							rel="noreferrer"
						>
							<img
								src={photo.displayUrl || photo.originalUrl || photo.imageUrl}
								alt={photo.alt || photo.postTitle}
								loading="lazy"
							/>
						</a>
						<div class="admin-image-card__meta">
							<p class="admin-image-card__title">
								<a href={photo.postPath}>{photo.postTitle}</a>
							</p>
							<p class="admin-image-card__detail">
								{#if photo.width && photo.height}
									{photo.width} × {photo.height}
								{:else}
									Dimensions pending
								{/if}
							</p>
							<p class="admin-image-card__detail">
								{photo.postPublishedAt.toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</p>
							<div class="admin-image-card__actions">
								<a href={photo.originalUrl || photo.imageUrl} target="_blank" rel="noreferrer">Original</a>
								{#if photo.displayUrl}
									<a href={photo.displayUrl} target="_blank" rel="noreferrer">Display</a>
								{/if}
								<a href={photo.postSourceUrl} target="_blank" rel="noreferrer">Ghost</a>
								<button class="admin-pill-link" type="button" onclick={() => copyUrl(photo)}>
									{copiedUrl === getCopyUrl(photo) ? 'Copied' : 'Copy URL'}
								</button>
							</div>
							<p class="admin-image-card__path">
								<code>{getCopyUrl(photo)}</code>
							</p>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<p class="admin-field-note">No images are in the manifest yet. Run a sync to populate this view.</p>
		{/if}

		{#if data.pagination.totalPages > 1}
			<nav class="admin-image-pagination admin-image-pagination--bottom" aria-label="Image pages">
				{#if data.pagination.page > 1}
					<a class="admin-pill-link" href={`/admin/photos?page=${data.pagination.page - 1}`}>Previous</a>
				{/if}
				<span class="admin-field-note">Page {data.pagination.page} of {data.pagination.totalPages}</span>
				{#if data.pagination.page < data.pagination.totalPages}
					<a class="admin-pill-link" href={`/admin/photos?page=${data.pagination.page + 1}`}>Next</a>
				{/if}
			</nav>
		{/if}
	</div>
</section>

<style>
	.admin-image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 1rem;
	}

	.admin-image-card {
		display: grid;
		gap: 0.7rem;
	}

	.admin-image-card__thumb {
		display: block;
		border-radius: 16px;
		overflow: hidden;
		background: #f2ede2;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.admin-image-card__thumb img {
		display: block;
		width: 100%;
		height: auto;
	}

	.admin-image-card__meta {
		display: grid;
		gap: 0.2rem;
	}

	.admin-image-card__title {
		margin: 0;
		font-weight: 700;
	}

	.admin-image-card__title a {
		text-decoration: none;
	}

	.admin-image-card__detail {
		margin: 0;
		color: rgba(17, 17, 17, 0.68);
		font-size: 0.9rem;
	}

	.admin-image-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.8rem;
		margin-top: 0.25rem;
	}

	.admin-image-card__actions a,
	.admin-image-card__actions button {
		font-size: 0.9rem;
		text-decoration: none;
	}

	.admin-image-card__path {
		margin: 0.15rem 0 0;
		font-size: 0.8rem;
		color: rgba(17, 17, 17, 0.58);
		word-break: break-all;
	}

	.admin-image-pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.admin-image-pagination--bottom {
		margin-top: 1rem;
		margin-bottom: 0;
	}
</style>
