<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 20 20"
	fill="none"
	aria-hidden="true"
	class={className}
>
	<path
		d="M7.25 15.25 3 11m0 0 4.25-4.25M3 11h14"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>

<style>
	svg {
		width: 1em;
		height: 1em;
		display: block;
	}
</style>
