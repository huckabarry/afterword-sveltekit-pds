<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
	const initialFollowers = data.followers;
	const initialFlash = {
		followed: data.followed,
		unfollowed: data.unfollowed
	};
	let followers = $state(initialFollowers);
	let flash = $state({
		followed: initialFlash.followed,
		unfollowed: initialFlash.unfollowed
	});

	function enhanceFollow(isFollowing: boolean) {
		return ({ formData }: { formData: FormData }) => {
			const actorId = String(formData.get('actorId') || '');

			return async ({ result }: { result: { type: string } }) => {
				if (result.type !== 'success' || !actorId) return;
				followers = followers.map((follower) =>
					follower.actorId === actorId ? { ...follower, isFollowing: !isFollowing } : follower
				);
				flash.followed = !isFollowing;
				flash.unfollowed = isFollowing;
			};
		};
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Followers</p>
				<h2>Fediverse accounts following Afterword</h2>
			</div>
		</div>

		{#if flash.followed}
			<p class="admin-form-success">Follow request sent.</p>
		{/if}

		{#if flash.unfollowed}
			<p class="admin-form-success">Unfollowed.</p>
		{/if}

		{#if followers.length}
			<ul class="admin-social-list">
				{#each followers as follower}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							{#if follower.profileUrl}
								<a href={follower.profileUrl} target="_blank" rel="noreferrer">
									<img
										class="admin-social-card__avatar"
										src={follower.avatarUrl || '/assets/images/status-avatar.jpg'}
										alt={follower.displayName || follower.handle || 'Avatar'}
									/>
								</a>
							{:else}
								<img
									class="admin-social-card__avatar"
									src={follower.avatarUrl || '/assets/images/status-avatar.jpg'}
									alt={follower.displayName || follower.handle || 'Avatar'}
								/>
							{/if}
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>{follower.displayName || follower.handle || follower.actorId}</strong>
								{#if follower.handle}
									<span>{follower.handle}</span>
								{/if}
								<span>{follower.lastDeliveryStatus || 'no delivery yet'}</span>
							</div>
							{#if follower.summary}
								<p class="admin-social-card__content">{follower.summary}</p>
							{/if}
							<p class="admin-social-card__content">{follower.actorId}</p>
							<div class="admin-thread__actions admin-thread__actions--social">
								{#if follower.profileUrl}
									<a class="admin-pill-link" href={follower.profileUrl} target="_blank" rel="noreferrer">Open profile</a>
								{/if}
								<form method="POST" action={follower.isFollowing ? '?/unfollow' : '?/follow'} use:enhance={enhanceFollow(follower.isFollowing)}>
									<input type="hidden" name="actorId" value={follower.actorId} />
									<button class="admin-pill-link" type="submit">
										{follower.isFollowing ? 'Following' : 'Follow'}
									</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No followers stored yet.</p>
		{/if}
	</div>
</section>
