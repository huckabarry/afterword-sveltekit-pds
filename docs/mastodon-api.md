# Mastodon API Compatibility

This repo includes a minimal Mastodon-compatible API layer for connecting a client and posting plain text statuses.

Current scope:

- `POST /api/v1/apps`
- `GET|POST /oauth/authorize`
- `POST /oauth/token`
- `GET /api/v1/accounts/verify_credentials`
- `GET /api/v1/instance`
- `GET /api/v2/instance`
- `POST /api/v1/statuses`

## Required Cloudflare variables

- `MASTODON_ADMIN_PASSWORD`
- `ATPROTO_APP_PASSWORD`

Recommended:

- `ATPROTO_PUBLISH_HANDLE=afterword.blog`
- `ATPROTO_PDS_URL=https://bsky.social`
- `MASTODON_INSTANCE_TITLE=Afterword`

## D1 migration

Run:

```bash
npx wrangler d1 execute d1-database --remote --file migrations/0005_mastodon_oauth.sql
```

This creates:

- `mastodon_apps`
- `mastodon_auth_codes`
- `mastodon_access_tokens`

## Notes

This is intentionally minimal.

Supported now:

- one-user authorization via a password form
- client app registration
- bearer tokens
- posting plain text statuses into ATProto/Bluesky

Not yet supported:

- editing statuses
- media uploads
- timelines
- notifications
- replies
- polls
- full Mastodon compatibility
