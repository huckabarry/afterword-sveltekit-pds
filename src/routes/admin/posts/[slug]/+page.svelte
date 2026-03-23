<script lang="ts">
	let { data, form } = $props();

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}

	function getContentValue() {
		return form && 'content' in form ? form.content : data.post.contentText;
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Local post</p>
				<h2>{data.post.inReplyToObjectId ? 'Edit reply' : 'Edit note'}</h2>
			</div>
			<a href="/admin/posts">Back to posts</a>
		</div>

		<p class="admin-post-meta">
			Published {formatDate(data.post.publishedAt)} / status: {data.post.deliveryStatus || 'pending'}
		</p>

		{#if data.post.inReplyToObjectId}
			<p class="admin-thread__target">In reply to: {data.post.inReplyToObjectId}</p>
		{/if}

		<form method="POST" action="?/save" enctype="multipart/form-data" class="admin-compose-form">
			<label class="admin-field">
				<span>Content</span>
				<textarea name="content" rows="10">{getContentValue()}</textarea>
			</label>

			{#if data.post.attachments.length}
				<div class="admin-field">
					<span>Current photos</span>
					<div class="admin-attachment-grid">
						{#each data.post.attachments as attachment}
							<label class="admin-attachment-card">
								<img src={attachment.url} alt={attachment.alt || ''} />
								<span>
									<input type="checkbox" name="keepAttachment" value={attachment.url} checked />
									Keep photo
								</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			<label class="admin-field">
				<span>Add photos</span>
				<input name="images" type="file" accept="image/*" multiple />
			</label>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Save changes</button>
			</div>
		</form>

		<form method="POST" action="?/delete" class="admin-danger-zone">
			<button class="admin-danger-button" type="submit">Delete post</button>
		</form>
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Thread</p>
				<h3>Replies on this post</h3>
			</div>
		</div>

		{#if data.replies.length}
			<ul class="admin-thread-list">
				{#each data.replies as reply}
					<li class="admin-thread">
						<div class="admin-thread__meta">
							<strong>{reply.actorName || reply.actorHandle || reply.actorId}</strong>
							<span>{formatDate(reply.publishedAt)}</span>
						</div>
						<p class="admin-thread__content">{reply.contentText}</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No replies on this post yet.</p>
		{/if}
	</div>
</section>
