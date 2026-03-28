<script lang="ts">
	let { form } = $props();
</script>

<section class="admin-login">
	<div class="admin-login__card">
		<p class="admin-eyebrow">Private</p>
		<h1 class="admin-login__title">Afterword admin</h1>
		<p class="admin-login__intro">
			A small back room for publishing, profile updates, images, and site upkeep.
		</p>

		<form class="admin-login__form" method="POST">
			<label class="admin-field">
				<span>Password</span>
				<input name="password" type="password" autocomplete="current-password" />
			</label>

			{#if form?.error}
				<p class="admin-form-error">{form.error}</p>
			{/if}

			<button class="admin-button" type="submit">Enter admin</button>
		</form>
	</div>
</section>
