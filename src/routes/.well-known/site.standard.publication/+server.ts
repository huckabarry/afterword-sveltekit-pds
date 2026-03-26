import { error } from '@sveltejs/kit';
import { getStandardSitePublicationAtUri } from '$lib/server/standard-site';

export async function GET(event) {
	const publicationAtUri = await getStandardSitePublicationAtUri(event);

	if (!publicationAtUri) {
		throw error(404, 'Standard Site publication is not configured');
	}

	return new Response(publicationAtUri, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
