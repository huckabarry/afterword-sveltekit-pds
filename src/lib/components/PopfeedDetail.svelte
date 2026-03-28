<script lang="ts">
	import type { PopfeedItem } from '$lib/server/popfeed';

	let {
		item,
		previousItem,
		nextItem,
		backHref,
		backLabel
	}: {
		item: PopfeedItem;
		previousItem: PopfeedItem | null;
		nextItem: PopfeedItem | null;
		backHref: string;
		backLabel: string;
	} = $props();
</script>

<article class="entry entry--media">
	<div class="entry__meta">
		<a href={backHref}>{backLabel}</a>
		{#if item.listTypeLabel}
			<span>{item.listTypeLabel}</span>
		{/if}
		<time datetime={item.date.toISOString()}>{item.displayDate}</time>
	</div>

	<div class="media-entry">
		{#if item.posterImage}
			<figure class="media-entry__cover">
				<img src={item.posterImage} alt={item.title} />
			</figure>
		{/if}

		<div class="media-entry__body">
			<h1 class="entry__title">{item.title}</h1>

			{#if item.mainCredit}
				<p class="media-entry__credit">{item.mainCredit}</p>
			{/if}

			<dl class="media-entry__details">
				{#if item.mainCreditRole}
					<div>
						<dt>Credit</dt>
						<dd>{item.mainCreditRole}</dd>
					</div>
				{/if}

				{#if item.addedAt}
					<div>
						<dt>Added</dt>
						<dd><time datetime={item.addedAt.toISOString()}>{item.displayDate}</time></dd>
					</div>
				{/if}

				{#if item.releaseDate}
					<div>
						<dt>Released</dt>
						<dd>
							{item.releaseDate.toLocaleDateString('en-GB', {
								day: '2-digit',
								month: 'short',
								year: 'numeric'
							})}
						</dd>
					</div>
				{/if}

				{#if item.listName}
					<div>
						<dt>List</dt>
						<dd>{item.listName}</dd>
					</div>
				{/if}

				{#if item.genres.length}
					<div>
						<dt>Genres</dt>
						<dd>{item.genres.join(', ')}</dd>
					</div>
				{/if}
			</dl>

			{#if item.links.length}
				<div class="media-entry__links">
					<h2 class="media-entry__links-title">Links</h2>
					<ul class="media-entry__links-list">
						{#each item.links as link}
							<li><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>

	<footer class="post-actions" aria-label="Post actions">
		<a class="post-action-link" href={backHref}>Back to all {backLabel.toLowerCase()}</a>
	</footer>

	{#if previousItem || nextItem}
		<nav class="post-navigation">
			<ul>
				<li class="post-navigation-item post-navigation-item-previous">
					{#if previousItem}
						<a class="post-navigation-link" href={previousItem.localPath}>
							<span class="post-navigation-label">← Previous</span>
							<span class="post-navigation-title">{previousItem.title}</span>
						</a>
					{/if}
				</li>
				<li class="post-navigation-item post-navigation-item-next">
					{#if nextItem}
						<a class="post-navigation-link" href={nextItem.localPath}>
							<span class="post-navigation-label">Next →</span>
							<span class="post-navigation-title">{nextItem.title}</span>
						</a>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
</article>
