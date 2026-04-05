---
title: Colophon
description: "A note on how Afterword is put together, and why it exists in this shape."
---

Afterword is my attempt at keeping a personal site that still feels alive. I wanted something that could hold short updates, photographs, check-ins, music notes, older archive material, and longer writing without collapsing into either a social profile or a conventional blog theme pretending to do everything.

The public site is built with SvelteKit and runs on Cloudflare Workers, with Cloudflare storage handling a lot of the heavier lifting behind the scenes. These days it is much more static-first than it used to be. Most of the site is prerendered ahead of time, while the more live sections lean on local snapshots and caches so they can stay reasonably fresh without rebuilding the whole site or waiting on distant services every time someone visits.

Ghost is still an important part of the workflow. It remains the writing desk for longer posts and some of the editorial side of the site. I like writing in a calmer environment and then letting this front end compose those pieces into a broader personal home rather than making Ghost carry the whole experience by itself.

Statuses come from Bluesky and my own PDS, and check-ins are synced in from Swarm into that same personal data layer. The PDS is the canonical home for those records, but the public site usually reads from local snapshots first so it stays fast. I still think of this domain as the center of gravity, but I like that some of the more live pieces can move through a portable identity layer instead of being trapped inside one app. The goal is not to turn the site into a feed, though. It is to let the site breathe a little.

The gallery now uses a local synced image layer instead of pulling directly from Ghost on every request. Photo posts are discovered from Ghost, copied into my own image storage, and saved with metadata so the gallery feels faster, steadier, and more like it belongs here. That was one of the more important changes I made recently.

Music notes work a little differently. Crucial Tracks and Album Whale entries are archived locally, preserved in GitHub, and mirrored into local storage so they can stay part of the site even if the outside services change shape or disappear. The same general logic now applies to the older archive section too: I am trying to bias this site toward keeping what matters close at hand.

That is probably the larger point of all this. I am not trying to build a product. I am trying to make a home on the web that can hold the professional parts of my life, the wandering and photography parts, the family-and-garden parts, the music-obsessive parts, and the ordinary notes that would otherwise disappear into platforms built for speed instead of memory.

It is a little handmade on purpose.
