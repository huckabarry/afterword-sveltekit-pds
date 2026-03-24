<script lang="ts">
	let { data, form } = $props();

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Following</p>
				<h2>People and places you follow</h2>
			</div>
		</div>

		<form method="POST" action="?/follow" class="admin-inline-reply__form">
			<label class="admin-field">
				<span>Follow actor URL</span>
				<input
					name="actor"
					type="url"
					placeholder="https://example.social/users/name"
					autocomplete="url"
				/>
			</label>
			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Follow</button>
			</div>
		</form>

		{#if form?.error}
			<p class="form-error">{form.error}</p>
		{/if}

		{#if data.followed}
			<p class="admin-form-success">Follow request sent.</p>
		{/if}

		{#if data.unfollowed}
			<p class="admin-form-success">Unfollowed.</p>
		{/if}

		{#if data.following.length}
			<ul class="admin-social-list">
				{#each data.following as account}
					<li class="admin-social-card">
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>{account.displayName || account.handle || account.actorId}</strong>
								{#if account.handle}
									<span>@{account.handle}</span>
								{/if}
							</div>
							<p class="admin-social-card__content">{account.actorId}</p>
							<div class="admin-thread__actions admin-thread__actions--social">
								{#if account.profileUrl}
									<a class="admin-pill-link" href={account.profileUrl} target="_blank" rel="noreferrer">Open profile</a>
								{/if}
								<form method="POST" action="?/unfollow">
									<input type="hidden" name="actorId" value={account.actorId} />
									<button class="admin-pill-link" type="submit">Unfollow</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">You are not following anyone yet.</p>
		{/if}
	</div>

	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Feed</p>
				<h2>Followed posts</h2>
			</div>
		</div>

		{#if data.liked}
			<p class="admin-form-success">Like sent.</p>
		{/if}

		{#if data.boosted}
			<p class="admin-form-success">Boost sent.</p>
		{/if}

		{#if data.replied}
			<p class="admin-form-success">Reply published.</p>
		{/if}

		{#if data.statuses.length}
			<ul class="admin-social-list">
				{#each data.statuses as status}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							{#if status.actorUrl}
								<a href={status.actorUrl} target="_blank" rel="noreferrer">
									<img
										class="admin-social-card__avatar"
										src={status.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
										alt={status.actorName || status.actorHandle || 'Avatar'}
									/>
								</a>
							{:else}
								<img
									class="admin-social-card__avatar"
									src={status.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
									alt={status.actorName || status.actorHandle || 'Avatar'}
								/>
							{/if}
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
								<form method="POST" action="?/like">
									<input type="hidden" name="objectId" value={status.objectId} />
									<button class="admin-pill-link" type="submit">
										{status.favourited ? 'Liked' : 'Like'}
									</button>
								</form>
								<form method="POST" action="?/boost">
									<input type="hidden" name="objectId" value={status.objectId} />
									<button class="admin-pill-link" type="submit">
										{status.reblogged ? 'Boosted' : 'Boost'}
									</button>
								</form>
								<a class="admin-pill-link" href={status.objectUrl || status.objectId} target="_blank" rel="noreferrer">Open post</a>
							</div>

							<details class="admin-inline-reply">
								<summary class="admin-pill-link">Reply inline</summary>
								<form method="POST" action="?/reply" class="admin-inline-reply__form">
									<input type="hidden" name="replyTo" value={status.objectId} />
									<label class="admin-field">
										<span>Reply</span>
										<textarea
											name="content"
											rows="4"
											placeholder="Write a reply..."
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
			<p class="admin-empty">Follow some people and their new posts will show up here.</p>
		{/if}
	</div>
</section>
