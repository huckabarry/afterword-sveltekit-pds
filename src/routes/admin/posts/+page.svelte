<script lang="ts">
	let { data } = $props();

	function formatDate(value: string | Date) {
		return new Date(value).toLocaleString();
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-feed-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Status stream</p>
				<h2>Recent Bluesky posts</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This is a lightweight view of the Bluesky posts showing up on your public status pages.
		</p>

		{#if data.posts.length}
			<ul class="admin-social-list">
				{#each data.posts as post}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							<img
								class="admin-social-card__avatar"
								src={post.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
								alt={post.actorName || 'Avatar'}
							/>
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>{post.actorName}</strong>
								<span>{post.actorHandle}</span>
								<span>{formatDate(post.publishedAt)}</span>
								<a
									class="admin-source-icon"
									href={post.sourceHref}
									target="_blank"
									rel="noreferrer"
									aria-label="Open on Bluesky"
									title="Open on Bluesky"
								>
									<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
										<path d="M5.69 4.78c2.35 1.76 4.88 5.33 5.81 7.27.93-1.94 3.46-5.51 5.81-7.27 1.69-1.27 4.43-2.26 4.43.87 0 .63-.36 5.29-.57 6.05-.72 2.66-3.35 3.34-5.69 2.94 4.09.7 5.13 3.04 2.88 5.39-4.27 4.46-6.14-1.12-6.62-2.55-.09-.26-.13-.38-.24-.38s-.15.12-.24.38c-.48 1.43-2.35 7.01-6.62 2.55-2.25-2.35-1.21-4.69 2.88-5.39-2.34.4-4.97-.28-5.69-2.94-.21-.76-.57-5.42-.57-6.05 0-3.13 2.74-2.14 4.43-.87Z"></path>
									</svg>
								</a>
							</div>
							<p class="admin-social-card__content">{post.contentText}</p>

							{#if post.attachments?.length}
								<div class="admin-social-card__media-strip">
									{#each post.attachments as attachment}
										<img src={attachment.url} alt={attachment.alt || 'Post image'} loading="lazy" />
									{/each}
								</div>
							{/if}

							<div class="admin-thread__actions admin-thread__actions--social">
								<a class="admin-pill-link" href={post.openHref}>Open on site</a>
								<a class="admin-pill-link" href={post.sourceHref} target="_blank" rel="noreferrer">
									Open on Bluesky
								</a>
								<span class="admin-reply-count">
									{post.replyCount} repl{post.replyCount === 1 ? 'y' : 'ies'} · {post.repostCount} repost{post.repostCount === 1 ? '' : 's'} · {post.likeCount} like{post.likeCount === 1 ? '' : 's'}
								</span>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No recent Bluesky posts were found.</p>
		{/if}
	</div>
</section>
