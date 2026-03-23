# ActivityPub D1 Setup

This repo is prepared to use a Cloudflare D1 database for ActivityPub follower storage.

## 1. Create the database

In Cloudflare, create a D1 database. Your current setup uses:

- binding: `D1_DATABASE_BINDING`
- database name: `d1-database`

You can do this in the dashboard or with Wrangler:

```bash
npx wrangler d1 create d1-database
```

Cloudflare will return a `database_id`.

## 2. Add the binding

In [wrangler.jsonc](/Users/bryanrobb/Git/afterword-sveltekit-pds/wrangler.jsonc), uncomment the `d1_databases` block and paste the real `database_id`.

Binding name:

- `D1_DATABASE_BINDING`

## 3. Apply the schema

Run:

```bash
npx wrangler d1 execute d1-database --remote --file migrations/0001_activitypub_followers.sql
```

This creates:

- `ap_followers`

## 4. What it is for

The first intended use is:

- storing accepted ActivityPub followers
- later tracking outbound delivery attempts for blog post federation

Current code helpers live in:

- [src/lib/server/followers.ts](/Users/bryanrobb/Git/afterword-sveltekit-pds/src/lib/server/followers.ts)
