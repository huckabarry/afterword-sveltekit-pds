export function shouldSurfaceEarlierWebTitle(post: {
	title: string;
	excerpt: string;
	bodyTextLength: number;
}) {
	if (Number(post.bodyTextLength || 0) < 500) {
		return false;
	}

	const title = post.title.trim().toLowerCase();
	const excerpt = post.excerpt.trim().toLowerCase();

	if (!title || !excerpt) {
		return false;
	}

	return !(title === excerpt || excerpt.startsWith(title) || title.startsWith(excerpt));
}
