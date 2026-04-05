import { fail } from '@sveltejs/kit';
import { requireAdminSession } from '$lib/server/admin';
import { getCmsPageBySlug, listCmsPages, updateCmsPage } from '$lib/server/site-cms';
import type { Actions, PageServerLoad } from './$types';

const DEFAULT_PAGE_SLUG = 'hello';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	const pages = await listCmsPages(event);
	const selectedSlug = String(event.url.searchParams.get('slug') || DEFAULT_PAGE_SLUG).trim().toLowerCase();
	const selectedPage =
		(await getCmsPageBySlug(event, selectedSlug)) || pages.find((page) => page.slug === DEFAULT_PAGE_SLUG) || pages[0] || null;

	return {
		pages,
		selectedSlug: selectedPage?.slug || DEFAULT_PAGE_SLUG,
		selectedPage
	};
};

export const actions: Actions = {
	default: async (event) => {
		await requireAdminSession(event);

		const form = await event.request.formData();
		const slug = String(form.get('slug') || '').trim().toLowerCase();
		const title = String(form.get('title') || '').trim();
		const description = String(form.get('description') || '').trim();
		const body = String(form.get('body') || '').trim();

		if (!slug || !title || !body) {
			return fail(400, {
				error: 'Slug, title, and body are required.',
				slug,
				title,
				description,
				body
			});
		}

		const page = await updateCmsPage(event, {
			slug,
			title,
			description,
			body
		});

		return {
			success: true,
			selectedSlug: page.slug,
			selectedPage: page
		};
	}
};
