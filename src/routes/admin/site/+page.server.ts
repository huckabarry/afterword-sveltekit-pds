import { fail } from '@sveltejs/kit';
import { requireAdminSession } from '$lib/server/admin';
import { getCmsSiteSettings, updateCmsSiteSettings } from '$lib/server/site-cms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	return {
		settings: await getCmsSiteSettings(event)
	};
};

export const actions: Actions = {
	default: async (event) => {
		await requireAdminSession(event);

		const form = await event.request.formData();
		const siteTitle = String(form.get('siteTitle') || '').trim();
		const siteTagline = String(form.get('siteTagline') || '').trim();
		const footerTagline = String(form.get('footerTagline') || '').trim();
		const searchPlaceholder = String(form.get('searchPlaceholder') || '').trim();

		if (!siteTitle || !siteTagline || !footerTagline) {
			return fail(400, {
				error: 'Site title, site tagline, and footer tagline are required.',
				siteTitle,
				siteTagline,
				footerTagline,
				searchPlaceholder
			});
		}

		const settings = await updateCmsSiteSettings(event, {
			siteTitle,
			siteTagline,
			footerTagline,
			searchPlaceholder
		});

		return {
			success: true,
			...settings
		};
	}
};
