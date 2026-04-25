export function sanitizeAssetSegment(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'item'
	);
}

export function inferImageExtensionFromUrl(imageUrl: string) {
	try {
		const pathname = new URL(imageUrl).pathname;
		const ext = pathname.split('.').pop()?.toLowerCase() || '';

		if (/^(avif|gif|jpe?g|png|svg|webp)$/i.test(ext)) {
			return ext === 'jpeg' ? 'jpg' : ext;
		}
	} catch {
		// ignore malformed URLs and fall through
	}

	return 'jpg';
}

export function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (const character of String(value || '')) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(36);
}

export function isSameOriginOrRelativeUrl(imageUrl: string, origin: string) {
	const normalized = String(imageUrl || '').trim();

	if (!normalized) {
		return true;
	}

	if (normalized.startsWith('/')) {
		return true;
	}

	try {
		return new URL(normalized).origin === origin;
	} catch {
		return true;
	}
}

export function buildVariantPath(
	baseSegment: string,
	preset: string,
	assetKey: string,
	sourceUrl?: string | null
) {
	const pathname = `/${[baseSegment, preset, ...assetKey.split('/').filter(Boolean)].join('/')}`;
	const normalizedSourceUrl = String(sourceUrl || '').trim();

	return normalizedSourceUrl
		? `${pathname}?src=${encodeURIComponent(normalizedSourceUrl)}`
		: pathname;
}
