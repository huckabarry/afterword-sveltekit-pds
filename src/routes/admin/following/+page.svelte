<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const initialStatuses = data.statuses;
	const initialFlash = {
		liked: data.liked,
		boosted: data.boosted,
		replied: data.replied
	};
	let statuses = $state(initialStatuses);
	let flash = $state({
		liked: initialFlash.liked,
		boosted: initialFlash.boosted,
		replied: initialFlash.replied
	});

	function formatDate(value: string) {
		return new Date(value).toLocaleString();
	}

	function enhanceStatusAction(kind: 'like' | 'boost') {
		return ({ formData }: { formData: FormData }) => {
			const objectId = String(formData.get('objectId') || '');

			return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
				if (result.type !== 'success' || !objectId) return;

				statuses = statuses.map((status: (typeof initialStatuses)[number]) =>
					status.objectId === objectId
						? {
								...status,
								favourited: kind === 'like' ? true : status.favourited,
								reblogged: kind === 'boost' ? true : status.reblogged
							}
						: status
				);

				if (kind === 'like') flash.liked = true;
				if (kind === 'boost') flash.boosted = true;
			};
		};
	}

	function enhanceReply() {
		return async ({ result, formElement }: { result: { type: string }; formElement: HTMLFormElement }) => {
			if (result.type !== 'success') return;
			flash.replied = true;
			formElement.reset();
			const details = formElement.closest('details');
			if (details) details.open = false;
		};
	}
</script>

<section class="admin-panel">
	<div class="admin-card admin-feed-card">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Feed</p>
				<h2>Followed posts</h2>
			</div>
			<div class="admin-thread__actions admin-thread__actions--social">
				<form method="POST" action="?/refresh">
					<button class="admin-pill-link" type="submit">Refresh feed</button>
				</form>
				<a href="/admin/following/accounts">Manage following</a>
			</div>
		</div>

		{#if flash.liked}
			<p class="admin-form-success">Like sent.</p>
		{/if}

		{#if flash.boosted}
			<p class="admin-form-success">Boost sent.</p>
		{/if}

		{#if flash.replied}
			<p class="admin-form-success">Reply published.</p>
		{/if}

		{#if data.refreshed}
			<p class="admin-form-success">Feed refreshed.</p>
		{/if}

		{#if statuses.length}
			<ul class="admin-social-list">
				{#each statuses as status}
					<li class="admin-social-card">
						<div class="admin-social-card__avatar-wrap">
							{#if status.actorUrl}
								<a href={status.actorUrl} target="_blank" rel="noreferrer">
									<img
										class="admin-social-card__avatar"
										src={status.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
										alt={status.actorName || status.actorHandle || 'Avatar'}
									/>
								</a>
							{:else}
								<img
									class="admin-social-card__avatar"
									src={status.actorAvatarUrl || '/assets/images/status-avatar.jpg'}
									alt={status.actorName || status.actorHandle || 'Avatar'}
								/>
							{/if}
						</div>
						<div class="admin-social-card__body">
							<div class="admin-social-card__meta">
								<strong>{status.actorName || status.actorHandle || status.actorId}</strong>
								{#if status.actorHandle}
									<span>@{status.actorHandle}</span>
								{/if}
								<span>{formatDate(status.publishedAt)}</span>
							</div>

							{#if status.contentText}
								<p class="admin-social-card__content">{status.contentText}</p>
							{:else if status.contentHtml}
								<div class="admin-social-card__content">
									{@html status.contentHtml}
								</div>
							{/if}

							{#if status.attachments?.length}
								<div class="admin-social-card__media-strip">
									{#each status.attachments as attachment}
										<img src={attachment.url} alt={attachment.alt || 'Post image'} loading="lazy" />
									{/each}
								</div>
							{/if}

							{#if status.replyContext}
								<div class="admin-thread__context">
									<p class="admin-thread__context-label">Replying to</p>
									<a
										class="admin-thread__context-card"
										href={status.replyContext.url}
										target="_blank"
										rel="noreferrer"
									>
										{#if status.replyContext.title}
											<strong>{status.replyContext.title}</strong>
										{/if}
										{#if status.replyContext.author}
											<span>{status.replyContext.author}</span>
										{/if}
										<p>{status.replyContext.excerpt}</p>
									</a>
								</div>
							{/if}

							<div class="admin-thread__actions admin-thread__actions--social">
								<form method="POST" action="?/like" use:enhance={enhanceStatusAction('like')}>
									<input type="hidden" name="objectId" value={status.objectId} />
									<button class:admin-pill-link-liked={status.favourited} class="admin-pill-link" type="submit">
										{#if status.favourited}
											<span aria-hidden="true">♥</span>
											<span>Liked</span>
										{:else}
											<span aria-hidden="true">♡</span>
											<span>Like</span>
										{/if}
									</button>
								</form>
								<form method="POST" action="?/boost" use:enhance={enhanceStatusAction('boost')}>
									<input type="hidden" name="objectId" value={status.objectId} />
									<button class="admin-pill-link" type="submit">
										{status.reblogged ? 'Boosted' : 'Boost'}
									</button>
								</form>
								<a class="admin-pill-link" href={status.objectUrl || status.objectId} target="_blank" rel="noreferrer">Open post</a>
								{#if status.replyContext}
									<a class="admin-pill-link" href={status.replyContext.url} target="_blank" rel="noreferrer">Open thread</a>
								{/if}
							</div>

							<details class="admin-inline-reply">
								<summary class="admin-pill-link">Reply inline</summary>
								<form method="POST" action="?/reply" class="admin-inline-reply__form" use:enhance={enhanceReply}>
									<input type="hidden" name="replyTo" value={status.objectId} />
									<label class="admin-field">
										<span>Reply</span>
										<textarea
											name="content"
											rows="4"
											placeholder="Write a reply..."
										></textarea>
									</label>
									<div class="admin-form-actions">
										<button class="admin-button" type="submit">Send reply</button>
									</div>
								</form>
							</details>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="admin-empty">Follow some people and their new posts will show up here.</p>
		{/if}
	</div>
</section>
