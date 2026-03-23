<script lang="ts">
	let { data } = $props();
</script>

<section class="admin-panel">
	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Moderation</p>
				<h2>Webmentions</h2>
			</div>
		</div>

		{#if data.webmentions.length}
			<ul class="admin-thread-list">
				{#each data.webmentions as mention}
					<li class="admin-thread">
						<div class="admin-thread__meta">
							<strong>{mention.sourceTitle || mention.sourceDomain || mention.sourceUrl}</strong>
							<span>{mention.status}</span>
						</div>
						<p class="admin-thread__target">Target: {mention.targetUrl}</p>
						<div class="admin-thread__actions">
							<form method="POST" action="?/update">
								<input type="hidden" name="id" value={mention.id} />
								<input type="hidden" name="status" value="verified" />
								<button class="admin-pill-link" type="submit">Verify</button>
							</form>
							<form method="POST" action="?/update">
								<input type="hidden" name="id" value={mention.id} />
								<input type="hidden" name="status" value="spam" />
								<button class="admin-pill-link" type="submit">Spam</button>
							</form>
							<form method="POST" action="?/delete">
								<input type="hidden" name="id" value={mention.id} />
								<button class="admin-pill-link" type="submit">Delete</button>
							</form>
							<a class="admin-pill-link" href={mention.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No webmentions to moderate.</p>
		{/if}
	</div>
</section>
