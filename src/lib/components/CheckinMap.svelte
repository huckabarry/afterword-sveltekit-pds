<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';

	let {
		latitude,
		longitude,
		name,
		compact = false,
		variant = 'default'
	}: {
		latitude: number | null;
		longitude: number | null;
		name: string;
		compact?: boolean;
		variant?: 'default' | 'preview';
	} = $props();

	let mapEl = $state<HTMLDivElement | null>(null);

	onMount(() => {
		if (!mapEl || latitude === null || longitude === null) return;
		const lat = latitude;
		const lng = longitude;

		let map: any;
		let cancelled = false;
		let resizeObserver: ResizeObserver | null = null;

		function refreshSize() {
			if (!map || cancelled) return;

			requestAnimationFrame(() => {
				if (!map || cancelled) return;
				map.invalidateSize(false);
			});
		}

		async function boot() {
			const { default: leaflet } = await import('leaflet');
			if (!leaflet || cancelled || !mapEl) return;
			const isPreview = variant === 'preview';
			const tileUrl = isPreview
				? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
				: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

			map = leaflet.map(mapEl, {
				scrollWheelZoom: false,
				zoomControl: !compact && !isPreview,
				dragging: !compact && !isPreview,
				touchZoom: !compact && !isPreview,
				doubleClickZoom: !compact && !isPreview,
				boxZoom: !compact && !isPreview,
				keyboard: !compact && !isPreview,
				attributionControl: !compact && !isPreview,
				tapHold: !compact && !isPreview,
				zoomAnimation: !compact,
				fadeAnimation: !compact,
				markerZoomAnimation: !compact
			}).setView([lat, lng], compact ? 15 : 16);

			leaflet
				.tileLayer(tileUrl, {
					attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
					maxZoom: 19
				})
				.addTo(map);

			const marker = leaflet.marker([lat, lng], {
					icon: leaflet.divIcon({
						className: 'afterword-map-pin-wrapper',
						html: '<span class="afterword-map-pin"></span>',
						iconSize: [24, 24],
						iconAnchor: [12, 24],
						popupAnchor: [0, -20]
					})
				}).addTo(map);

			if (!isPreview) {
				marker.bindTooltip(name, {
					direction: 'top',
					permanent: false
				});
			}

			refreshSize();
			window.setTimeout(refreshSize, 120);
			window.setTimeout(refreshSize, 320);

			if (typeof ResizeObserver !== 'undefined') {
				resizeObserver = new ResizeObserver(() => refreshSize());
				resizeObserver.observe(mapEl);
			}
		}

		boot();

		return () => {
			cancelled = true;
			resizeObserver?.disconnect();
			if (map) map.remove();
		};
	});
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
