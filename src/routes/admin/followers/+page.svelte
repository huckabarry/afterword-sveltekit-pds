<script lang="ts">
	let { data } = $props();
</script>

<section class="admin-panel">
	<div class="admin-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Followers</p>
				<h2>Fediverse accounts following Afterword</h2>
			</div>
		</div>

		{#if data.followers.length}
			<ul class="admin-thread-list">
				{#each data.followers as follower}
					<li class="admin-thread">
						<div class="admin-thread__meta">
							<strong>{follower.displayName || follower.handle || follower.actorId}</strong>
							{#if follower.handle}
								<span>{follower.handle}</span>
							{/if}
							<span>{follower.lastDeliveryStatus || 'no delivery yet'}</span>
						</div>
						<p class="admin-thread__content">{follower.actorId}</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">No followers stored yet.</p>
		{/if}
	</div>
</section>
