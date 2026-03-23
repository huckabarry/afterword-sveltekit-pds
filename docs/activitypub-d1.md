# ActivityPub D1 Setup

This repo is prepared to use a Cloudflare D1 database for ActivityPub follower storage and outbound delivery tracking.

## 1. Create the database

In Cloudflare, create a D1 database. Your current setup uses:

- binding: `D1_DATABASE`
- database name: `d1-database`

You can do this in the dashboard or with Wrangler:

```bash
npx wrangler d1 create d1-database
```

Cloudflare will return a `database_id`.

## 2. Add the binding

In [wrangler.jsonc](/Users/bryanrobb/Git/afterword-sveltekit-pds/wrangler.jsonc), uncomment the `d1_databases` block and paste the real `database_id`.

Binding name:

- `D1_DATABASE`

## 3. Apply the schema

Run:

```bash
npx wrangler d1 execute d1-database --remote --file migrations/0001_activitypub_followers.sql
npx wrangler d1 execute d1-database --remote --file migrations/0002_activitypub_deliveries.sql
```

This creates:

- `ap_followers`
- `ap_deliveries`

## 4. What it is for

The first intended use is:

- storing accepted ActivityPub followers
- tracking outbound delivery attempts for blog post federation

Current code helpers live in:

- [src/lib/server/followers.ts](/Users/bryanrobb/Git/afterword-sveltekit-pds/src/lib/server/followers.ts)

## 5. Add ActivityPub signing keys

To send signed `Accept` activities and later signed post delivery, add these Cloudflare secrets:

- `ACTIVITYPUB_PRIVATE_KEY_PEM`
- `ACTIVITYPUB_PUBLIC_KEY_PEM`

Optional:

- `ACTIVITYPUB_KEY_ID`

If `ACTIVITYPUB_KEY_ID` is omitted, the app uses:

- `https://afterword.blog/ap/actor#main-key`

The actor endpoint will expose the public key when `ACTIVITYPUB_PUBLIC_KEY_PEM` is present.

## 6. Manual delivery trigger

To manually deliver a blog post to current followers, add this Cloudflare secret:

- `ACTIVITYPUB_DELIVERY_TOKEN`

Then call:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://afterword.blog/ap/admin/deliver/YOUR-BLOG-SLUG
```

This will:

- generate a `Create` activity for the blog post
- send it to each follower inbox/sharedInbox
- record delivery status in `ap_deliveries`

To deliver only the most recent posts that have not yet been delivered to each follower, call:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "https://afterword.blog/ap/admin/deliver-missing?limit=5"
```

This will:

- scan the latest `limit` blog posts
- skip follower/post pairs already marked as delivered
- only send missing deliveries
- record new delivery attempts in `ap_deliveries`

## 7. Automate delivery with GitHub Actions

This repo includes a scheduled workflow:

- [.github/workflows/activitypub-delivery.yml](/Users/bryanrobb/Git/afterword-sveltekit-pds/.github/workflows/activitypub-delivery.yml)

It runs hourly and calls:

- `POST https://afterword.blog/ap/admin/deliver-missing?limit=10`

To enable it, add this GitHub Actions repository secret:

- `ACTIVITYPUB_DELIVERY_TOKEN`

Use the same token value you added to Cloudflare.

You can also run it manually from the GitHub Actions tab with `workflow_dispatch`.
