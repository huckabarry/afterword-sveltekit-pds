# afterword-sveltekit-pds

This repo used to power the full public `afterword.blog` site in SvelteKit. It now primarily acts as a sync and pipeline worker alongside the Astro/EmDash site.

## Current role

The public site now lives in the Astro repo, but this worker still handles a few important background jobs:

- `sync.afterword.blog/api/swarm/push` receives Swarm/Foursquare push events and writes check-ins to the PDS
- `sync.afterword.blog/internal/music-sync` imports music activity into the PDS and refreshes related snapshots
- `sync.afterword.blog/api/checkins` exposes normalized check-in data for the Astro site
- `sync.afterword.blog/api/media/*` exposes normalized media data for the Astro site

## Notes

- Public site and CMS: see the Astro/EmDash repo
- This repo is intentionally being kept around because it still owns a few backend-style sync duties
- If we ever revive it further, the right direction is probably to keep it focused on sync APIs and protocol adapters rather than rebuild the whole public site here
