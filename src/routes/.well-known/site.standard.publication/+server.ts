import { error } from '@sveltejs/kit';
import { getStandardSitePublicationAtUri } from '$lib/server/standard-site';

export async function GET() {
	const publicationAtUri = await getStandardSitePublicationAtUri();

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
