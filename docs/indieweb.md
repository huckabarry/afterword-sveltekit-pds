# IndieWeb Support

This site now includes:

- microformats2 markup on the site identity, blog posts, and status entries
- a receive-only Webmention endpoint at `/webmention`

## Webmention endpoint

Discovery is published in the page head with:

- `rel="webmention"`

Endpoint:

- `https://afterword.blog/webmention`

Accepted request format:

- `POST application/x-www-form-urlencoded`
- fields:
  - `source`
  - `target`

Current behavior:

- verifies the `target` belongs to `afterword.blog`
- fetches the `source`
- checks that the source mentions the target
- stores the result in D1

## Database

Apply the migration:

```bash
npx wrangler d1 execute d1-database --remote --file migrations/0003_webmentions.sql
```

This creates:

- `webmentions`

## Current scope

This is basic receiving/storage support only.

Not yet included:

- rendering received mentions on posts
- sending Webmentions to other sites
- Micropub
- IndieAuth endpoints
