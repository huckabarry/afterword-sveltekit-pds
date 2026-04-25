export function normalizeString(value: unknown) {
	return String(value || '').trim();
}

export function normalizeOptionalString(value: unknown) {
	const normalized = normalizeString(value);
	return normalized || null;
}

export function normalizeDate(value: unknown) {
	const normalized = normalizeString(value);

	if (!normalized) {
		return null;
	}

	const parsed = new Date(normalized);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDisplayDate(date: Date) {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

export function getRecordKey(uri: string | undefined | null) {
	return (
		String(uri || '')
			.split('/')
			.pop() || ''
	);
}

export function getBlobUrl(serviceUrl: string, did: string, cid: string) {
	return `${serviceUrl}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}
