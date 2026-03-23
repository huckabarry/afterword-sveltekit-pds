<script lang="ts">
	let { data } = $props();

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}
</script>

<section class="admin-panel">
	<div class="admin-panel__hero">
		<div>
			<p class="admin-eyebrow">Back room</p>
			<h2 class="admin-panel__title">A quieter way to run the social side of the site.</h2>
		</div>

		<div class="admin-summary-grid">
			<div class="admin-stat">
				<span class="admin-stat__value">{data.replies.length}</span>
				<span class="admin-stat__label">Recent AP replies</span>
			</div>
			<div class="admin-stat">
				<span class="admin-stat__value">{data.followers.length}</span>
				<span class="admin-stat__label">Followers</span>
			</div>
			<div class="admin-stat">
				<span class="admin-stat__value">{data.webmentions.length}</span>
				<span class="admin-stat__label">Recent webmentions</span>
			</div>
			<div class="admin-stat">
				<span class="admin-stat__value">{data.mirroredStatuses.length}</span>
				<span class="admin-stat__label">Mirrored Bluesky posts</span>
			</div>
		</div>
	</div>

	<div class="admin-grid">
		<section class="admin-card">
			<div class="admin-card__head">
				<h3>Mirrored Bluesky posts</h3>
				<a href="/admin/posts">View all</a>
			</div>

			{#if data.mirroredStatuses.length}
				<ul class="admin-list">
					{#each data.mirroredStatuses as post}
						<li class="admin-list-item">
							<div>
								<p class="admin-list-item__title">{post.displayName || post.handle}</p>
								<p class="admin-list-item__meta">{post.text}</p>
							</div>
							<a class="admin-pill-link" href={`/admin/compose?replyTo=${encodeURIComponent(post.apObjectId)}`}>Reply on AP</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="admin-empty">No mirrored Bluesky posts available right now.</p>
			{/if}
		</section>

		<section class="admin-card">
			<div class="admin-card__head">
				<h3>Recent replies</h3>
				<a href="/admin/replies">View all</a>
			</div>

			{#if data.replies.length}
				<ul class="admin-social-list">
					{#each data.replies as reply}
						<li class="admin-social-card">
							<div class="admin-social-card__avatar-wrap">
								{#if reply.actorProfileUrl}
									<a href={reply.actorProfileUrl} target="_blank" rel="noreferrer">
										<img
											class="admin-social-card__avatar"
											src={reply.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
											alt={reply.actorName || reply.actorHandle || 'Avatar'}
										/>
									</a>
								{:else}
									<img
										class="admin-social-card__avatar"
										src={reply.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
										alt={reply.actorName || reply.actorHandle || 'Avatar'}
									/>
								{/if}
							</div>
							<div class="admin-social-card__body">
								<div class="admin-social-card__meta">
									<strong>{reply.actorName || reply.actorHandle || reply.actorId}</strong>
									{#if reply.actorHandle && reply.actorHandle !== reply.actorName}
										<span>{reply.actorHandle}</span>
									{/if}
									<span>{formatDate(reply.publishedAt)}</span>
								</div>
								<p class="admin-social-card__content">{reply.contentText}</p>

								{#if reply.threadRootContext}
									<div class="admin-thread__context">
										<p class="admin-thread__context-label">On post</p>
										<a
											class="admin-thread__context-card"
											href={reply.threadRootContext.url}
											target="_blank"
											rel="noreferrer"
										>
											{#if reply.threadRootContext.title}
												<strong>{reply.threadRootContext.title}</strong>
											{/if}
											{#if reply.threadRootContext.author}
												<span>{reply.threadRootContext.author}</span>
											{/if}
											<p>{reply.threadRootContext.excerpt}</p>
										</a>
									</div>
								{:else if reply.replyContext}
									<div class="admin-thread__context">
										<p class="admin-thread__context-label">On post</p>
										<a
											class="admin-thread__context-card"
											href={reply.replyContext.url}
											target="_blank"
											rel="noreferrer"
										>
											{#if reply.replyContext.title}
												<strong>{reply.replyContext.title}</strong>
											{/if}
											{#if reply.replyContext.author}
												<span>{reply.replyContext.author}</span>
											{/if}
											<p>{reply.replyContext.excerpt}</p>
										</a>
									</div>
								{/if}

								<div class="admin-thread__actions admin-thread__actions--social">
									<a class="admin-pill-link" href={`/admin/compose?replyTo=${encodeURIComponent(reply.noteId)}`}>Reply</a>
									<a class="admin-pill-link" href="/admin/replies">Open thread</a>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="admin-empty">No incoming ActivityPub replies yet.</p>
			{/if}
		</section>

		<section class="admin-card">
			<div class="admin-card__head">
				<h3>Recent webmentions</h3>
				<a href="/admin/webmentions">Moderate</a>
			</div>

			{#if data.webmentions.length}
				<ul class="admin-list">
					{#each data.webmentions as mention}
						<li class="admin-list-item">
							<div>
								<p class="admin-list-item__title">
									{mention.sourceTitle || mention.sourceDomain || mention.sourceUrl}
								</p>
								<p class="admin-list-item__meta">{mention.status} / {mention.targetUrl}</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="admin-empty">No webmentions yet.</p>
			{/if}
		</section>
	</div>
</section>
