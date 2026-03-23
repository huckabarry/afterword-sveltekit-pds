<script lang="ts">
	let { data, form } = $props();
</script>

<section class="admin-panel">
	<div class="admin-card admin-card--narrow">
		<div class="admin-card__head">
			<div>
				<p class="admin-eyebrow">Compose</p>
				<h2>{data.replyTo ? 'Reply on ActivityPub' : 'Publish a local note'}</h2>
			</div>
		</div>

		<form method="POST" enctype="multipart/form-data" class="admin-compose-form">
			{#if data.replyTo}
				<label class="admin-field">
					<span>Replying to</span>
					<input name="replyTo" type="url" value={form?.replyTo || data.replyTo} readonly />
				</label>
			{:else}
				<input name="replyTo" type="hidden" value="" />
			{/if}

			<label class="admin-field">
				<span>Content</span>
				<textarea
					name="content"
					rows="10"
					placeholder={data.replyTo ? 'Write your reply…' : 'Write a note to federate to your followers…'}
				>{form?.content || ''}</textarea>
			</label>

			<label class="admin-field">
				<span>Photos</span>
				<input name="images" type="file" accept="image/*" multiple />
			</label>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<div class="admin-form-actions">
				<button class="admin-button" type="submit">
					{data.replyTo ? 'Publish reply' : 'Publish note'}
				</button>
			</div>
		</form>
	</div>
</section>
