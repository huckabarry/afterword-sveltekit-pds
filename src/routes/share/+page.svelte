<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Share to Afterword</title>
</svelte:head>

<section class="stack-lg share-target">
	<div class="section-heading">
		<p class="section-kicker">Share Target</p>
		<h1>Post to Afterword</h1>
		<p class="section-description">
			This page accepts shared text from apps like Micro.blog and publishes it as a local
			ActivityPub note on your site.
		</p>
	</div>

	<form class="stack-md card-form share-card" method="POST">
		<label class="stack-xs" for="share-content">
			<span>Post text</span>
			<textarea id="share-content" name="content" rows="8" required>{form?.content ?? data.prefill ?? ''}</textarea>
		</label>

		{#if !(form?.loggedIn ?? data.loggedIn ?? false)}
			<label class="stack-xs" for="share-password">
				<span>Admin password</span>
				<input id="share-password" name="password" type="password" autocomplete="current-password" />
			</label>
		{/if}

		{#if form?.error}
			<p class="form-error">{form.error}</p>
		{/if}

		<div class="share-actions">
			<button class="button-primary" type="submit">Publish to ActivityPub</button>
		</div>
	</form>
</section>
