<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
	const initialReplies = data.replies;
	const initialFlash = {
		sent: data.sent,
		liked: data.liked,
		followed: data.followed,
		unfollowed: data.unfollowed
	};
	let replies = $state(initialReplies);
	let flash = $state({
		sent: initialFlash.sent,
		liked: initialFlash.liked,
		followed: initialFlash.followed,
		unfollowed: initialFlash.unfollowed
	});

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}

	function updateFollowState(actorId: string, isFollowing: boolean) {
		replies = replies.map((reply) =>
			reply.actorId === actorId ? { ...reply, isFollowing } : reply
		);
	}

	function enhanceFollow(isFollowing: boolean) {
		return ({ formData }: { formData: FormData }) => {
			const actorId = String(formData.get('actorId') || '');

			return async ({ result }: { result: { type: string } }) => {
				if (result.type !== 'success' || !actorId) return;
				updateFollowState(actorId, !isFollowing);
				flash.followed = !isFollowing;
				flash.unfollowed = isFollowing;
			};
		};
	}

	function enhanceLike() {
		return async ({ result }: { result: { type: string } }) => {
			if (result.type !== 'success') return;
			flash.liked = true;
		};
	}

	function enhanceReply() {
		return async ({ result, formElement }: { result: { type: string }; formElement: HTMLFormElement }) => {
			if (result.type !== 'success') return;
			flash.sent = true;
			formElement.reset();
			const details = formElement.closest('details');
			if (details) details.open = false;
		};
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-feed-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Replies</p>
				<h2>Incoming ActivityPub replies</h2>
			</div>
			<a href="/admin/compose">New note</a>
		</div>

		{#if flash.sent}
			<p class="admin-form-success">Reply published.</p>
		{/if}

		{#if flash.liked}
			<p class="admin-form-success">Like sent.</p>
		{/if}

		{#if flash.followed}
			<p class="admin-form-success">Follow request sent.</p>
		{/if}

		{#if flash.unfollowed}
			<p class="admin-form-success">Unfollowed.</p>
		{/if}

		{#if replies.length}
			<ul class="admin-social-list">
				{#each replies as reply}
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
								{#if reply.origin !== 'local'}
									<form method="POST" action={reply.isFollowing ? '?/unfollow' : '?/follow'} use:enhance={enhanceFollow(reply.isFollowing)}>
										<input type="hidden" name="actorId" value={reply.actorId} />
										<button class="admin-pill-link" type="submit">
											{reply.isFollowing ? 'Following' : 'Follow'}
										</button>
									</form>
								{/if}
								<span>{formatDate(reply.publishedAt)}</span>
							</div>
							{#if reply.contentText}
								<p class="admin-social-card__content">{reply.contentText}</p>
							{:else if reply.contentHtml}
								<div class="admin-social-card__content">
									{@html reply.contentHtml}
								</div>
							{/if}

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
							{/if}

							<div class="admin-thread__actions admin-thread__actions--social">
								<form method="POST" action="?/like" use:enhance={enhanceLike}>
									<input type="hidden" name="objectId" value={reply.noteId} />
									<button class="admin-pill-link" type="submit">Like</button>
								</form>
								<a class="admin-pill-link" href={reply.noteId} target="_blank" rel="noreferrer">Open object</a>
							</div>

							<details class="admin-inline-reply">
								<summary class="admin-pill-link">Reply inline</summary>

								<form method="POST" action="?/reply" class="admin-inline-reply__form" use:enhance={enhanceReply}>
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
