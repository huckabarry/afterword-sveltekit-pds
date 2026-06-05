<script lang="ts">
	import type { AdminPostFeedItem } from '$lib/server/admin-posts';

	let { data, form } = $props();

	function formatDate(value: string | Date) {
		return new Date(value).toLocaleString();
	}

	function formatCount(value: number, singular: string, plural = `${singular}s`) {
		return `${value} ${value === 1 ? singular : plural}`;
	}

	function excerpt(text: string, maxLength = 110) {
		const compact = text.replace(/\s+/g, ' ').trim();
		if (!compact) return '(No text)';
		return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
	}

	let selectedUri = $state<string | null>(null);

	const selectedPost = $derived(
		(data.posts.find((post: AdminPostFeedItem) => post.uri === selectedUri) ?? data.posts[0]) || null
	);

	$effect(() => {
		if (form?.selectedUri) {
			selectedUri = form.selectedUri;
			return;
		}

		if (!data.posts.length) {
			selectedUri = null;
			return;
		}

		if (!selectedUri || !data.posts.some((post: AdminPostFeedItem) => post.uri === selectedUri)) {
			selectedUri = data.posts[0].uri;
		}
	});
</script>

<section class="admin-panel admin-posts-panel">
	<div class="admin-card admin-posts-shell">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Status stream</p>
				<h2>Recent Bluesky posts</h2>
			</div>
		</div>

		<p class="admin-field-note admin-posts-shell__note">
			Choose a post from the left, review how it reads, then edit or remove it without dragging a
			full social-card feed down the whole page.
		</p>

		{#if form?.message}
			<p class:admin-status--error={form?.ok === false} class="admin-status admin-posts-status">
				{form.message}
			</p>
		{/if}

		{#if data.posts.length && selectedPost}
			<div class="admin-posts-layout">
				<div class="admin-posts-browser">
					<div class="admin-posts-browser__header">
						<p>{data.posts.length} recent post{data.posts.length === 1 ? '' : 's'}</p>
					</div>

					<ul class="admin-posts-list">
						{#each data.posts as post}
							<li>
								<button
									class:admin-posts-list__item--active={selectedPost.uri === post.uri}
									class="admin-posts-list__item"
									type="button"
									aria-pressed={selectedPost.uri === post.uri}
									onclick={() => {
										selectedUri = post.uri;
									}}
								>
									<div class="admin-posts-list__meta">
										<strong>{formatDate(post.publishedAt)}</strong>
										<span>@{post.actorHandle}</span>
									</div>
									<p class="admin-posts-list__excerpt">{excerpt(post.contentText)}</p>
									<div class="admin-posts-list__counts">
										<span>{formatCount(post.replyCount, 'reply')}</span>
										<span>{formatCount(post.repostCount, 'repost')}</span>
										<span>{formatCount(post.likeCount, 'like')}</span>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				</div>

				<div class="admin-posts-detail">
					<div class="admin-posts-detail__preview">
						<div class="admin-social-card admin-social-card--detail">
							<div class="admin-social-card__avatar-wrap">
								<img
									class="admin-social-card__avatar"
									src={selectedPost.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
									alt={selectedPost.actorName || 'Avatar'}
								/>
							</div>
							<div class="admin-social-card__body">
								<div class="admin-social-card__meta">
									<strong>{selectedPost.actorName}</strong>
									<span>@{selectedPost.actorHandle}</span>
									<span>{formatDate(selectedPost.publishedAt)}</span>
								</div>

								<p class="admin-social-card__content">{selectedPost.contentText}</p>

								{#if selectedPost.attachments?.length}
									<div class="admin-social-card__media-strip admin-social-card__media-strip--detail">
										{#each selectedPost.attachments as attachment}
											<img src={attachment.url} alt={attachment.alt || 'Post image'} loading="lazy" />
										{/each}
									</div>
								{/if}

								<div class="admin-thread__actions admin-thread__actions--social">
									<a class="admin-pill-link" href={selectedPost.openHref}>Open on site</a>
									<a
										class="admin-pill-link"
										href={selectedPost.sourceHref}
										target="_blank"
										rel="noreferrer"
									>
										Open on Bluesky
									</a>
								</div>

								<dl class="admin-posts-metrics">
									<div>
										<dt>Replies</dt>
										<dd>{selectedPost.replyCount}</dd>
									</div>
									<div>
										<dt>Reposts</dt>
										<dd>{selectedPost.repostCount}</dd>
									</div>
									<div>
										<dt>Quotes</dt>
										<dd>{selectedPost.quoteCount}</dd>
									</div>
									<div>
										<dt>Likes</dt>
										<dd>{selectedPost.likeCount}</dd>
									</div>
								</dl>
							</div>
						</div>
					</div>

					<div class="admin-card admin-posts-editor-card">
						<div class="admin-card__head">
							<div>
								<p class="admin-eyebrow">Editing</p>
								<h2>Edit selected post</h2>
							</div>
						</div>

						<form class="admin-status-editor" method="POST" action="?/update">
							<input type="hidden" name="uri" value={selectedPost.uri} />
							<label class="admin-status-editor__label" for={`status-${selectedPost.slug}`}>
								Post text
							</label>
							<textarea
								id={`status-${selectedPost.slug}`}
								class="admin-status-editor__textarea"
								name="text"
								rows="7"
							>{selectedPost.contentText}</textarea>
							<p class="admin-status-editor__note">
								Editing clears old Bluesky link and mention facets, so treat this as a plain-text
								cleanup lane.
							</p>
							<div class="admin-status-editor__actions">
								<button class="admin-pill-link admin-pill-link--button" type="submit">
									Save changes
								</button>
							</div>
						</form>

						<form class="admin-status-delete" method="POST" action="?/delete">
							<input type="hidden" name="uri" value={selectedPost.uri} />
							<button class="admin-pill-link admin-pill-link--danger" type="submit">
								Delete post
							</button>
						</form>
					</div>
				</div>
			</div>
		{:else}
			<p class="admin-empty">No recent Bluesky posts were found.</p>
		{/if}
	</div>
</section>

<style>
	.admin-posts-panel {
		display: grid;
	}

	.admin-posts-shell {
		display: grid;
		gap: 1rem;
	}

	.admin-posts-shell__note {
		max-width: 52rem;
	}

	.admin-posts-status {
		margin: 0;
	}

	.admin-posts-layout {
		display: grid;
		grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
		gap: 1.15rem;
		align-items: start;
	}

	.admin-posts-browser {
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid color-mix(in srgb, var(--border) 88%, white 12%);
		background: color-mix(in srgb, var(--surface) 95%, white 5%);
	}

	.admin-posts-browser__header {
		padding-bottom: 0.75rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
	}

	.admin-posts-browser__header p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.admin-posts-list {
		display: grid;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.admin-posts-list__item {
		width: 100%;
		display: grid;
		gap: 0.5rem;
		padding: 0.95rem 1rem;
		border-radius: 0.95rem;
		border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
		background: color-mix(in srgb, var(--surface) 82%, black 18%);
		text-align: left;
		color: inherit;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			transform 160ms ease;
	}

	.admin-posts-list__item:hover {
		border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
		background: color-mix(in srgb, var(--accent) 7%, var(--surface));
		transform: translateY(-1px);
	}

	.admin-posts-list__item--active {
		border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
		background: color-mix(in srgb, var(--accent) 10%, var(--surface));
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.admin-posts-list__meta,
	.admin-posts-list__counts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.75rem;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.admin-posts-list__meta strong {
		color: var(--text);
		font-size: 0.88rem;
	}

	.admin-posts-list__excerpt {
		margin: 0;
		color: var(--text);
		line-height: 1.5;
	}

	.admin-posts-detail {
		display: grid;
		gap: 1rem;
	}

	.admin-posts-detail__preview {
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid color-mix(in srgb, var(--border) 88%, white 12%);
		background: color-mix(in srgb, var(--surface) 96%, white 4%);
	}

	.admin-social-card--detail {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 1rem;
	}

	.admin-social-card__avatar-wrap {
		align-self: start;
	}

	.admin-social-card__avatar {
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		object-fit: cover;
	}

	.admin-social-card__body {
		display: grid;
		gap: 0.85rem;
		min-width: 0;
	}

	.admin-social-card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.7rem;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.admin-social-card__meta strong {
		color: var(--text);
	}

	.admin-social-card__content {
		margin: 0;
		color: var(--text);
		line-height: 1.65;
		white-space: pre-wrap;
	}

	.admin-social-card__media-strip {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.7rem;
	}

	.admin-social-card__media-strip img {
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 0.9rem;
	}

	.admin-posts-metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 0;
	}

	.admin-posts-metrics div {
		display: grid;
		gap: 0.2rem;
		padding: 0.8rem 0.9rem;
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--surface) 82%, black 18%);
		border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
	}

	.admin-posts-metrics dt {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.admin-posts-metrics dd {
		margin: 0;
		color: var(--text);
		font-size: 1.05rem;
		font-weight: 700;
	}

	.admin-posts-editor-card {
		display: grid;
		gap: 1rem;
	}

	.admin-status-editor {
		display: grid;
		gap: 0.55rem;
	}

	.admin-status-editor__label {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.admin-status-editor__textarea {
		width: 100%;
		min-height: 8.5rem;
		padding: 0.85rem 0.95rem;
		border-radius: 0.95rem;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface) 82%, black 18%);
		color: var(--text);
		font: inherit;
		line-height: 1.55;
		resize: vertical;
	}

	.admin-status-editor__note {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
		line-height: 1.45;
	}

	.admin-status-editor__actions,
	.admin-status-delete {
		display: flex;
		justify-content: flex-start;
		margin-top: 0.1rem;
	}

	.admin-pill-link--button {
		cursor: pointer;
		border: 0;
	}

	.admin-pill-link--danger {
		cursor: pointer;
		border-color: color-mix(in srgb, #d36b6b 45%, var(--border));
		color: #f1c2c2;
		background: color-mix(in srgb, #d36b6b 10%, transparent);
	}

	@media (max-width: 980px) {
		.admin-posts-layout {
			grid-template-columns: 1fr;
		}

		.admin-posts-browser {
			padding: 0.9rem;
		}
	}

	@media (max-width: 700px) {
		.admin-social-card--detail {
			grid-template-columns: 1fr;
		}

		.admin-posts-metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
