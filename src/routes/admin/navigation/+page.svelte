<script lang="ts">
	import { enhance } from '$app/forms';

	type CmsLink = {
		label: string;
		href: string;
	};

	let { data, form } = $props();

	function cloneLinks(links: CmsLink[]) {
		return links.map((link) => ({ ...link }));
	}

	let primaryLinks = $state<CmsLink[]>([]);
	let secondaryLinks = $state<CmsLink[]>([]);
	let footerLinks = $state<CmsLink[]>([]);

	$effect(() => {
		const navigation = form?.navigation || data.navigation;
		primaryLinks = cloneLinks(navigation.primary);
		secondaryLinks = cloneLinks(navigation.secondary);
		footerLinks = cloneLinks(navigation.footer);
	});

	function addLink(list: CmsLink[]) {
		return [...list, { label: '', href: '' }];
	}

	function removeLink(list: CmsLink[], index: number) {
		return list.filter((_, itemIndex) => itemIndex !== index);
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow admin-cms-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Navigation</p>
				<h2>Header rows and footer links</h2>
			</div>
		</div>

		<p class="admin-field-note">
			This matches the live Afterword shell: a small primary row, a deeper secondary row, and a
			short footer list.
		</p>

		{#if form?.success}
			<p class="admin-form-success">Navigation saved.</p>
		{/if}

		<form method="POST" class="admin-compose-form admin-cms-form" use:enhance>
			<input type="hidden" name="primaryLinks" value={JSON.stringify(primaryLinks)} />
			<input type="hidden" name="secondaryLinks" value={JSON.stringify(secondaryLinks)} />
			<input type="hidden" name="footerLinks" value={JSON.stringify(footerLinks)} />

			<div class="admin-cms-link-group">
				<div class="admin-cms-link-group__head">
					<h3>Primary</h3>
					<button class="admin-ghost-button" type="button" onclick={() => (primaryLinks = addLink(primaryLinks))}>
						Add link
					</button>
				</div>
				{#each primaryLinks as link, index}
					<div class="admin-cms-link-row">
						<input bind:value={link.label} placeholder="Label" />
						<input bind:value={link.href} placeholder="/path" />
						<button class="admin-ghost-button" type="button" onclick={() => (primaryLinks = removeLink(primaryLinks, index))}>
							Remove
						</button>
					</div>
				{/each}
			</div>

			<div class="admin-cms-link-group">
				<div class="admin-cms-link-group__head">
					<h3>Secondary</h3>
					<button class="admin-ghost-button" type="button" onclick={() => (secondaryLinks = addLink(secondaryLinks))}>
						Add link
					</button>
				</div>
				{#each secondaryLinks as link, index}
					<div class="admin-cms-link-row">
						<input bind:value={link.label} placeholder="Label" />
						<input bind:value={link.href} placeholder="/path" />
						<button class="admin-ghost-button" type="button" onclick={() => (secondaryLinks = removeLink(secondaryLinks, index))}>
							Remove
						</button>
					</div>
				{/each}
			</div>

			<div class="admin-cms-link-group">
				<div class="admin-cms-link-group__head">
					<h3>Footer</h3>
					<button class="admin-ghost-button" type="button" onclick={() => (footerLinks = addLink(footerLinks))}>
						Add link
					</button>
				</div>
				{#each footerLinks as link, index}
					<div class="admin-cms-link-row">
						<input bind:value={link.label} placeholder="Label" />
						<input bind:value={link.href} placeholder="/path" />
						<button class="admin-ghost-button" type="button" onclick={() => (footerLinks = removeLink(footerLinks, index))}>
							Remove
						</button>
					</div>
				{/each}
			</div>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">Save navigation</button>
			</div>
		</form>
	</div>
</section>
