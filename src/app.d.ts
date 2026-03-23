// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Env {
		AP_DB?: D1Database;
		D1_DATABASE_BINDING?: D1Database;
		ACTIVITYPUB_PRIVATE_KEY_PEM?: string;
		ACTIVITYPUB_PUBLIC_KEY_PEM?: string;
		ACTIVITYPUB_KEY_ID?: string;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
