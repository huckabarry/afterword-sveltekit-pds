// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Env {
		AP_DB?: D1Database;
		D1_DATABASE?: D1Database;
		D1_DATABASE_BINDING?: D1Database;
		R2_BUCKET?: R2Bucket;
		ACTIVITYPUB_PRIVATE_KEY_PEM?: string;
		ACTIVITYPUB_PUBLIC_KEY_PEM?: string;
		ACTIVITYPUB_KEY_ID?: string;
		ACTIVITYPUB_ALSO_KNOWN_AS?: string;
		ADMIN_API_TOKEN?: string;
		ACTIVITYPUB_DELIVERY_TOKEN?: string;
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
