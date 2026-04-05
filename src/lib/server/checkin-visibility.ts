import type { Checkin } from '$lib/server/atproto';

export function isPublicCheckin(checkin: Checkin | null | undefined) {
	return Boolean(checkin && checkin.visibility !== 'private');
}

export function filterPublicCheckins(checkins: Checkin[]) {
	return checkins.filter(isPublicCheckin);
}
