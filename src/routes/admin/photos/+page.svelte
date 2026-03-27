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
	let processed = $state(0);
	let total = $state<number | null>(null);
	let synced = $state(0);
	let failures = $state<string[]>([]);
	let message = $state('');

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
				<h2>Recent synced images</h2>
			</div>
		</div>

		{#if data.recentPhotos.length}
			<div class="admin-image-grid">
				{#each data.recentPhotos as photo}
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
							</div>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<p class="admin-field-note">No images are in the manifest yet. Run a sync to populate this view.</p>
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

	.admin-image-card__actions a {
		font-size: 0.9rem;
		text-decoration: none;
	}
</style>
