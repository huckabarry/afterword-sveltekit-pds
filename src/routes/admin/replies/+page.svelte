<script lang="ts">
	let { data } = $props();
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
			<ul class="admin-thread-list">
				{#each data.replies as reply}
					<li class="admin-thread">
						<div class="admin-thread__meta">
							<strong>{reply.actorName || reply.actorHandle || reply.actorId}</strong>
							<span>{new Date(reply.publishedAt).toLocaleString()}</span>
						</div>
						<p class="admin-thread__content">{reply.contentText}</p>
						<p class="admin-thread__target">In reply to: {reply.inReplyToObjectId}</p>
						<div class="admin-thread__actions">
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
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No ActivityPub replies have arrived yet.</p>
		{/if}
	</div>
</section>
