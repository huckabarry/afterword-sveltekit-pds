<script lang="ts">
	let { data, form } = $props();

	function formatTimestamp(value: string | null) {
		if (!value) {
			return 'Not yet';
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	const fullName = $derived(
		[data.swarm.user.firstName, data.swarm.user.lastName].filter(Boolean).join(' ')
	);
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Swarm</p>
				<h2>Check-in sync</h2>
			</div>
		</div>

		<p class="admin-field-note">
			Use Swarm on your phone, then sync those check-ins into your own PDS records so the site keeps
			reading your schema, not theirs.
		</p>

		<div class="admin-link-list">
			<p><strong>OAuth callback:</strong> <code>{data.swarm.callbackUrl}</code></p>
			<p><strong>Push URL:</strong> <code>{data.swarm.pushUrl}</code></p>
			<p>
				<strong>Status:</strong>
				{#if !data.swarm.configured}
					Missing Foursquare app credentials
				{:else if data.swarm.connected}
					Connected
				{:else}
					Not connected
				{/if}
			</p>
			{#if data.swarm.connected}
				<p><strong>Account:</strong> {fullName || data.swarm.user.id || 'Connected user'}</p>
				<p><strong>Connected:</strong> {formatTimestamp(data.swarm.connectedAt)}</p>
				<p><strong>Last synced:</strong> {formatTimestamp(data.swarm.lastSyncedAt)}</p>
				<p><strong>Last source check-in:</strong> {data.swarm.lastSourceCheckinId || 'Not yet'}</p>
				<p><strong>Imported count:</strong> {data.swarm.syncCount}</p>
			{/if}
			{#if data.swarm.lastError}
				<p><strong>Last error:</strong> {data.swarm.lastError}</p>
			{/if}
		</div>

		{#if form?.message}
			<p class:admin-status--error={form?.ok === false} class="admin-status">{form.message}</p>
		{/if}

		<div class="admin-actions-row">
			{#if data.swarm.configured && !data.swarm.connected}
				<a class="admin-button" href="/admin/checkins/connect">Connect Swarm</a>
			{/if}

			{#if data.swarm.connected}
				<form method="POST">
					<button class="admin-button" type="submit" formaction="?/sync">Sync recent check-ins</button>
				</form>
				<form method="POST">
					<button class="admin-ghost-button" type="submit" formaction="?/disconnect">Disconnect</button>
				</form>
			{/if}
		</div>

		<p class="admin-field-note">
			Set <code>FOURSQUARE_CLIENT_ID</code> and <code>FOURSQUARE_CLIENT_SECRET</code> first. If you
			want instant updates, also set <code>FOURSQUARE_PUSH_SECRET</code> and register the push URL in
			your Foursquare app settings.
		</p>
	</div>
</section>
