# PDS Music Model Draft

This is a draft for moving `Crucial Tracks` and `Album Whale` data into the PDS as the canonical source, while keeping markdown backups in git.

## Goals

- Make track and album pages render without live scraping.
- Store artwork as PDS blobs so images are durable.
- Keep outbound listening links explicit and portable.
- Preserve provenance so imported records still point back to their original source.
- Keep git archives as backup and audit trail, not as the primary runtime database.
- Let the Svelte app own page layout while preserving richer note fragments when useful.

## Collections

- `blog.afterword.media.track`
- `blog.afterword.media.album`

Both record types use `key: "any"` so imports can choose deterministic `rkey`s and safely upsert with `putRecord`.

Suggested `rkey` pattern:

- Tracks: `2026-03-28-call-me-on-your-way-back-home-ryan-adams`
- Albums: `2026-03-28-nothings-about-to-happen-to-me-mitski`

## Field Roles

### `source`

`source` answers "where did this entry come from originally?"

Examples:

- `provider: "crucialtracks"`
- `provider: "albumwhale"`
- `url: "https://www.crucialtracks.org/profile/bryan/20260326"`

This is provenance and attribution, not the main place the UI should send people for listening.

### `links[]`

`links[]` is the canonical place for outbound actions. These are the links the Svelte app should render as buttons or lists.

Examples:

- `Source`
- `Apple Music`
- `Spotify`
- `Listen elsewhere`
- `Playlist`

This separates "where the entry came from" from "where someone can go listen."

### `playback`

`playback` is optional convenience data for inline media controls.

For tracks:

- `previewUrl` can power the native `<audio>` element.
- `embedUrl` is optional if Bryan later wants provider embeds.

For albums:

- `embedUrl` is optional and should never be required for the page to feel complete.

The durable rule is:

- use `links[]` for canonical outbound actions
- use `playback` only when inline playback is nice to have

### `noteHtml`

`noteHtml` is an optional preserved HTML fragment for the note body only.

This is the escape hatch for cases where:

- the archive format loses formatting
- the source feed carries richer note markup
- you want to preserve a little more fidelity without storing a full rendered page

The intended split is:

- Svelte owns the page HTML and component layout
- the record can optionally preserve a richer note fragment

In other words, the site should not store full page markup in the record, but it can absolutely keep a note-level HTML fragment when that makes import fidelity better.

## Artwork Strategy

Artwork and covers should be uploaded as blobs and stored directly in the record.

The original remote image URL can still be retained as:

- `artwork.originalUrl`
- `cover.originalUrl`

That gives you both durability and provenance.

## Current App Mapping

These records are designed to map cleanly into the current runtime shapes in [music.ts](/Users/bryanrobb/Git/afterword-sveltekit-pds/src/lib/server/music.ts).

Track mapping:

- `title` -> `trackTitle`
- `artist` -> `artist`
- `note` -> `note`
- `noteHtml` -> optional richer note fragment
- `loggedAt` -> `publishedAt`
- `source.url` -> `sourceUrl`
- `artwork.image` -> `artworkUrl` via blob URL resolution
- `playback.previewUrl` -> `previewUrl`
- `links[]` -> `listenLinks`

Album mapping:

- `title` -> `albumTitle`
- `artist` -> `artist`
- `note` -> `note`
- `noteHtml` -> optional richer note fragment
- `loggedAt` -> `publishedAt`
- `source.url` -> `sourceUrl`
- `cover.image` -> `coverImage` via blob URL resolution
- `links[]` -> `listenLinks`

## Recommended Migration Order

1. Draft and refine these lexicons.
2. Build a one-time importer from `archive/crucial-tracks` and `archive/albumwhale`.
3. Upload artwork blobs during import.
4. Switch `src/lib/server/music.ts` to read from the PDS first.
5. Keep writing markdown backups to git after successful imports or new entries.

## Non-Goals

- No live scraping at render time.
- No raw iframe HTML in the record.
- No dependency on remote artwork URLs for normal page rendering.
- No full page HTML snapshots as the primary content model.

If embeds are ever added, the record should keep only structured fields like `embedUrl` and `embedProvider`, and the Svelte UI should decide how to render them.
