<script lang="ts">
	import { onMount } from 'svelte';

	let {
		latitude,
		longitude,
		name,
		compact = false
	}: {
		latitude: number | null;
		longitude: number | null;
		name: string;
		compact?: boolean;
	} = $props();

	let mapEl = $state<HTMLDivElement | null>(null);

	onMount(() => {
		if (!mapEl || latitude === null || longitude === null) return;

		let map: any;
		let cancelled = false;

		async function boot() {
			const leaflet = await loadLeaflet();
			if (!leaflet || cancelled || !mapEl) return;

			map = leaflet.map(mapEl, {
				scrollWheelZoom: false,
				zoomControl: true
			}).setView([latitude, longitude], compact ? 15 : 16);

			leaflet
				.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
					attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
					maxZoom: 19
				})
				.addTo(map);

			leaflet
				.marker([latitude, longitude], {
					icon: leaflet.divIcon({
						className: 'afterword-map-pin-wrapper',
						html: '<span class="afterword-map-pin"></span>',
						iconSize: [24, 24],
						iconAnchor: [12, 24],
						popupAnchor: [0, -20]
					})
				})
				.addTo(map)
				.bindTooltip(name, {
					direction: 'top'
				});
		}

		boot();

		return () => {
			cancelled = true;
			if (map) map.remove();
		};
	});

	async function loadLeaflet() {
		if (typeof window === 'undefined') return null;
		const existing = (window as Window & { L?: any }).L;
		if (existing) return existing;

		await ensureStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'leaflet-css');
		await ensureScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'leaflet-js');

		return (window as Window & { L?: any }).L || null;
	}

	function ensureStyle(href: string, id: string) {
		return new Promise<void>((resolve, reject) => {
			if (document.getElementById(id)) {
				resolve();
				return;
			}

			const link = document.createElement('link');
			link.id = id;
			link.rel = 'stylesheet';
			link.href = href;
			link.onload = () => resolve();
			link.onerror = () => reject(new Error(`Unable to load ${href}`));
			document.head.appendChild(link);
		});
	}

	function ensureScript(src: string, id: string) {
		return new Promise<void>((resolve, reject) => {
			if (document.getElementById(id)) {
				resolve();
				return;
			}

			const script = document.createElement('script');
			script.id = id;
			script.src = src;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Unable to load ${src}`));
			document.head.appendChild(script);
		});
	}
</script>

<div
	bind:this={mapEl}
	class={`checkin-map__frame checkin-map__frame--leaflet ${compact ? 'checkin-map__frame--compact' : ''}`}
	aria-label={`Map showing ${name}`}
></div>

<style>
	:global(.leaflet-container) {
		font-family: inherit;
	}

	:global(.afterword-map-pin-wrapper) {
		background: transparent;
		border: 0;
	}

	:global(.afterword-map-pin) {
		display: block;
		width: 22px;
		height: 22px;
		background: #f4f3ac;
		border: 2px solid #202123;
		border-radius: 50% 50% 50% 0;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
		transform: rotate(-45deg);
	}

	:global(.afterword-map-pin::after) {
		content: '';
		position: absolute;
		width: 8px;
		height: 8px;
		top: 5px;
		left: 5px;
		background: rgba(32, 33, 35, 0.22);
		border-radius: 50%;
	}
</style>
