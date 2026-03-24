<script lang="ts">
	let { data, form } = $props();
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Following</p>
				<h2>People and places you follow</h2>
			</div>
			<a href="/admin/following">Open feed</a>
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
									<button class="admin-pill-link" type="submit">Following</button>
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
</section>
