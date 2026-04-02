function sanitizeSegment(value: string) {
	return (
		String(value || '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'item'
	);
}

function inferExtensionFromUrl(imageUrl: string) {
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

function hashString(value: string) {
	let hash = 0x811c9dc5;

	for (const character of String(value || '')) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(36);
}

function buildContentCoverKey(sourceUrl: string, hint = 'cover') {
	const extension = inferExtensionFromUrl(sourceUrl);
	return `content-covers/originals/${sanitizeSegment(hint)}-${hashString(sourceUrl)}.${extension}`;
}

function buildVariantPath(
	key: string,
	preset: 'card-sm' | 'card-md' | 'card-lg' | 'feature',
	sourceUrl: string
) {
	return `/${['media-cover-images', preset, ...key.split('/').filter(Boolean)].join('/')}?src=${encodeURIComponent(sourceUrl)}`;
}

export function getResponsiveContentCover(
	sourceUrl: string | null | undefined,
	hint = 'cover'
) {
	const normalized = String(sourceUrl || '').trim();

	if (!normalized) {
		return null;
	}

	const key = buildContentCoverKey(normalized, hint);
	const src320 = buildVariantPath(key, 'card-sm', normalized);
	const src640 = buildVariantPath(key, 'card-md', normalized);
	const src1080 = buildVariantPath(key, 'card-lg', normalized);

	return {
		src: src640,
		srcset: `${src320} 360w, ${src640} 720w, ${src1080} 1080w`
	};
}

export function getFeatureContentCover(
	sourceUrl: string | null | undefined,
	hint = 'feature'
) {
	const normalized = String(sourceUrl || '').trim();

	if (!normalized) {
		return null;
	}

	const key = buildContentCoverKey(normalized, hint);
	const src720 = buildVariantPath(key, 'card-md', normalized);
	const src1080 = buildVariantPath(key, 'card-lg', normalized);
	const src1600 = buildVariantPath(key, 'feature', normalized);

	return {
		src: src1080,
		srcset: `${src720} 720w, ${src1080} 1080w, ${src1600} 1600w`
	};
}
