<script lang="ts">
	let { data } = $props();

	const quickActions = [
		{
			href: '/admin/posts',
			label: 'Posts',
			description: 'Edit recent status posts and clean up wording before they spread outward.'
		},
		{
			href: '/admin/pages',
			label: 'Pages',
			description: 'Work on quieter editorial pages in a writing-first layout.'
		},
		{
			href: '/admin/photos',
			label: 'Images',
			description: 'Check what has synced, what is public, and what still needs cleanup.'
		},
		{
			href: '/admin/navigation',
			label: 'Navigation',
			description: 'Adjust the top row, footer, and menu links that shape the whole site.'
		}
	];

	const workstreams = [
		{
			title: 'Content',
			items: [
				{
					href: '/admin/site',
					label: 'Site settings',
					description: 'Title, shell copy, and the site-wide voice.'
				},
				{
					href: '/admin/pages',
					label: 'Pages',
					description: 'Standalone editorial pages and evergreen sections.'
				},
				{
					href: '/admin/profile',
					label: 'Profile',
					description: 'About copy, avatar, and public identity details.'
				}
			]
		},
		{
			title: 'Signals',
			items: [
				{
					href: '/admin/checkins',
					label: 'Check-ins',
					description: 'Swarm-backed place records and their local read model.'
				},
				{
					href: '/admin/media',
					label: 'Media',
					description: 'Music imports, cover review, and media diagnostics.'
				},
				{
					href: '/admin/webmentions',
					label: 'Webmentions',
					description: 'Moderate outside replies and references to your posts.'
				}
			]
		},
		{
			title: 'Publishing',
			items: [
				{
					href: '/admin/standard-site',
					label: 'Standard Site',
					description: 'Sync longform records and check publication-state drift.'
				},
				{
					href: '/admin/navigation',
					label: 'Menus',
					description: 'Keep header and footer routes aligned with the public site.'
				}
			]
		}
	];
</script>

<section class="admin-panel admin-home-dashboard">
	<div class="admin-card admin-home-hero">
		<div class="admin-card__head admin-home-hero__head">
			<div>
				<p class="admin-eyebrow">Workspace</p>
				<h2>Welcome back, {data.profile.displayName}</h2>
			</div>
			<a class="admin-home-hero__link" href="/" target="_blank" rel="noreferrer">View site</a>
		</div>

		<p class="admin-home-hero__copy">
			This admin works best when it feels like a quiet operations desk instead of a pile of raw
			fields. The quickest lanes are below.
		</p>

		<div class="admin-summary-grid admin-summary-grid--dashboard">
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

		<div class="admin-home-actions">
			{#each quickActions as action}
				<a class="admin-home-action" href={action.href}>
					<span class="admin-home-action__title">{action.label}</span>
					<span class="admin-home-action__description">{action.description}</span>
				</a>
			{/each}
		</div>
	</div>

	<div class="admin-home-grid">
		{#each workstreams as stream}
			<div class="admin-card admin-home-section">
				<div class="admin-card__head">
					<div>
						<p class="admin-eyebrow">{stream.title}</p>
						<h2>{stream.title} lanes</h2>
					</div>
				</div>

				<div class="admin-home-list">
					{#each stream.items as item}
						<a class="admin-home-list__item" href={item.href}>
							<span class="admin-home-list__title">{item.label}</span>
							<span class="admin-home-list__description">{item.description}</span>
						</a>
					{/each}
				</div>
			</div>
		{/each}

		<div class="admin-card admin-home-section">
			<div class="admin-card__head">
				<div>
					<p class="admin-eyebrow">Legacy</p>
					<h2>Moved ActivityPub profile</h2>
				</div>
			</div>

			<p class="admin-home-section__copy">
				The old Afterword actor still resolves for compatibility, but it now only points people
				toward the current destination.
			</p>

			<dl class="admin-home-meta">
				<div>
					<dt>Old actor</dt>
					<dd><code>{data.activityPubMove.oldActorUrl}</code></dd>
				</div>
				<div>
					<dt>Moved to</dt>
					<dd>{data.activityPubMove.targetHandle}</dd>
				</div>
				<div>
					<dt>Target actor</dt>
					<dd><code>{data.activityPubMove.targetActorUrl}</code></dd>
				</div>
			</dl>
		</div>
	</div>
</section>

<style>
	.admin-home-dashboard {
		display: grid;
		gap: 1.35rem;
	}

	.admin-home-hero {
		display: grid;
		gap: 1.1rem;
	}

	.admin-home-hero__head {
		align-items: flex-start;
		gap: 1rem;
	}

	.admin-home-hero__link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.9rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--border) 84%, white 16%);
		color: var(--text);
		font-size: 0.92rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			transform 160ms ease;
	}

	.admin-home-hero__link:hover {
		border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		transform: translateY(-1px);
	}

	.admin-home-hero__copy {
		max-width: 52rem;
		margin: 0;
		color: var(--muted);
		line-height: 1.6;
	}

	.admin-summary-grid--dashboard {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.admin-home-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.admin-home-action,
	.admin-home-list__item {
		display: grid;
		gap: 0.35rem;
		padding: 1rem 1.05rem;
		border-radius: 1rem;
		border: 1px solid color-mix(in srgb, var(--border) 88%, white 12%);
		background: color-mix(in srgb, var(--surface) 94%, white 6%);
		color: inherit;
		text-decoration: none;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			transform 160ms ease;
	}

	.admin-home-action:hover,
	.admin-home-list__item:hover {
		border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
		background: color-mix(in srgb, var(--accent) 7%, var(--surface));
		transform: translateY(-1px);
	}

	.admin-home-action__title,
	.admin-home-list__title {
		font-weight: 700;
		color: var(--text);
	}

	.admin-home-action__description,
	.admin-home-list__description {
		color: var(--muted);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.admin-home-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.35rem;
	}

	.admin-home-section {
		display: grid;
		gap: 1rem;
	}

	.admin-home-list {
		display: grid;
		gap: 0.8rem;
	}

	.admin-home-section__copy {
		margin: 0;
		color: var(--muted);
		line-height: 1.55;
	}

	.admin-home-meta {
		display: grid;
		gap: 0.8rem;
		margin: 0;
	}

	.admin-home-meta div {
		display: grid;
		gap: 0.25rem;
		padding-top: 0.8rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
	}

	.admin-home-meta dt {
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
	}

	.admin-home-meta dd {
		margin: 0;
		color: var(--text);
		line-height: 1.5;
		word-break: break-word;
	}

	@media (max-width: 900px) {
		.admin-summary-grid--dashboard,
		.admin-home-actions,
		.admin-home-grid {
			grid-template-columns: 1fr;
		}

		.admin-home-hero__head {
			flex-direction: column;
		}
	}
</style>
