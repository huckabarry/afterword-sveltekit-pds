import { fail } from '@sveltejs/kit';
import { requireAdminSession } from '$lib/server/admin';
import { getCmsNavigation, updateCmsNavigation, type CmsLink } from '$lib/server/site-cms';
import type { Actions, PageServerLoad } from './$types';

function parseLinksInput(value: string) {
	try {
		const parsed = JSON.parse(value) as Array<{ label?: string; href?: string }>;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((item) => ({
				label: String(item?.label || '').trim(),
				href: String(item?.href || '').trim()
			}))
			.filter((item): item is CmsLink => Boolean(item.label && item.href));
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async (event) => {
	await requireAdminSession(event);

	return {
		navigation: await getCmsNavigation(event)
	};
};

export const actions: Actions = {
	default: async (event) => {
		await requireAdminSession(event);

		const form = await event.request.formData();
		const primaryInput = String(form.get('primaryLinks') || '[]');
		const secondaryInput = String(form.get('secondaryLinks') || '[]');
		const footerInput = String(form.get('footerLinks') || '[]');

		const navigation = {
			primary: parseLinksInput(primaryInput),
			secondary: parseLinksInput(secondaryInput),
			footer: parseLinksInput(footerInput)
		};

		if (!navigation.primary.length) {
			return fail(400, {
				error: 'Primary navigation needs at least one link.',
				navigation
			});
		}

		const saved = await updateCmsNavigation(event, navigation);

		return {
			success: true,
			navigation: saved
		};
	}
};
