<script lang="ts">
	let { data } = $props();
</script>

<section class="admin-panel admin-home">
	<div class="admin-summary-grid">
		<a class="admin-stat" href="/admin/photos">
			<span class="admin-stat__value">{data.stats.totalPhotos}</span>
			<span class="admin-stat__label">Gallery photos</span>
		</a>
		<a class="admin-stat" href="/admin/photos">
			<span class="admin-stat__value">{data.stats.syncedPhotos}</span>
			<span class="admin-stat__label">R2-backed images</span>
		</a>
		<a class="admin-stat" href="/admin/webmentions">
			<span class="admin-stat__value">{data.stats.webmentionCount}</span>
			<span class="admin-stat__label">Webmentions</span>
		</a>
	</div>

	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Workspace</p>
				<h2>What you can manage here</h2>
			</div>
		</div>

		<p class="admin-field-note">
			{data.profile.displayName}'s site is now focused on publishing, archives, and syndication. The
			old ActivityPub account is only being kept around as a moved profile.
		</p>

		<div class="admin-link-list">
			<p>
				<a href="/admin/profile">Profile</a> keeps your about copy, avatar, and public identity tidy.
			</p>
			<p>
				<a href="/admin/posts">Posts</a> shows the recent Bluesky updates mirrored into the site status
				stream.
			</p>
			<p>
				<a href="/admin/checkins">Check-ins</a> can now sync Swarm activity into your own PDS records.
			</p>
			<p>
				<a href="/admin/media">Media</a> runs PDS syncs that localize music artwork and Popfeed book covers.
			</p>
			<p>
				<a href="/admin/photos">Images</a> manages the synced gallery archive and local image URLs.
			</p>
			<p>
				<a href="/admin/webmentions">Webmentions</a> lets you moderate outside references to your posts.
			</p>
			<p><a href="/admin/standard-site">Standard Site</a> handles longform sync into your PDS.</p>
		</div>
	</div>

	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">ActivityPub</p>
				<h2>Legacy moved profile</h2>
			</div>
		</div>

		<p class="admin-field-note">
			Your old Afterword actor still resolves for compatibility, but it now acts only as a moved
			account that points people to Micro.blog.
		</p>

		<div class="admin-link-list">
			<p><strong>Old actor:</strong> <code>{data.activityPubMove.oldActorUrl}</code></p>
			<p><strong>Moved to:</strong> {data.activityPubMove.targetHandle}</p>
			<p><strong>Target actor:</strong> <code>{data.activityPubMove.targetActorUrl}</code></p>
		</div>
	</div>
</section>
