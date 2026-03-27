<script lang="ts">
	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}

	let { data } = $props();
</script>

<section class="admin-panel">
	<div class="admin-card admin-feed-card">
		<div class="admin-profile-card">
			{#if data.actor.headerUrl}
				<div class="admin-profile-card__header">
					<img src={data.actor.headerUrl} alt="" />
				</div>
			{/if}

			<div class="admin-profile-card__body">
				<img
					class="admin-profile-card__avatar"
					src={data.actor.avatarUrl || '/assets/images/status-avatar.jpg'}
					alt={data.actor.name || data.actor.handle || 'Avatar'}
				/>
				<div class="admin-profile-card__meta">
					<h2>{data.actor.name}</h2>
					{#if data.actor.handle}
						<p>@{data.actor.handle}</p>
					{/if}
					{#if data.actor.summary}
						<p class="admin-profile-card__summary">{data.actor.summary}</p>
					{/if}
					<div class="admin-thread__actions admin-thread__actions--social">
						<form method="POST" action={data.actor.isFollowing ? '?/unfollow' : '?/follow'}>
							<input type="hidden" name="actorId" value={data.actorId} />
							<button class="admin-pill-link" type="submit">
								{data.actor.isFollowing ? 'Following' : 'Follow'}
							</button>
						</form>
						<a
							class="admin-pill-link"
							href={`/admin?visibility=direct&directTo=${encodeURIComponent(data.actorId)}&directLabel=${encodeURIComponent(data.actor.name || data.actor.handle || data.actorId)}`}
						>
							Message
						</a>
						<form method="POST" action="?/refresh">
							<input type="hidden" name="actorId" value={data.actorId} />
							<button class="admin-pill-link" type="submit">Refresh posts</button>
						</form>
						<a class="admin-pill-link" href={data.actor.profileUrl} target="_blank" rel="noreferrer">Open external</a>
					</div>
				</div>
			</div>
		</div>

		{#if data.statuses.length}
			<ul class="admin-social-list">
				{#each data.statuses as status}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							<img
								class="admin-social-card__avatar"
								src={status.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
								alt={status.actorName || status.actorHandle || 'Avatar'}
							/>
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>{status.actorName || status.actorHandle || status.actorId}</strong>
								{#if status.actorHandle}
									<span>@{status.actorHandle}</span>
								{/if}
								<span>{formatDate(status.publishedAt)}</span>
							</div>

							{#if status.contentText}
								<p class="admin-social-card__content">{status.contentText}</p>
							{:else if status.contentHtml}
								<div class="admin-social-card__content">
									{@html status.contentHtml}
								</div>
							{/if}

							{#if status.attachments?.length}
								<div class="admin-social-card__media-strip">
									{#each status.attachments as attachment}
										<img src={attachment.url} alt={attachment.alt || 'Post image'} loading="lazy" />
									{/each}
								</div>
							{/if}

							<div class="admin-thread__actions admin-thread__actions--social">
								<a class="admin-pill-link" href={status.objectUrl || status.objectId} target="_blank" rel="noreferrer">Open post</a>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No cached posts yet for this account.</p>
		{/if}
	</div>
</section>
