import { json } from '@sveltejs/kit';
import { requireAdminAccess } from '$lib/server/admin';
import { getBlogPostBySlug } from '$lib/server/ghost';
import { getSiteProfile } from '$lib/server/profile';
import { syncGhostPostToStandardSite } from '$lib/server/standard-site';

export async function POST(event) {
	await requireAdminAccess(event);

	const body = await event.request.json().catch(() => null);
	const slug = String(body?.slug || '').trim();

	if (!slug) {
		return json({ ok: false, error: 'A Ghost post slug is required.' }, { status: 400 });
	}

	const [profile, post] = await Promise.all([getSiteProfile(event), getBlogPostBySlug(slug)]);

	if (!post) {
		return json({ ok: false, error: 'Ghost post not found.', slug }, { status: 404 });
	}

	try {
		const result = await syncGhostPostToStandardSite(event, post, profile);
		return json({
			ok: true,
			slug,
			title: post.title,
			uri: result.uri
		});
	} catch (error) {
		return json(
			{
				ok: false,
				slug,
				title: post.title,
				error: error instanceof Error ? error.message : 'Unable to sync Ghost post.'
			},
			{ status: 500 }
		);
	}
}
