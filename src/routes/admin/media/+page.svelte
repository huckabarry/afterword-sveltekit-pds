<script lang="ts">
	import type {
		PopfeedBookCoverReviewItem,
		PopfeedBookCoverReviewQueue
	} from '$lib/server/pds-popfeed-overrides';

	type MusicImportPayload = {
		ok: boolean;
		offset?: number;
		nextOffset?: number | null;
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
		offset?: number;
		nextOffset?: number | null;
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

	type CoverReviewPayload = {
		ok: boolean;
		total?: number;
		items?: PopfeedBookCoverReviewItem[];
		error?: string;
	};

	type RunState = {
		running: boolean;
		message: string;
		errors: string[];
	};

	let { data }: { data: { reviewQueue: PopfeedBookCoverReviewQueue } } = $props();

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
	let reviewState = $state<RunState>(idleState());
	let reviewItems = $state<PopfeedBookCoverReviewItem[]>([]);
	let reviewTotal = $state(0);
	let reviewPending = $state<Record<string, 'approve' | 'hide'>>({});
	let seededReviewQueue = $state(false);

	$effect(() => {
		if (seededReviewQueue) {
			return;
		}

		reviewItems = data.reviewQueue.items;
		reviewTotal = data.reviewQueue.total;
		seededReviewQueue = true;
	});

	function resetRunState() {
		overallMessage = '';
		overallErrors = [];
	}

	function isReviewActionRunning(sourceUri: string) {
		return Boolean(reviewPending[sourceUri]);
	}

	async function loadReviewQueue() {
		reviewState = {
			running: true,
			message: '',
			errors: []
		};

		try {
			const response = await fetch('/admin/api/popfeed-cover-review?limit=24');
			const payload: CoverReviewPayload | null = await response.json().catch(() => null);

			if (!response.ok || !payload) {
				throw new Error(
					payload?.error || `Unable to load book-cover review queue (${response.status}).`
				);
			}

			reviewItems = payload.items || [];
			reviewTotal = payload.total || 0;
			reviewState = {
				running: false,
				message: '',
				errors: []
			};
		} catch (error) {
			reviewState = {
				running: false,
				message: '',
				errors: [
					error instanceof Error ? error.message : 'Unable to load the book-cover review queue.'
				]
			};
		}
	}

	async function reviewCover(sourceUri: string, action: 'approve' | 'hide') {
		if (isReviewActionRunning(sourceUri)) {
			return;
		}

		reviewPending = {
			...reviewPending,
			[sourceUri]: action
		};
		reviewState = {
			running: false,
			message: '',
			errors: []
		};

		try {
			const response = await fetch('/admin/api/popfeed-cover-review', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					sourceUri,
					action
				})
			});
			const payload: { ok?: boolean; error?: string } | null = await response
				.json()
				.catch(() => null);

			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || `Unable to ${action} this cover (${response.status}).`);
			}

			await loadReviewQueue();
			reviewState = {
				running: false,
				message: action === 'approve' ? 'Book cover approved.' : 'Book cover hidden.',
				errors: []
			};
		} catch (error) {
			reviewState = {
				running: false,
				message: '',
				errors: [error instanceof Error ? error.message : 'Unable to update this book cover.']
			};
		} finally {
			const { [sourceUri]: _, ...rest } = reviewPending;
			reviewPending = rest;
		}
	}

	async function runMusicCollection(collection: 'tracks' | 'albums', batchSize: number) {
		let nextOffset: number | null = 0;
		let imported = 0;
		let available = 0;
		let ok = true;
		const errors: string[] = [];

		while (nextOffset !== null) {
			const currentOffset: number = nextOffset;
			const response: Response = await fetch('/admin/api/music-import', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({
					collections: [collection],
					limit: batchSize,
					offset: currentOffset
				})
			});
			const payload: MusicImportPayload | null = await response.json().catch(() => null);

			if (!response.ok || !payload) {
				throw new Error(payload?.error || `Music import failed with ${response.status}`);
			}

			const stats = collection === 'tracks' ? payload.tracks : payload.albums;
			imported += stats?.imported ?? 0;
			available = Math.max(available, stats?.available ?? 0);
			errors.push(
				...(payload.errors || []).map(
					(entry) =>
						`${entry.collection || 'music'}:${entry.slug || 'item'} ${entry.message || 'Unknown error'}`
				)
			);
			ok = ok && payload.ok;

			const upcomingOffset: number | null =
				typeof payload.nextOffset === 'number' ? payload.nextOffset : null;

			if (upcomingOffset !== null && upcomingOffset <= currentOffset) {
				throw new Error(`Music import for ${collection} did not advance to the next batch.`);
			}

			nextOffset = upcomingOffset;
		}

		return {
			ok,
			imported,
			available,
			errors
		};
	}

	async function runMusicImport() {
		musicState = {
			running: true,
			message: '',
			errors: []
		};

		try {
			const trackResult = await runMusicCollection('tracks', 2);
			const albumResult = await runMusicCollection('albums', 1);
			const errors = [...trackResult.errors, ...albumResult.errors];

			musicState = {
				running: false,
				message: `Imported ${trackResult.imported} of ${trackResult.available} tracks and ${albumResult.imported} of ${albumResult.available} albums into your PDS.`,
				errors
			};

			return trackResult.ok && albumResult.ok && errors.length === 0;
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
		const batchSize = 6;
		coverState = {
			running: true,
			message: '',
			errors: []
		};

		try {
			let nextOffset: number | null = 0;
			let imported = 0;
			let available = 0;
			let skipped = 0;
			let ok = true;
			const errors: string[] = [];

			while (nextOffset !== null) {
				const currentOffset: number = nextOffset;
				const response: Response = await fetch('/admin/api/popfeed-cover-overrides', {
					method: 'POST',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						force: forceBookCovers,
						limit: batchSize,
						offset: currentOffset
					})
				});
				const payload: CoverOverridePayload | null = await response.json().catch(() => null);

				if (!response.ok || !payload) {
					throw new Error(payload?.error || `Book-cover sync failed with ${response.status}`);
				}

				imported += payload.books?.imported ?? 0;
				available = Math.max(available, payload.books?.available ?? 0);
				skipped += payload.books?.skipped ?? 0;
				errors.push(
					...(payload.errors || []).map(
						(entry) => `${entry.title || entry.slug || 'book'}: ${entry.message || 'Unknown error'}`
					)
				);
				ok = ok && payload.ok;

				const upcomingOffset: number | null =
					typeof payload.nextOffset === 'number' ? payload.nextOffset : null;

				if (upcomingOffset !== null && upcomingOffset <= currentOffset) {
					throw new Error('Book-cover sync did not advance to the next batch.');
				}

				nextOffset = upcomingOffset;
			}

			coverState = {
				running: false,
				message: `Queued ${imported} candidate book covers from ${available} Popfeed books. ${skipped} were skipped.`,
				errors
			};
			await loadReviewQueue();

			return ok && errors.length === 0;
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
				? 'Media assets were synced into your PDS and book-cover candidates were refreshed.'
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
			album art from your archive-backed entries, and the Popfeed pass queues candidate book covers
			for review without editing the original Popfeed records.
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
			<span>Force-refresh existing queued book cover candidates</span>
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
				<h2>Queue Popfeed cover candidates</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This fetches candidate book covers into your own PDS namespace for review. Only approved
			covers appear publicly; untrusted book-cover sources stay hidden until you approve them.
		</p>

		<div class="admin-form-actions">
			<button
				class="admin-button"
				type="button"
				onclick={runBookCoverOverrides}
				disabled={syncingAll || coverState.running}
			>
				{#if coverState.running}
					Queueing covers…
				{:else}
					Run book-cover queue
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

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Review</p>
				<h2>Review queued book covers</h2>
			</div>
		</div>

		<p class="admin-field-note">
			These books are using hidden or untrusted art in Popfeed. Approve a queued candidate to show
			it publicly, or hide the image entirely.
		</p>

		<div class="admin-form-actions">
			<button
				class="admin-button review-action-secondary"
				type="button"
				onclick={loadReviewQueue}
				disabled={reviewState.running || syncingAll}
			>
				{#if reviewState.running}
					Refreshing queue…
				{:else}
					Refresh review queue
				{/if}
			</button>
			<span class="admin-field-note">{reviewTotal} books currently need review.</span>
		</div>

		{#if reviewState.message}
			<p
				class:admin-form-error={reviewState.errors.length > 0}
				class:admin-form-success={reviewState.errors.length === 0}
			>
				{reviewState.message}
			</p>
		{/if}

		{#if reviewState.errors.length}
			<div class="admin-link-list">
				<p><strong>Review queue issues</strong></p>
				{#each reviewState.errors as failure}
					<p class="admin-form-error">{failure}</p>
				{/each}
			</div>
		{/if}

		{#if !reviewItems.length && !reviewState.running && !reviewState.errors.length}
			<p class="admin-field-note">No book covers are waiting for review right now.</p>
		{/if}

		{#if reviewItems.length}
			<div class="cover-review-list">
				{#each reviewItems as item}
					<article class="cover-review-card">
						<div class="cover-review-images">
							<div class="cover-review-figure">
								<p class="cover-review-caption">Queued candidate</p>
								{#if item.candidateImageUrl}
									<img
										class="cover-review-image"
										src={item.candidateImageUrl}
										alt={`Candidate cover for ${item.title}`}
										loading="lazy"
									/>
								{:else}
									<div class="cover-review-image cover-review-image--empty">
										<span>No candidate cover queued</span>
									</div>
								{/if}
							</div>

							<div class="cover-review-figure">
								<p class="cover-review-caption">Original source</p>
								{#if item.sourceImageUrl}
									<img
										class="cover-review-image"
										src={item.sourceImageUrl}
										alt={`Current source image for ${item.title}`}
										loading="lazy"
									/>
								{:else}
									<div class="cover-review-image cover-review-image--empty">
										<span>No source image on the Popfeed record</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="cover-review-body">
							<h3 class="cover-review-title">
								<a href={item.localPath} target="_blank" rel="noreferrer">{item.title}</a>
							</h3>

							{#if item.author}
								<p class="cover-review-meta">{item.author}</p>
							{/if}

							<p class="admin-field-note">{item.queueReason}</p>

							<div class="cover-review-details">
								{#if item.candidateProvider}
									<p class="cover-review-caption">Candidate provider: {item.candidateProvider}</p>
								{/if}
								{#if item.isbn}
									<p class="cover-review-caption">ISBN: <code>{item.isbn}</code></p>
								{/if}
							</div>

							<div class="cover-review-linkrow">
								<a href={item.localPath} target="_blank" rel="noreferrer">Open local page</a>
								{#if item.openLibraryUrl}
									<a href={item.openLibraryUrl} target="_blank" rel="noreferrer"
										>Open Library search</a
									>
								{/if}
							</div>

							<div class="admin-form-actions cover-review-actions">
								{#if item.candidateImageUrl}
									<button
										class="admin-button"
										type="button"
										onclick={() => reviewCover(item.sourceUri, 'approve')}
										disabled={isReviewActionRunning(item.sourceUri)}
									>
										{#if reviewPending[item.sourceUri] === 'approve'}
											Approving…
										{:else}
											Approve candidate
										{/if}
									</button>
								{/if}

								<button
									class="admin-button review-action-secondary"
									type="button"
									onclick={() => reviewCover(item.sourceUri, 'hide')}
									disabled={isReviewActionRunning(item.sourceUri)}
								>
									{#if reviewPending[item.sourceUri] === 'hide'}
										Hiding…
									{:else}
										Hide image
									{/if}
								</button>
							</div>
						</div>
					</article>
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

	.review-action-secondary {
		background: rgba(255, 255, 255, 0.04);
		color: rgba(239, 240, 244, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.cover-review-list {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	.cover-review-card {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.cover-review-images {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.cover-review-figure {
		display: grid;
		gap: 0.45rem;
	}

	.cover-review-image {
		inline-size: 100%;
		aspect-ratio: 2 / 3;
		border-radius: 0.8rem;
		object-fit: cover;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.cover-review-image--empty {
		display: grid;
		place-items: center;
		padding: 0.85rem;
		color: rgba(239, 240, 244, 0.62);
		font-size: 0.85rem;
		text-align: center;
	}

	.cover-review-title {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.2;
	}

	.cover-review-title a {
		color: inherit;
		text-decoration: none;
	}

	.cover-review-title a:hover {
		text-decoration: underline;
	}

	.cover-review-meta {
		margin: 0.35rem 0 0;
		color: rgba(239, 240, 244, 0.78);
	}

	.cover-review-details {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.9rem;
	}

	.cover-review-caption {
		margin: 0;
		color: rgba(239, 240, 244, 0.62);
		font-size: 0.82rem;
	}

	.cover-review-linkrow {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin-top: 0.9rem;
	}

	.cover-review-linkrow a {
		color: rgba(239, 240, 244, 0.92);
		font-size: 0.92rem;
	}

	.cover-review-actions {
		margin-top: 1rem;
	}

	@media (min-width: 760px) {
		.cover-review-card {
			grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
			align-items: start;
		}

		.cover-review-images {
			grid-template-columns: 1fr;
		}
	}
</style>
