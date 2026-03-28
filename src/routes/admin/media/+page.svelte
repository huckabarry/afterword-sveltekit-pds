<script lang="ts">
	type MusicImportPayload = {
		ok: boolean;
		tracks?: {
			available?: number;
			attempted?: number;
			imported?: number;
			failed?: number;
		};
		albums?: {
			available?: number;
			attempted?: number;
			imported?: number;
			failed?: number;
		};
		error?: string;
		errors?: Array<{ collection?: string; slug?: string; message?: string }>;
	};

	type CoverOverridePayload = {
		ok: boolean;
		books?: {
			available?: number;
			attempted?: number;
			imported?: number;
			skipped?: number;
			failed?: number;
		};
		error?: string;
		errors?: Array<{ slug?: string; title?: string; message?: string }>;
	};

	type RunState = {
		running: boolean;
		message: string;
		errors: string[];
	};

	const idleState = (): RunState => ({
		running: false,
		message: '',
		errors: []
	});

	let syncingAll = $state(false);
	let forceBookCovers = $state(false);
	let overallMessage = $state('');
	let overallErrors = $state<string[]>([]);
	let musicState = $state<RunState>(idleState());
	let coverState = $state<RunState>(idleState());

	function resetRunState() {
		overallMessage = '';
		overallErrors = [];
	}

	async function runMusicImport() {
		musicState = {
			running: true,
			message: '',
			errors: []
		};

		try {
			const response = await fetch('/admin/api/music-import', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					collections: ['tracks', 'albums']
				})
			});
			const payload: MusicImportPayload | null = await response.json().catch(() => null);

			if (!response.ok || !payload) {
				throw new Error(payload?.error || `Music import failed with ${response.status}`);
			}

			const trackImported = payload.tracks?.imported ?? 0;
			const albumImported = payload.albums?.imported ?? 0;
			const trackAvailable = payload.tracks?.available ?? 0;
			const albumAvailable = payload.albums?.available ?? 0;
			const errors = (payload.errors || []).map(
				(entry) =>
					`${entry.collection || 'music'}:${entry.slug || 'item'} ${entry.message || 'Unknown error'}`
			);

			musicState = {
				running: false,
				message: `Imported ${trackImported} of ${trackAvailable} tracks and ${albumImported} of ${albumAvailable} albums into your PDS.`,
				errors
			};

			return payload.ok;
		} catch (error) {
			musicState = {
				running: false,
				message: '',
				errors: [error instanceof Error ? error.message : 'Unable to import music records.']
			};
			return false;
		}
	}

	async function runBookCoverOverrides() {
		coverState = {
			running: true,
			message: '',
			errors: []
		};

		try {
			const response = await fetch('/admin/api/popfeed-cover-overrides', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					force: forceBookCovers
				})
			});
			const payload: CoverOverridePayload | null = await response.json().catch(() => null);

			if (!response.ok || !payload) {
				throw new Error(payload?.error || `Book-cover sync failed with ${response.status}`);
			}

			const imported = payload.books?.imported ?? 0;
			const available = payload.books?.available ?? 0;
			const skipped = payload.books?.skipped ?? 0;
			const errors = (payload.errors || []).map(
				(entry) => `${entry.title || entry.slug || 'book'}: ${entry.message || 'Unknown error'}`
			);

			coverState = {
				running: false,
				message: `Saved ${imported} book cover overrides from ${available} Popfeed books. ${skipped} were skipped.`,
				errors
			};

			return payload.ok;
		} catch (error) {
			coverState = {
				running: false,
				message: '',
				errors: [error instanceof Error ? error.message : 'Unable to sync book cover overrides.']
			};
			return false;
		}
	}

	async function runEverything() {
		if (syncingAll || musicState.running || coverState.running) {
			return;
		}

		syncingAll = true;
		resetRunState();

		const musicOk = await runMusicImport();
		const coversOk = await runBookCoverOverrides();

		overallErrors = [...musicState.errors, ...coverState.errors];
		overallMessage =
			musicOk && coversOk
				? 'Media assets were synced into your PDS and book-cover overrides were refreshed.'
				: 'Media sync finished with some issues. See the notes below.';

		syncingAll = false;
	}
</script>

<svelte:head>
	<title>Media | Admin</title>
</svelte:head>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Media</p>
				<h2>Localize media assets</h2>
			</div>
		</div>

		<p class="admin-field-note">
			Use this screen to move remote media artwork into your PDS. Music import uploads track and
			album art from your archive-backed entries, and the Popfeed pass creates companion book-cover
			overrides from Open Library without editing the original Popfeed records.
		</p>

		<div class="admin-form-actions">
			<button
				class="admin-button"
				type="button"
				onclick={runEverything}
				disabled={syncingAll || musicState.running || coverState.running}
			>
				{#if syncingAll}
					Syncing media assets…
				{:else}
					Run both syncs
				{/if}
			</button>
		</div>

		<label class="admin-checkbox">
			<input
				type="checkbox"
				bind:checked={forceBookCovers}
				disabled={syncingAll || coverState.running}
			/>
			<span>Force-refresh existing book cover overrides</span>
		</label>

		{#if overallMessage}
			<p
				class:admin-form-error={overallErrors.length > 0}
				class:admin-form-success={overallErrors.length === 0}
			>
				{overallMessage}
			</p>
		{/if}

		{#if overallErrors.length}
			<div class="admin-link-list">
				<p><strong>Run issues</strong></p>
				{#each overallErrors as failure}
					<p class="admin-form-error">{failure}</p>
				{/each}
			</div>
		{/if}
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Music</p>
				<h2>Import track and album artwork</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This uploads artwork for archive-backed tracks and albums into your PDS music collections so
			the public music pages can prefer local blobs instead of remote Apple Music or other provider
			images.
		</p>

		<div class="admin-form-actions">
			<button
				class="admin-button"
				type="button"
				onclick={runMusicImport}
				disabled={syncingAll || musicState.running}
			>
				{#if musicState.running}
					Importing music…
				{:else}
					Run music import
				{/if}
			</button>
		</div>

		{#if musicState.message}
			<p
				class:admin-form-error={musicState.errors.length > 0}
				class:admin-form-success={musicState.errors.length === 0}
			>
				{musicState.message}
			</p>
		{/if}

		{#if musicState.errors.length}
			<div class="admin-link-list">
				<p><strong>Music import issues</strong></p>
				{#each musicState.errors as failure}
					<p class="admin-form-error">{failure}</p>
				{/each}
			</div>
		{/if}
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Books</p>
				<h2>Backfill Popfeed cover overrides</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This creates companion override records in your own PDS namespace so book covers can come from
			local blobs rather than the raw Popfeed image source.
		</p>

		<div class="admin-form-actions">
			<button
				class="admin-button"
				type="button"
				onclick={runBookCoverOverrides}
				disabled={syncingAll || coverState.running}
			>
				{#if coverState.running}
					Syncing covers…
				{:else}
					Run book-cover backfill
				{/if}
			</button>
		</div>

		{#if coverState.message}
			<p
				class:admin-form-error={coverState.errors.length > 0}
				class:admin-form-success={coverState.errors.length === 0}
			>
				{coverState.message}
			</p>
		{/if}

		{#if coverState.errors.length}
			<div class="admin-link-list">
				<p><strong>Book-cover issues</strong></p>
				{#each coverState.errors as failure}
					<p class="admin-form-error">{failure}</p>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.admin-checkbox {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.35rem;
		color: rgba(239, 240, 244, 0.82);
		font-size: 0.95rem;
	}

	.admin-checkbox input {
		inline-size: 1rem;
		block-size: 1rem;
	}
</style>
