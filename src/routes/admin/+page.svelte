<script lang="ts">
	let { data } = $props();
</script>

<section class="admin-panel">
	<div class="admin-panel__hero">
		<div>
			<p class="admin-eyebrow">Back room</p>
			<h2 class="admin-panel__title">A quieter way to run the social side of the site.</h2>
		</div>

		<div class="admin-summary-grid">
			<div class="admin-stat">
				<span class="admin-stat__value">{data.replies.length}</span>
				<span class="admin-stat__label">Recent AP replies</span>
			</div>
			<div class="admin-stat">
				<span class="admin-stat__value">{data.followers.length}</span>
				<span class="admin-stat__label">Followers</span>
			</div>
			<div class="admin-stat">
				<span class="admin-stat__value">{data.webmentions.length}</span>
				<span class="admin-stat__label">Recent webmentions</span>
			</div>
		</div>
	</div>

	<div class="admin-grid">
		<section class="admin-card">
			<div class="admin-card__head">
				<h3>Recent replies</h3>
				<a href="/admin/replies">View all</a>
			</div>

			{#if data.replies.length}
				<ul class="admin-list">
					{#each data.replies as reply}
						<li class="admin-list-item">
							<div>
								<p class="admin-list-item__title">
									{reply.actorName || reply.actorHandle || reply.actorId}
								</p>
								<p class="admin-list-item__meta">{reply.contentText}</p>
							</div>
							<a class="admin-pill-link" href={`/admin/compose?replyTo=${encodeURIComponent(reply.noteId)}`}>Reply</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="admin-empty">No incoming ActivityPub replies yet.</p>
			{/if}
		</section>

		<section class="admin-card">
			<div class="admin-card__head">
				<h3>Recent webmentions</h3>
				<a href="/admin/webmentions">Moderate</a>
			</div>

			{#if data.webmentions.length}
				<ul class="admin-list">
					{#each data.webmentions as mention}
						<li class="admin-list-item">
							<div>
								<p class="admin-list-item__title">
									{mention.sourceTitle || mention.sourceDomain || mention.sourceUrl}
								</p>
								<p class="admin-list-item__meta">{mention.status} / {mention.targetUrl}</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="admin-empty">No webmentions yet.</p>
			{/if}
		</section>
	</div>
</section>
