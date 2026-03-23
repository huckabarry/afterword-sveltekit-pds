<script lang="ts">
	let { data } = $props();

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}
</script>

<section class="admin-panel">
	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Replies</p>
				<h2>Incoming ActivityPub replies</h2>
			</div>
			<a href="/admin/compose">New note</a>
		</div>

		{#if data.sent}
			<p class="admin-form-success">Reply published.</p>
		{/if}

		{#if data.liked}
			<p class="admin-form-success">Like sent.</p>
		{/if}

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

							{#if reply.attachments?.length}
								<div class="admin-social-card__media-strip">
									{#each reply.attachments as attachment}
										<img src={attachment.url} alt={attachment.alt || 'Reply image'} loading="lazy" />
									{/each}
								</div>
							{/if}

							{#if reply.replyContext}
								<div class="admin-thread__context">
									<p class="admin-thread__context-label">In reply to</p>
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
							{:else}
								<p class="admin-thread__target">In reply to: {reply.inReplyToObjectId}</p>
							{/if}

							<div class="admin-thread__actions admin-thread__actions--social">
								<form method="POST" action="?/like">
									<input type="hidden" name="objectId" value={reply.noteId} />
									<button class="admin-pill-link" type="submit">Like</button>
								</form>
								<a class="admin-pill-link" href={reply.noteId} target="_blank" rel="noreferrer">Open object</a>
							</div>

							<details class="admin-inline-reply">
								<summary class="admin-pill-link">Reply inline</summary>

								<form method="POST" action="?/reply" class="admin-inline-reply__form">
									<input type="hidden" name="replyTo" value={reply.noteId} />
									<label class="admin-field">
										<span>Reply</span>
										<textarea
											name="content"
											rows="4"
											placeholder="Write an ActivityPub reply..."
										></textarea>
									</label>
									<div class="admin-form-actions">
										<button class="admin-button" type="submit">Send reply</button>
									</div>
								</form>
							</details>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No ActivityPub replies have arrived yet.</p>
		{/if}
	</div>
</section>
