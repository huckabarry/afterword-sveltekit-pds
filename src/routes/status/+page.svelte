<script lang="ts">
	import CheckinMap from '$lib/components/CheckinMap.svelte';
	import { excerpt, formatDate } from '$lib/format';
	import type { ActivityFeedItem } from '$lib/server/activity-feed';
	import type { StatusPost } from '$lib/server/atproto';
	import type { MediaTimelineItem } from '$lib/types/media-timeline';

	let {
		data
	}: {
		data: {
			activityFeed: ActivityFeedItem[];
			authorAvatarUrl: string;
		};
	} = $props();

	function usesPosterRatio(item: MediaTimelineItem) {
		return item.kind === 'popfeed' && (item.mediaType === 'movie' || item.mediaType === 'tv_show');
	}

	function isBookPopfeed(item: MediaTimelineItem) {
		return item.kind === 'popfeed' && item.mediaType === 'book';
	}

	function socialRepostCount(post: StatusPost) {
		return (post.repostCount || 0) + (post.quoteCount || 0);
	}

	function getVideoLabel(post: StatusPost) {
		return post.video?.alt?.trim() || 'Watch video on Bluesky';
	}

	function getFeedKicker(entry: ActivityFeedItem) {
		if (entry.type === 'status') return 'Status';
		if (entry.type === 'checkin') return 'Check-In';
		return entry.item.label;
	}

	function isGifUrl(url: string | null | undefined) {
		const value = String(url || '').trim().toLowerCase();
		return (
			value.includes('.gif') ||
			value.includes('tenor.com') ||
			value.includes('giphy.com') ||
			value.includes('media.giphy.com')
		);
	}

	function getExternalPreviewImage(
		external: { uri: string; thumb: string; title: string } | null | undefined
	) {
		if (!external) return '';
		return isGifUrl(external.uri) ? external.uri : external.thumb;
	}

	function isGifExternal(
		external: { uri: string; thumb: string; title: string } | null | undefined
	) {
		return Boolean(external && (isGifUrl(external.uri) || isGifUrl(external.thumb)));
	}
</script>

<svelte:head>
	<title>What’s Going On | Bryan Robb</title>
</svelte:head>

