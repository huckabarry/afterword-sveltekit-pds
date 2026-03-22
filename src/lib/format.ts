export function formatDate(value: string | Date) {
	const date = value instanceof Date ? value : new Date(value);

	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(date);
}

export function excerpt(value: string, maxLength = 180) {
	const normalized = String(value || '').trim().replace(/\s+/g, ' ');

	if (!normalized || normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength).trimEnd()}…`;
}
