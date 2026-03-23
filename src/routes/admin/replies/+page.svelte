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
							<a class="admin-pill-link" href={`/admin/compose?replyTo=${encodeURIComponent(reply.noteId)}`}>Reply to this</a>
							<a class="admin-pill-link" href={reply.noteId} target="_blank" rel="noreferrer">Open object</a>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No ActivityPub replies have arrived yet.</p>
		{/if}
	</div>
</section>