<div class="activity-page">
	<header class="activity-page__header">
		<h1 class="activity-page__title">What’s Going On</h1>
		<p class="activity-page__lede">
			A running stream of shorter notes, current obsessions, and the books, music, films,
			and shows that have been in the air lately.
		</p>
	</header>

	{#if data.activityFeed.length}
		<div class="activity-feed" aria-label="What’s going on feed">
			{#each data.activityFeed as entry (entry.id)}
				<article class="activity-feed__entry" id={entry.id}>
					<div class="activity-feed__meta-column">
						<time class="activity-feed__date" datetime={entry.dateIso}>
							{entry.type === 'status'
								? formatDate(entry.post.date)
								: entry.type === 'checkin'
									? formatDate(entry.checkin.visitedAt)
									: entry.item.dateLabel}
						</time>
					</div>

					<div class="activity-feed__content">
						<div class="activity-feed__eyebrow">
							<time class="activity-feed__date-mobile" datetime={entry.dateIso}>
								{entry.type === 'status'
									? formatDate(entry.post.date)
									: entry.type === 'checkin'
										? formatDate(entry.checkin.visitedAt)
										: entry.item.dateLabel}
							</time>
							<p class="activity-feed__kicker">{getFeedKicker(entry)}</p>
						</div>

						{#if entry.type === 'status'}
							<div class="status-card">
								{#if entry.post.replyTo}
									<p class="status-card__reply-context">
										In reply to
										<a href={entry.post.replyTo.blueskyUrl} target="_blank" rel="noreferrer">
											{entry.post.replyTo.displayName || entry.post.replyTo.handle}
										</a>
									</p>
								{/if}

								<a class="status-card__permalink" href={`/status/${entry.post.slug}`}>
									<div class="status-card__content">
										{@html entry.post.html}
									</div>
								</a>

								{#if entry.post.quotedPost}
									<a
										class="status-quote"
										href={entry.post.quotedPost.blueskyUrl}
										target="_blank"
										rel="noreferrer"
									>
										<div class="status-quote__meta">
											{#if entry.post.quotedPost.avatar}
												<img
													class="status-quote__avatar"
													src={entry.post.quotedPost.avatar}
													alt={entry.post.quotedPost.displayName}
													loading="lazy"
												/>
											{/if}
											<div class="status-quote__byline">
												<strong>{entry.post.quotedPost.displayName}</strong>
												<span>{entry.post.quotedPost.handle}</span>
												<span>·</span>
												<time datetime={entry.post.quotedPost.date.toISOString()}>
													{formatDate(entry.post.quotedPost.date)}
												</time>
											</div>
										</div>

										{#if entry.post.quotedPost.html}
											<div class="status-quote__content">
												{@html entry.post.quotedPost.html}
											</div>
										{/if}

								{#if entry.post.quotedPost.images.length}
											<div
												class={`status-card__media status-card__media--quoted ${entry.post.quotedPost.images.length > 1 ? 'status-card__media--multi' : ''}`}
											>
												<div
													class={`status-card__carousel ${entry.post.quotedPost.images.length > 1 ? 'status-card__carousel--multi' : ''}`}
												>
													{#each entry.post.quotedPost.images as image}
														<div class="status-card__slide">
															<img src={image.thumb} alt={image.alt || 'Quoted post image'} loading="lazy" />
														</div>
													{/each}
												</div>
											</div>
										{/if}

										{#if entry.post.quotedPost.external}
											{#if isGifExternal(entry.post.quotedPost.external)}
												<span class="status-card__gif status-card__gif--quoted">
													{#if getExternalPreviewImage(entry.post.quotedPost.external)}
														<img
															class="status-card__gif-image"
															src={getExternalPreviewImage(entry.post.quotedPost.external)}
															alt={entry.post.quotedPost.external.title || entry.post.quotedPost.external.domain}
															loading="lazy"
														/>
													{/if}
													<span class="status-card__gif-badge">GIF</span>
													<span class="status-card__external-domain">{entry.post.quotedPost.external.domain}</span>
													<strong class="status-card__external-title">
														{entry.post.quotedPost.external.title}
													</strong>
													{#if entry.post.quotedPost.external.description}
														<span class="status-card__external-description">
															{entry.post.quotedPost.external.description}
														</span>
													{/if}
												</span>
											{:else}
												<span class="status-card__external status-card__external--quoted">
													{#if entry.post.quotedPost.external.thumb}
														<img
															class="status-card__external-thumb"
															src={entry.post.quotedPost.external.thumb}
															alt={entry.post.quotedPost.external.title || entry.post.quotedPost.external.domain}
															loading="lazy"
														/>
													{/if}
													<span class="status-card__external-domain">{entry.post.quotedPost.external.domain}</span>
													<strong class="status-card__external-title">
														{entry.post.quotedPost.external.title}
													</strong>
													{#if entry.post.quotedPost.external.description}
														<span class="status-card__external-description">
															{entry.post.quotedPost.external.description}
														</span>
													{/if}
												</span>
											{/if}
										{/if}
									</a>
								{/if}

								{#if entry.post.images.length}
									<div
										class={`status-card__media ${entry.post.images.length > 1 ? 'status-card__media--multi' : ''}`}
									>
										<div
											class={`status-card__carousel ${entry.post.images.length > 1 ? 'status-card__carousel--multi' : ''}`}
										>
											{#each entry.post.images as image}
												<a class="status-card__image status-card__slide" href={`/status/${entry.post.slug}`}>
													<img src={image.thumb} alt={image.alt || 'Status image'} loading="lazy" />
												</a>
											{/each}
										</div>
										{#if entry.post.images.length > 1}
											<p class="status-card__carousel-note">{entry.post.images.length} images — swipe or scroll</p>
										{/if}
									</div>
								{/if}

								{#if entry.post.external}
									{#if isGifExternal(entry.post.external)}
										<a
											class="status-card__gif"
											href={entry.post.external.uri}
											target="_blank"
											rel="noreferrer"
										>
											{#if getExternalPreviewImage(entry.post.external)}
												<img
													class="status-card__gif-image"
													src={getExternalPreviewImage(entry.post.external)}
													alt={entry.post.external.title || entry.post.external.domain}
													loading="lazy"
												/>
											{/if}
											<span class="status-card__gif-badge">GIF</span>
											<span class="status-card__external-domain">{entry.post.external.domain}</span>
											<strong class="status-card__external-title">{entry.post.external.title}</strong>
											{#if entry.post.external.description}
												<span class="status-card__external-description">
													{entry.post.external.description}
												</span>
											{/if}
										</a>
									{:else}
										<a
											class="status-card__external"
											href={entry.post.external.uri}
											target="_blank"
											rel="noreferrer"
										>
											{#if entry.post.external.thumb}
												<img
													class="status-card__external-thumb"
													src={entry.post.external.thumb}
													alt={entry.post.external.title || entry.post.external.domain}
													loading="lazy"
												/>
											{/if}
											<span class="status-card__external-domain">{entry.post.external.domain}</span>
											<strong class="status-card__external-title">{entry.post.external.title}</strong>
											{#if entry.post.external.description}
												<span class="status-card__external-description">
													{entry.post.external.description}
												</span>
											{/if}
										</a>
									{/if}
								{/if}

								{#if entry.post.video}
									<a class="status-card__video" href={entry.post.blueskyUrl} target="_blank" rel="noreferrer">
										{#if entry.post.video.thumbnail}
											<span class="status-card__video-thumb-wrap">
												<img
													class="status-card__video-thumb"
													src={entry.post.video.thumbnail}
													alt={getVideoLabel(entry.post)}
													loading="lazy"
												/>
												<span class="status-card__video-badge" aria-hidden="true">Video</span>
											</span>
										{/if}
										<span class="status-card__video-link">{getVideoLabel(entry.post)}</span>
									</a>
								{/if}

								<div class="status-card__actions">
									<a class="status-card__action" href={`/status/${entry.post.slug}`}>
										<span>Open</span>
										<span>{entry.post.replyCount} replies</span>
									</a>
									<a class="status-card__action" href={entry.post.blueskyUrl} target="_blank" rel="noreferrer">
										<span>Bluesky</span>
										<span>{socialRepostCount(entry.post)} reposts</span>
									</a>
								</div>
							</div>
						{:else if entry.type === 'checkin'}
							<div class="checkin-card">
								<a class="checkin-card__link" href={entry.checkin.canonicalPath}>
									{#if entry.checkin.coverImage}
										<div class="checkin-card__media">
											<img
												class="checkin-card__image"
												src={entry.checkin.coverImage}
												alt={entry.checkin.name}
												loading="lazy"
											/>
										</div>
									{:else if entry.checkin.latitude !== null && entry.checkin.longitude !== null}
										<div class="checkin-card__media checkin-card__media--map">
											<CheckinMap
												latitude={entry.checkin.latitude}
												longitude={entry.checkin.longitude}
												name={entry.checkin.name}
												compact={true}
												variant="preview"
											/>
										</div>
									{/if}

									<div class="checkin-card__body">
										<h2 class="checkin-card__title">{entry.checkin.name}</h2>
										{#if entry.checkin.place}
											<p class="checkin-card__place">{entry.checkin.place}</p>
										{/if}
										{#if entry.checkin.venueCategory}
											<p class="checkin-card__category">{entry.checkin.venueCategory}</p>
										{/if}
										{#if entry.checkin.note || entry.checkin.excerpt}
											<p class="checkin-card__excerpt">
												{excerpt(entry.checkin.excerpt || entry.checkin.note, 220)}
											</p>
										{/if}
									</div>
								</a>

								<div class="checkin-card__actions">
									<a class="status-card__action" href={entry.checkin.canonicalPath}>
										<span>Open</span>
										<span>Check-in</span>
									</a>
									{#if entry.checkin.appleMapsUrl}
										<a
											class="status-card__action"
											href={entry.checkin.appleMapsUrl}
											target="_blank"
											rel="noreferrer"
										>
											<span>Map</span>
											<span>Apple Maps</span>
										</a>
									{/if}
								</div>
							</div>
						{:else}
							{#if entry.item.kind === 'track'}
								<div class="media-entry media-entry--track">
									<a class="media-entry__cover media-entry__cover--mini" href={entry.item.href}>
										{#if entry.item.imageUrl}
											<img
												class="media-entry__art media-entry__art--mini"
												src={entry.item.imageUrl}
												alt={entry.item.imageAlt}
												loading="lazy"
											/>
										{:else}
											<div class="media-entry__fallback media-entry__fallback--mini" aria-hidden="true">
												Track
											</div>
										{/if}
									</a>

									<div class="media-entry__mini-player">
										<div class="media-entry__body">
											<div class="media-entry__heading">
												<h2
													class="media-timeline__title media-timeline__title--media media-timeline__title--mini"
												>
													<a href={entry.item.href}>{entry.item.title}</a>
												</h2>
											</div>

											<p class="media-timeline__meta media-timeline__meta--artist">
												{entry.item.artist}
											</p>
										</div>

										{#if entry.item.audioUrl}
											<div class="media-entry__audio media-entry__audio--mini">
												<audio
													controls
													preload="none"
													src={entry.item.audioUrl}
													aria-label={`Preview ${entry.item.title}`}
												></audio>
											</div>
										{/if}

										{#if entry.item.summary}
											<p
												class="media-timeline__lede media-timeline__lede--compact media-timeline__lede--mini"
											>
												{entry.item.summary}
											</p>
										{/if}

										{#if entry.item.links.length}
											<div class="media-timeline__actions media-timeline__actions--mini">
												{#each entry.item.links as link}
													<a
														class="tag-pill media-timeline__action"
														href={link.url}
														target={link.external ? '_blank' : undefined}
														rel={link.external ? 'noreferrer' : undefined}
													>
														{link.label}
													</a>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							{:else if entry.item.kind === 'album'}
								<div class="media-entry media-entry--album">
									<div class="media-entry__body">
										<div class="media-entry__heading">
											<h2 class="media-timeline__title media-timeline__title--media">
												<a href={entry.item.href}>{entry.item.title}</a>
											</h2>
										</div>

										<p class="media-timeline__meta media-timeline__meta--artist">{entry.item.artist}</p>
									</div>

									<a class="media-entry__cover media-entry__cover--full" href={entry.item.href}>
										{#if entry.item.imageUrl}
											<img
												class="media-entry__art"
												src={entry.item.imageUrl}
												alt={entry.item.imageAlt}
												loading="lazy"
											/>
										{:else}
											<div class="media-entry__fallback" aria-hidden="true">Album</div>
										{/if}
									</a>

									{#if entry.item.summary}
										<p class="media-timeline__lede media-timeline__lede--compact">
											{entry.item.summary}
										</p>
									{/if}

									{#if entry.item.links.length}
										<div class="media-timeline__actions">
											{#each entry.item.links as link}
												<a
													class="tag-pill media-timeline__action"
													href={link.url}
													target={link.external ? '_blank' : undefined}
													rel={link.external ? 'noreferrer' : undefined}
												>
													{link.label}
												</a>
											{/each}
										</div>
									{/if}
								</div>
							{:else}
								<div class="media-entry media-entry--popfeed">
									<div class="media-entry__body">
										<div class="media-entry__heading">
											<h2 class="media-timeline__title media-timeline__title--media">
												<a href={entry.item.href}>{entry.item.title}</a>
											</h2>
										</div>

										{#if entry.item.credit}
											<p class="media-timeline__meta media-timeline__meta--artist">{entry.item.credit}</p>
										{/if}
									</div>

									{#if !isBookPopfeed(entry.item) && entry.item.imageUrl}
										<a
											class={`media-entry__cover media-entry__cover--full ${usesPosterRatio(entry.item) ? 'media-entry__cover--poster' : 'media-entry__cover--natural'}`}
											href={entry.item.href}
										>
											<img
												class={`media-entry__art ${usesPosterRatio(entry.item) ? 'media-entry__art--poster' : 'media-entry__art--natural'}`}
												src={entry.item.imageUrl}
												alt={entry.item.imageAlt}
												loading="lazy"
											/>
										</a>
									{:else if !isBookPopfeed(entry.item)}
										<a
											class={`media-entry__cover media-entry__cover--full ${usesPosterRatio(entry.item) ? 'media-entry__cover--poster' : 'media-entry__cover--natural'}`}
											href={entry.item.href}
										>
											<div
												class={`media-entry__fallback ${usesPosterRatio(entry.item) ? 'media-entry__fallback--poster' : 'media-entry__fallback--natural'}`}
												aria-hidden="true"
											>
												{entry.item.label}
											</div>
										</a>
									{/if}

									{#if entry.item.summary}
										<p class="media-timeline__lede media-timeline__lede--compact">{entry.item.summary}</p>
									{/if}

									<div class="media-timeline__actions">
										<a class="tag-pill media-timeline__action" href={entry.item.href}>Open entry</a>
										{#each entry.item.links as link}
											<a
												class="tag-pill media-timeline__action"
												href={link.url}
												target={link.external ? '_blank' : undefined}
												rel={link.external ? 'noreferrer' : undefined}
											>
												{link.label}
											</a>
										{/each}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<p class="activity-page__empty">Nothing to show just yet.</p>
	{/if}
</div>

<style>
	.activity-page {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding-top: 1rem;
		padding-bottom: 4rem;
	}

	.activity-page__header {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.activity-page__title {
		margin: 0;
		font-size: clamp(2.25rem, 5vw, 3rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #18181b;
	}

	:global(html.dark) .activity-page__title {
		color: #f4f4f5;
	}

	.activity-page__lede,
	.activity-page__empty {
		margin: 0;
		font-size: 1rem;
		line-height: 1.75;
		color: #52525b;
	}

	:global(html.dark) .activity-page__lede,
	:global(html.dark) .activity-page__empty {
		color: #a1a1aa;
	}

	.activity-feed {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.activity-feed__entry {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: start;
	}

	.activity-feed__date {
		font-size: 0.82rem;
		line-height: 1.25;
		color: var(--muted);
	}

	.activity-feed__content {
		min-width: 0;
	}

	.activity-feed__eyebrow {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-bottom: 0.85rem;
	}

	.activity-feed__date-mobile {
		font-size: 0.84rem;
		line-height: 1.25;
		color: var(--muted);
	}

	.activity-feed__kicker {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #c06a63;
	}

	:global(html.dark) .activity-feed__kicker {
		color: #e08a7a;
	}

	.status-card,
	.media-card,
	.checkin-card {
		display: grid;
		gap: 0.95rem;
	}

	.status-card__reply-context {
		color: var(--muted);
		font-size: 0.88rem;
	}

	.status-card__reply-context,
	.status-card__content,
	.status-card__external-description {
		line-height: 1.68;
	}

	.status-card__reply-context,
	.status-card__content,
	.status-card__actions,
	.status-card__external {
		margin: 0;
	}

	.status-card__permalink {
		color: inherit;
		text-decoration: none;
	}

	.status-card__content :global(p) {
		margin: 0;
	}

	.status-card__content :global(p + p) {
		margin-top: 0.9rem;
	}

	.status-card__content {
		font-size: 1rem;
		color: #27272a;
	}

	.status-quote__content {
		line-height: 1.68;
	}

	.status-quote__content :global(p) {
		margin: 0;
	}

	.status-quote__content :global(p + p) {
		margin-top: 0.75rem;
	}

	:global(html.dark) .status-card__content {
		color: #e4e4e7;
	}

	.status-quote {
		display: grid;
		gap: 0.75rem;
		padding: 0.95rem 1rem;
		border: 1px solid color-mix(in srgb, var(--accent) 14%, transparent);
		border-radius: 0.9rem;
		text-decoration: none;
		color: inherit;
		background: color-mix(in srgb, var(--surface) 86%, white 14%);
	}

	.status-quote__meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.status-quote__avatar {
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 999px;
		object-fit: cover;
	}

	.status-quote__byline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.86rem;
		color: var(--muted);
	}

	.status-quote__byline strong {
		color: #18181b;
	}

	:global(html.dark) .status-quote__byline strong {
		color: #f4f4f5;
	}

	.status-card__media {
		display: grid;
		gap: 0.75rem;
	}

	.status-card__carousel {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 100%;
		gap: 0.75rem;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: thin;
		padding-bottom: 0.15rem;
	}

	.status-card__carousel--multi {
		grid-auto-columns: minmax(86%, 86%);
		-webkit-overflow-scrolling: touch;
	}

	.status-card__slide {
		scroll-snap-align: start;
		min-width: 0;
	}

	.status-card__image {
		display: block;
	}

	.status-card__image img,
	.status-card__slide img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.75rem;
	}

	.status-card__carousel-note {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--muted);
	}

	.status-card__external {
		display: grid;
		gap: 0.25rem;
		padding: 0.9rem 1rem;
		border: 1px solid color-mix(in srgb, var(--accent) 16%, transparent);
		border-radius: 0.9rem;
		text-decoration: none;
		color: inherit;
		background: color-mix(in srgb, var(--surface) 78%, white 22%);
	}

	.status-card__gif {
		display: grid;
		gap: 0.45rem;
		text-decoration: none;
		color: inherit;
	}

	.status-card__gif-image {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.75rem;
	}

	.status-card__gif-badge {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		padding: 0.22rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--accent);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.status-card__gif--quoted {
		gap: 0.4rem;
	}

	.status-card__external-thumb {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.65rem;
		margin-bottom: 0.35rem;
	}

	.status-card__external--quoted {
		padding: 0.8rem 0.9rem;
	}

	.status-card__external-domain,
	.status-card__external-description {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.status-card__external-title {
		color: #18181b;
	}

	:global(html.dark) .status-card__external-title {
		color: #f4f4f5;
	}

	.status-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		padding-top: 0.15rem;
	}

	.status-card__action {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		color: var(--muted);
		text-decoration: none;
	}

	.status-card__video {
		display: grid;
		gap: 0.75rem;
		text-decoration: none;
		color: inherit;
	}

	.status-card__video-thumb-wrap {
		position: relative;
		display: block;
	}

	.status-card__video-thumb {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.75rem;
	}

	.status-card__video-badge {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		display: inline-flex;
		align-items: center;
		padding: 0.22rem 0.5rem;
		border-radius: 999px;
		background: rgba(24, 24, 27, 0.78);
		color: white;
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.status-card__video-link {
		font-size: 0.92rem;
		color: var(--muted);
	}

	.checkin-card__link {
		display: grid;
		gap: 0.95rem;
		color: inherit;
		text-decoration: none;
	}

	.checkin-card__media {
		display: block;
		overflow: hidden;
		border-radius: 0.9rem;
		aspect-ratio: 16 / 10;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
	}

	.checkin-card__media--map :global(.checkin-map__frame--compact) {
		min-height: 0;
		height: 100%;
	}

	.checkin-card__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.checkin-card__body {
		display: grid;
		gap: 0.5rem;
	}

	.checkin-card__title {
		margin: 0;
		font-family: 'Fira Sans', sans-serif;
		font-size: clamp(1.2rem, 2vw, 1.45rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
		color: #18181b;
	}

	:global(html.dark) .checkin-card__title {
		color: #f4f4f5;
	}

	.checkin-card__place,
	.checkin-card__excerpt {
		margin: 0;
		color: var(--muted);
		line-height: 1.65;
	}

	.checkin-card__category {
		margin: 0.1rem 0 0;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.76rem;
		font-weight: 700;
	}

	.checkin-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		padding-top: 0.1rem;
	}

	.media-entry {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		align-items: start;
	}

	.media-entry--track {
		grid-template-columns: minmax(4.9rem, 5.5rem) minmax(0, 1fr);
		gap: 0.95rem;
		padding: 0.95rem;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--surface) 78%, white 22%);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent);
	}

	.media-entry__mini-player {
		display: grid;
		gap: 0.65rem;
		min-width: 0;
	}

	.media-entry__body {
		display: grid;
		gap: 0.55rem;
		min-width: 0;
	}

	.media-entry__heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.media-timeline__title {
		margin: 0;
		font-family: 'Fira Sans', sans-serif;
		font-size: clamp(1.28rem, 2.35vw, 1.72rem);
		line-height: 1.14;
		letter-spacing: -0.02em;
		color: #18181b;
	}

	.media-timeline__title a {
		color: inherit;
		text-decoration: none;
	}

	:global(html.dark) .media-timeline__title {
		color: #f4f4f5;
	}

	.media-timeline__title--media {
		font-size: clamp(1.18rem, 2.1vw, 1.55rem);
	}

	.media-timeline__title--mini {
		font-size: clamp(1rem, 1.65vw, 1.18rem);
		line-height: 1.2;
	}

	.media-timeline__meta,
	.media-timeline__lede {
		margin: 0;
	}

	.media-timeline__meta {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--muted);
	}

	.media-timeline__meta--artist {
		margin-top: 0.1rem;
	}

	.media-timeline__lede {
		font-size: 1rem;
		line-height: 1.68;
		color: var(--muted);
	}

	.media-timeline__lede--compact {
		margin-top: 0.1rem;
	}

	.media-timeline__lede--mini {
		font-size: 0.95rem;
		line-height: 1.55;
	}

	.media-entry__cover {
		display: block;
		width: 100%;
		text-decoration: none;
		color: inherit;
	}

	.media-entry__cover--mini {
		width: 100%;
		align-self: start;
	}

	.media-entry__art {
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		object-fit: cover;
		border-radius: 0.85rem;
	}

	.media-entry__art--mini {
		aspect-ratio: 1 / 1;
		border-radius: 0.95rem;
		box-shadow: 0 0.7rem 1.5rem rgba(0, 0, 0, 0.16);
	}

	.media-entry__art--poster {
		aspect-ratio: 2 / 3;
	}

	.media-entry__art--natural {
		aspect-ratio: auto;
		height: auto;
		object-fit: contain;
	}

	.media-entry__fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 0.85rem;
		background: color-mix(in srgb, var(--surface) 82%, white 18%);
		color: var(--muted);
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.media-entry__fallback--mini {
		border-radius: 0.95rem;
		font-size: 0.74rem;
	}

	.media-entry__fallback--poster {
		aspect-ratio: 2 / 3;
	}

	.media-entry__fallback--natural {
		aspect-ratio: auto;
		min-height: 12rem;
	}

	.media-entry__audio audio {
		display: block;
		width: 100%;
		height: 2rem;
	}

	.media-timeline__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.media-timeline__actions--mini {
		gap: 0.45rem;
	}

	@media (max-width: 767px) {
		.activity-feed__meta-column {
			display: none;
		}
	}

	@media (min-width: 768px) {
		.activity-feed {
			gap: 4rem;
			border-left: 1px solid rgba(228, 228, 231, 1);
			padding-left: 1.5rem;
		}

		:global(html.dark) .activity-feed {
			border-left-color: rgba(63, 63, 70, 0.4);
		}

		.activity-feed__entry {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 2rem;
		}

		.activity-feed__meta-column {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			padding-top: 0.1rem;
		}

		.activity-feed__content {
			grid-column: span 3 / span 3;
		}

		.activity-feed__date-mobile {
			display: none;
		}
	}
</style>
