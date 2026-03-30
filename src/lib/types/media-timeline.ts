export type TimelineLink = {
	label: string;
	url: string;
	external?: boolean;
};

type BaseMediaTimelineItem = {
	id: string;
	kind: 'track' | 'album' | 'popfeed';
	label: string;
	title: string;
	href: string;
	dateIso: string;
	dateLabel: string;
	summary: string;
	imageUrl: string | null;
	fallbackImageUrl?: string | null;
	imageAlt: string;
	tags: string[];
};

export type TrackTimelineItem = BaseMediaTimelineItem & {
	kind: 'track';
	artist: string;
	audioUrl: string | null;
	links: TimelineLink[];
};

export type AlbumTimelineItem = BaseMediaTimelineItem & {
	kind: 'album';
	artist: string;
	links: TimelineLink[];
};

export type PopfeedTimelineItem = BaseMediaTimelineItem & {
	kind: 'popfeed';
	credit: string;
	links: TimelineLink[];
	mediaType: 'book' | 'movie' | 'tv_show';
	statusLabel: string;
	activityLabel: string;
};

export type MediaTimelineItem =
	| TrackTimelineItem
	| AlbumTimelineItem
	| PopfeedTimelineItem;

export type MediaTimelinePage = {
	items: MediaTimelineItem[];
	offset: number;
	limit: number;
	total: number;
	nextOffset: number | null;
};
