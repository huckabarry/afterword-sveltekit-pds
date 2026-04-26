import type { RequestEvent } from '@sveltejs/kit';
import { getStatusSnapshotPage } from '$lib/server/status-snapshot';
import { attachMediaCoverDelivery } from '$lib/server/media-cover-delivery';
import { getMediaTimelinePage } from '$lib/server/media-timeline';
import { type Checkin, type StatusPost } from '$lib/server/atproto';
import { filterPublicCheckins } from '$lib/server/checkin-visibility';
import { getCheckinsSnapshot } from '$lib/server/checkins-snapshot';
import type { MediaTimelineItem } from '$lib/types/media-timeline';

export type ActivityFeedStatusItem = {
	type: 'status';
	id: string;
	dateIso: string;
	dateValue: number;
	dateLabel: string;
	post: StatusPost;
};

export type ActivityFeedMediaItem = {
	type: 'media';
	id: string;
	dateIso: string;
	dateValue: number;
	dateLabel: string;
	item: MediaTimelineItem;
};

export type ActivityFeedCheckinItem = {
	type: 'checkin';
	id: string;
	dateIso: string;
	dateValue: number;
	dateLabel: string;
	checkin: Checkin;
};

export type ActivityFeedItem = ActivityFeedStatusItem | ActivityFeedMediaItem | ActivityFeedCheckinItem;

export async function getActivityFeed(event: RequestEvent, limit = 28): Promise<ActivityFeedItem[]> {
	const sourceLimit = Math.max(limit, 24);

	const [statusPage, mediaPage, checkins] = await Promise.all([
		getStatusSnapshotPage({ platform: event.platform }),
		getMediaTimelinePage(event, 0, sourceLimit),
		getCheckinsSnapshot(event)
	]);

	const mediaItems = attachMediaCoverDelivery(mediaPage, event).items;
	const publicCheckins = filterPublicCheckins(checkins).slice(0, sourceLimit);
	const publicStatuses = statusPage.statuses.filter((post) => !post.replyTo && !post.isReply);

	const merged: ActivityFeedItem[] = [
		...publicStatuses.map((post) => ({
			type: 'status' as const,
			id: `status-${post.id}`,
			dateIso: post.date.toISOString(),
			dateValue: post.date.getTime(),
			dateLabel: post.date.toISOString(),
			post
		})),
		...mediaItems.map((item) => ({
			type: 'media' as const,
			id: item.id,
			dateIso: item.dateIso,
			dateValue: Date.parse(item.dateIso),
			dateLabel: item.dateLabel,
			item
		})),
		...publicCheckins.map((checkin) => ({
			type: 'checkin' as const,
			id: `checkin-${checkin.id}`,
			dateIso: checkin.visitedAt.toISOString(),
			dateValue: checkin.visitedAt.getTime(),
			dateLabel: checkin.visitedAt.toISOString(),
			checkin
		}))
	]
		.sort((left, right) => right.dateValue - left.dateValue)
		.slice(0, limit);

	return merged;
}
