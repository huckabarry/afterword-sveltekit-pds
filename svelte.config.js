import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		// `/webmention` must accept cross-origin form posts, which requires disabling SvelteKit's
		// global Origin check. We re-apply CSRF protection in `src/hooks.server.ts` for sensitive
		// same-origin form routes like admin actions and uploads.
		csrf: {
			trustedOrigins: ['*']
		}
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
