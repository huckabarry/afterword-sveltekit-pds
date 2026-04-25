export type TimelineLink = {
	label: string;
	url: string;
	external?: boolean;
};

export type MediaTimelineKind = 'track' | 'album' | 'popfeed';
export type MediaTimelineMediaType = 'book' | 'movie' | 'tv_show';

type BaseMediaTimelineItem = {
	id: string;
	kind: MediaTimelineKind;
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
	mediaType: MediaTimelineMediaType;
	statusLabel: string;
	activityLabel: string;
};

export type MediaTimelineItem = TrackTimelineItem | AlbumTimelineItem | PopfeedTimelineItem;

export type MediaTimelineFilters = {
	kinds?: MediaTimelineKind[];
	mediaTypes?: MediaTimelineMediaType[];
};

export type MediaTimelinePage = {
	items: MediaTimelineItem[];
	offset: number;
	limit: number;
	total: number;
	nextOffset: number | null;
	generatedAt: string | null;
	filters?: MediaTimelineFilters;
};
