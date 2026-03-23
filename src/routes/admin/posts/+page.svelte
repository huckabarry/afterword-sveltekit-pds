<script lang="ts">
	let { data } = $props();

	function formatDate(value: string | Date) {
		return new Date(value).toLocaleString();
	}
</script>

<section class="admin-panel">
	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Outbox</p>
				<h2>Local ActivityPub posts</h2>
			</div>
			<a href="/admin/compose">New note</a>
		</div>

		{#if data.deleted}
			<p class="admin-form-success">Post deleted.</p>
		{/if}

		{#if data.saved}
			<p class="admin-form-success">Post updated.</p>
		{/if}

		{#if data.posts.length}
			<ul class="admin-thread-list">
				{#each data.posts as post}
					<li class="admin-thread">
						<div class="admin-thread__meta">
							<strong>{post.inReplyToObjectId ? 'Reply' : 'Note'}</strong>
							<span>{formatDate(post.publishedAt)}</span>
							<span>{post.deliveryStatus || 'pending'}</span>
						</div>
						<p class="admin-thread__content">{post.contentText}</p>
						<div class="admin-thread__actions">
							<a class="admin-pill-link" href={`/admin/posts/${post.localSlug}`}>Open</a>
							{#if post.incomingReplyCount}
								<span class="admin-reply-count">{post.incomingReplyCount} replies</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No local ActivityPub posts yet.</p>
		{/if}
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Mirrored lane</p>
				<h2>Mirrored Bluesky posts</h2>
			</div>
		</div>

		{#if data.mirroredStatuses.length}
			<ul class="admin-thread-list">
				{#each data.mirroredStatuses as post}
					<li class="admin-thread">
						<div class="admin-thread__meta">
							<strong>Mirrored status</strong>
							<span>{formatDate(post.date)}</span>
							<span>{post.replyCount} replies</span>
						</div>
						<p class="admin-thread__content">{post.text}</p>
						<div class="admin-thread__actions">
							<a class="admin-pill-link" href={`/status/${post.slug}`}>Open post</a>
							<a class="admin-pill-link" href={`/admin/compose?replyTo=${encodeURIComponent(post.apObjectId)}`}>Reply on AP</a>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No mirrored Bluesky posts available right now.</p>
		{/if}
	</div>
</section>
