<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
	let messages = $state(data.messages);
	let flash = $state({
		followed: data.followed,
		unfollowed: data.unfollowed
	});

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}

	function updateFollowState(actorId: string, isFollowing: boolean) {
		messages = messages.map((message) =>
			message.actorId === actorId ? { ...message, isFollowing } : message
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
</script>

<section class="admin-panel">
	<div class="admin-card admin-feed-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Messages</p>
				<h2>Direct ActivityPub messages</h2>
			</div>
			<p class="admin-field-note">Non-public notes addressed directly to your local actor land here.</p>
		</div>

		{#if flash.followed}
			<p class="admin-form-success">Follow request sent.</p>
		{/if}

		{#if flash.unfollowed}
			<p class="admin-form-success">Unfollowed.</p>
		{/if}

		{#if data.sent}
			<p class="admin-form-success">Direct message sent.</p>
		{/if}

		{#if messages.length}
			<ul class="admin-social-list">
				{#each messages as message}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							{#if message.actorId}
								<a href={`/admin/people?actor=${encodeURIComponent(message.actorId)}`}>
									<img
										class="admin-social-card__avatar"
										src={message.avatarUrl || '/assets/images/status-avatar.jpg'}
										alt={message.actorName || message.actorHandle || 'Avatar'}
									/>
								</a>
							{:else}
								<img
									class="admin-social-card__avatar"
									src={message.avatarUrl || '/assets/images/status-avatar.jpg'}
									alt={message.actorName || message.actorHandle || 'Avatar'}
								/>
							{/if}
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>
									<a href={`/admin/people?actor=${encodeURIComponent(message.actorId)}`}>
										{message.actorName || message.actorHandle || message.actorId}
									</a>
								</strong>
								{#if message.actorHandle && message.actorHandle !== message.actorName}
									<span>{message.actorHandle}</span>
								{/if}
								{#if message.origin !== 'local'}
									<form method="POST" action={message.isFollowing ? '?/unfollow' : '?/follow'} use:enhance={enhanceFollow(message.isFollowing)}>
										<input type="hidden" name="actorId" value={message.actorId} />
										<button class="admin-pill-link" type="submit">
											{message.isFollowing ? 'Following' : 'Follow'}
										</button>
									</form>
								{/if}
								<span>{formatDate(message.publishedAt)}</span>
								<span class="admin-post-status">direct</span>
							</div>

							{#if message.contentText}
								<p class="admin-social-card__content">{message.contentText}</p>
							{:else if message.contentHtml}
								<div class="admin-social-card__content">
									{@html message.contentHtml}
								</div>
							{/if}

							{#if message.attachments?.length}
								<div class="admin-social-card__media-strip">
									{#each message.attachments as attachment}
										<img src={attachment.url} alt={attachment.alt || 'Message image'} loading="lazy" />
									{/each}
								</div>
							{/if}

							<div class="admin-thread__actions admin-thread__actions--social">
								{#if message.actorId}
									<a
										class="admin-pill-link"
										href={`/admin?visibility=direct&directTo=${encodeURIComponent(message.actorId)}&directLabel=${encodeURIComponent(message.actorName || message.actorHandle || message.actorId)}`}
									>
										Message back
									</a>
								{/if}
								<a class="admin-pill-link" href={message.noteId} target="_blank" rel="noreferrer">Open object</a>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No direct ActivityPub messages have arrived yet.</p>
		{/if}
	</div>
</section>
