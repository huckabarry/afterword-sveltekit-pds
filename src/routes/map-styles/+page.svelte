<script lang="ts">
	import { onMount } from 'svelte';
	import type { Checkin } from '$lib/server/atproto';

	type MapStyle = {
		id: string;
		name: string;
		note: string;
		attribution: string;
		url: string;
	};

	let { data }: { data: { item: Checkin | null } } = $props();

	const styles: MapStyle[] = [
		{
			id: 'osm',
			name: 'OpenStreetMap Standard',
			note: 'The simple default you are using now, but as a styled interactive map.',
			url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
			attribution: '&copy; OpenStreetMap contributors'
		},
		{
			id: 'positron',
			name: 'Carto Positron',
			note: 'Clean, light, editorial, and probably the safest elegant choice.',
			url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
			attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
		},
		{
			id: 'voyager',
			name: 'Carto Voyager',
			note: 'A little richer and more colorful, but still restrained.',
			url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
			attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
		},
		{
			id: 'topo',
			name: 'OpenTopoMap',
			note: 'Terrain-forward and outdoorsy.',
			url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
			attribution: '&copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
		},
		{
			id: 'esri',
			name: 'Esri World Street Map',
			note: 'Polished and familiar, but a little less personal-web feeling.',
			url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
			attribution: 'Tiles &copy; Esri'
		}
	];

	let mapElements = $state<Record<string, HTMLDivElement | null>>({});

	onMount(() => {
		const item = data.item;
		if (!item?.latitude || !item?.longitude) return;
		const latitude = item.latitude;
		const longitude = item.longitude;

		let cancelled = false;
		let maps: Array<any> = [];

		async function boot() {
			const leaflet = await loadLeaflet();
			if (!leaflet || cancelled) return;

			for (const style of styles) {
				const element = mapElements[style.id];
				if (!element) continue;

				const map = leaflet.map(element, {
					scrollWheelZoom: false,
					zoomControl: true
				}).setView([latitude, longitude], 14);

				leaflet
					.tileLayer(style.url, {
						attribution: style.attribution,
						maxZoom: 19
					})
					.addTo(map);

				leaflet
					.circleMarker([latitude, longitude], {
						radius: 7,
						weight: 2,
						color: '#f4f3ac',
						fillColor: '#f4f3ac',
						fillOpacity: 0.95
					})
					.addTo(map);

				maps.push(map);
			}
		}

		boot();

		return () => {
			cancelled = true;
			for (const map of maps) {
				map.remove();
			}
		};
	});

	async function loadLeaflet() {
		if (typeof window === 'undefined') return null;
		const existing = (window as Window & { L?: any }).L;
		if (existing) return existing;

		await ensureStyle(
			'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
			'leaflet-css'
		);
		await ensureScript(
			'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
			'leaflet-js'
		);

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

<svelte:head>
	<title>Map Styles | Bryan Robb</title>
</svelte:head>

<section class="section-block">
	<h1 class="section-title">Map Style Comparison</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body">
				<p>
					These previews all use the same current check-in location so you can compare the map
					style itself rather than the place.
				</p>
				{#if data.item}
					<p>
						Using <strong>{data.item.name}</strong>
						{#if data.item.place}
							in {data.item.place}
						{/if}
						as the sample.
					</p>
				{/if}
			</section>
		</div>
	</article>
</section>

{#if data.item?.latitude && data.item?.longitude}
	<section class="map-style-grid">
		{#each styles as style}
			<article class="map-style-card">
				<div class="map-style-card__head">
					<h2 class="map-style-card__title">{style.name}</h2>
					<p class="map-style-card__note">{style.note}</p>
				</div>
				<div
					class="map-style-card__map"
					bind:this={mapElements[style.id]}
					aria-label={`${style.name} map preview`}
				></div>
			</article>
		{/each}
	</section>
{:else}
	<p class="empty-state">No check-in with public coordinates is available right now.</p>
{/if}

<style>
	.map-style-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}

	.map-style-card {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.map-style-card__head {
		margin-bottom: 0.75rem;
	}

	.map-style-card__title {
		margin: 0;
		font-size: 1.15rem;
	}

	.map-style-card__note {
		margin: 0.3rem 0 0;
		color: var(--muted);
	}

	.map-style-card__map {
		height: 19rem;
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		overflow: hidden;
		background: var(--surface);
	}

	:global(.leaflet-container) {
		font-family: inherit;
	}

	@media (max-width: 760px) {
		.map-style-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
