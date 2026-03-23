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
								<strong>{post.actorName || (post.inReplyToObjectId ? 'Reply' : 'Note')}</strong>
								{#if post.actorHandle}
									<span>{post.actorHandle}</span>
								{/if}
								<span>{formatDate(post.publishedAt)}</span>
								<span>{post.deliveryStatus || 'pending'}</span>
							</div>
							<p class="admin-social-card__content">{post.contentText}</p>
							{#if post.attachments?.length}
								<div class="admin-social-card__media-strip">
									{#each post.attachments as attachment}
										<img src={attachment.url} alt={attachment.alt || 'Post image'} loading="lazy" />
									{/each}
								</div>
							{/if}
							{#if post.inReplyToObjectId}
								<p class="admin-thread__target">Replying to: {post.inReplyToObjectId}</p>
							{/if}
							<div class="admin-thread__actions admin-thread__actions--social">
								<a class="admin-pill-link" href={`/admin/posts/${post.localSlug}`}>Open</a>
								{#if post.incomingReplyCount}
									<span class="admin-reply-count">{post.incomingReplyCount} replies</span>
								{/if}
							</div>
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
			<ul class="admin-social-list">
				{#each data.mirroredStatuses as post}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							<img
								class="admin-social-card__avatar"
								src={post.avatar || '/assets/images/status-avatar.jpg'}
								alt={post.displayName || 'Avatar'}
							/>
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>{post.displayName}</strong>
								<span>{post.handle}</span>
								<span>{formatDate(post.date)}</span>
							</div>
							<p class="admin-social-card__content">{post.text}</p>
							{#if post.images?.length}
								<div class="admin-social-card__media-strip">
									{#each post.images as image}
										<img src={image.thumb || image.fullsize} alt={image.alt || 'Status image'} loading="lazy" />
									{/each}
								</div>
							{/if}
							<div class="admin-social-card__metrics">
								<span>{post.replyCount} replies</span>
								<span>{post.repostCount} reposts</span>
								<span>{post.likeCount} likes</span>
							</div>
							<div class="admin-thread__actions admin-thread__actions--social">
								<a class="admin-pill-link" href={`/status/${post.slug}`}>Open post</a>
								<a class="admin-pill-link" href={`/admin/compose?replyTo=${encodeURIComponent(post.apObjectId)}`}>Reply on AP</a>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No mirrored Bluesky posts available right now.</p>
		{/if}
	</div>
</section>
