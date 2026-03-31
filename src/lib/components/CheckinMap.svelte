<script lang="ts">
	import { onMount } from 'svelte';

	type LeafletWindow = Window & {
		L?: any;
		__afterwordLeafletStylePromise?: Promise<void>;
		__afterwordLeafletScriptPromise?: Promise<void>;
	};

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
		let resizeObserver: ResizeObserver | null = null;

		function refreshSize() {
			if (!map || cancelled) return;

			requestAnimationFrame(() => {
				if (!map || cancelled) return;
				map.invalidateSize(false);
			});
		}

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

	async function loadLeaflet() {
		if (typeof window === 'undefined') return null;
		const scope = window as LeafletWindow;
		const existing = scope.L;
		if (existing) return existing;

		scope.__afterwordLeafletStylePromise ||= ensureStyle(
			'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
			'leaflet-css'
		);
		scope.__afterwordLeafletScriptPromise ||= ensureScript(
			'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
			'leaflet-js'
		);

		await scope.__afterwordLeafletStylePromise;
		await scope.__afterwordLeafletScriptPromise;

		return scope.L || null;
	}

	function ensureStyle(href: string, id: string) {
		return new Promise<void>((resolve, reject) => {
			const existing = document.getElementById(id) as HTMLLinkElement | null;
			if (existing) {
				if (existing.dataset.loaded === 'true' || hasLoadedStylesheet(href)) {
					existing.dataset.loaded = 'true';
					resolve();
					return;
				}

				const cleanup = attachLoadListeners(existing, resolve, reject, href);
				return cleanup;
			}

			const link = document.createElement('link');
			link.id = id;
			link.rel = 'stylesheet';
			link.href = href;
			const cleanup = attachLoadListeners(link, resolve, reject, href);
			document.head.appendChild(link);
			return cleanup;
		});
	}

	function ensureScript(src: string, id: string) {
		return new Promise<void>((resolve, reject) => {
			const existing = document.getElementById(id) as HTMLScriptElement | null;
			if (existing) {
				if (existing.dataset.loaded === 'true') {
					resolve();
					return;
				}

				const cleanup = attachLoadListeners(existing, resolve, reject, src);
				return cleanup;
			}

			const script = document.createElement('script');
			script.id = id;
			script.src = src;
			script.async = true;
			const cleanup = attachLoadListeners(script, resolve, reject, src);
			document.head.appendChild(script);
			return cleanup;
		});
	}

	function attachLoadListeners(
		node: HTMLLinkElement | HTMLScriptElement,
		resolve: () => void,
		reject: (error: Error) => void,
		resource: string
	) {
		const handleLoad = () => {
			node.dataset.loaded = 'true';
			node.removeEventListener('load', handleLoad);
			node.removeEventListener('error', handleError);
			resolve();
		};
		const handleError = () => {
			node.removeEventListener('load', handleLoad);
			node.removeEventListener('error', handleError);
			reject(new Error(`Unable to load ${resource}`));
		};

		node.addEventListener('load', handleLoad, { once: true });
		node.addEventListener('error', handleError, { once: true });
	}

	function hasLoadedStylesheet(href: string) {
		const resolvedHref = new URL(href, document.baseURI).href;
		return Array.from(document.styleSheets).some((sheet) => {
			try {
				return sheet.href === resolvedHref;
			} catch {
				return false;
			}
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
