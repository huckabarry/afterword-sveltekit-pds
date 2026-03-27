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
				<p class="admin-eyebrow">Archive</p>
				<h2>Photos</h2>
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
</section>
