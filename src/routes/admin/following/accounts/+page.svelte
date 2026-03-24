<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const initialFollowing = data.following;
	const initialFlash = {
		followed: data.followed,
		unfollowed: data.unfollowed
	};
	let following = $state(initialFollowing);
	let flash = $state({
		followed: initialFlash.followed,
		unfollowed: initialFlash.unfollowed
	});

	function enhanceUnfollow() {
		return ({ formData }: { formData: FormData }) => {
			const actorId = String(formData.get('actorId') || '');

			return async ({ result }: { result: { type: string } }) => {
				if (result.type !== 'success' || !actorId) return;
				following = following.filter((account) => account.actorId !== actorId);
				flash.unfollowed = true;
			};
		};
	}
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

		{#if flash.followed}
			<p class="admin-form-success">Follow request sent.</p>
		{/if}

		{#if flash.unfollowed}
			<p class="admin-form-success">Unfollowed.</p>
		{/if}

		{#if following.length}
			<ul class="admin-social-list">
				{#each following as account}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							{#if account.actorId}
								<a href={`/admin/people?actor=${encodeURIComponent(account.actorId)}`}>
									<img
										class="admin-social-card__avatar"
										src={account.avatarUrl || '/assets/images/status-avatar.jpg'}
										alt={account.displayName || account.handle || 'Avatar'}
									/>
								</a>
							{:else}
								<img
									class="admin-social-card__avatar"
									src={account.avatarUrl || '/assets/images/status-avatar.jpg'}
									alt={account.displayName || account.handle || 'Avatar'}
								/>
							{/if}
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>
									<a href={`/admin/people?actor=${encodeURIComponent(account.actorId)}`}>
										{account.displayName || account.handle || account.actorId}
									</a>
								</strong>
								{#if account.handle}
									<span>@{account.handle}</span>
								{/if}
							</div>
							{#if account.summary}
								<p class="admin-social-card__content">{account.summary}</p>
							{/if}
							<p class="admin-social-card__content">{account.actorId}</p>
							<div class="admin-thread__actions admin-thread__actions--social">
								{#if account.profileUrl}
									<a class="admin-pill-link" href={account.profileUrl} target="_blank" rel="noreferrer">Open profile</a>
								{/if}
								<form method="POST" action="?/unfollow" use:enhance={enhanceUnfollow()}>
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
