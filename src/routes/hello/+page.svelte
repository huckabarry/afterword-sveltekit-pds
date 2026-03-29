<svelte:head>
	<title>Hello | Bryan Robb</title>
	<meta
		name="description"
		content="A short guide to what Afterword is, what Bryan writes about, and the best ways to say hello."
	/>
</svelte:head>

<section class="section-block hello-page">
	<h1 class="section-title">Hello</h1>
	<article class="content content-page">
		<div class="post-full-content">
			<section class="content-body hello-page__body">
				<p>
					If you’re curious about this site or how to get in touch, here’s a summary.
				</p>

				<p>
					Afterword is my online home. I post short updates, photos, check-ins, and longer
					notes about cities, neighborhoods, design, transit, music, and small things that
					catch my attention. Some of it runs on my own PDS, a private space where I manage
					my digital information, but this site is still my main hub.
				</p>

				<p>
					I’m an urban planner. Outside of work, I enjoy photography, gardening, and music.
					Playing guitar helps me relax and feel like myself. I’m married with two young kids.
					While I don’t always write about family, they’re a big part of my life.
				</p>

				<p>
					Most posts come from wandering and thinking about buildings, public spaces,
					neighborhood life, and making a personal site feel more human. I believe the
					internet needs more small, personal places. To help you explore, here’s where you
					might want to start:
				</p>

				<h2>Start Here</h2>

				<ul class="hello-page__list">
					<li>
						<a href="/field-notes">Field Notes</a> contains my personal, place-based
						writing, sharing observations and experiences from my perspective.
					</li>
					<li>
						<a href="/planning">Planning &amp; Urbanism</a> is dedicated to my professional
						perspectives on city planning and urban issues.
					</li>
					<li>
						<a href="/photos">The Gallery</a> showcases some of my photography and visual
						observations.
					</li>
					<li>
						<a href="/now">Now</a> for a snapshot of what currently has my attention.
					</li>
					<li>
						In <a href="/media">Media</a>, I highlight what I’m listening to, reading, and
						watching, with brief commentary.
					</li>
					<li>
						<a href="/check-ins">Check-ins</a> document maps and locations from my travels
						and provide context to the places I visit.
					</li>
				</ul>

				<h2>How To Reach Me</h2>

				<ul class="hello-page__list">
					<li>
						For public conversations, you’ll find me on
						<a href="https://bsky.app/profile/afterword.blog" target="_blank" rel="noreferrer">Bluesky</a>.
						I usually reply quickly there.
					</li>
					<li>
						If you want to send a private message, use the <a href="/contact">contact page</a>.
					</li>
					<li>
						If you found me through an old fediverse or side-project profile, I’m probably
						not active there anymore. This site and Bluesky are the best ways to reach me.
					</li>
				</ul>

				<h2>A Few Expectations</h2>

				<ul class="hello-page__list">
					<li>
						I prefer slower, more thoughtful conversations over the constant rush to post.
					</li>
					<li>
						I don’t mind people reaching out cold if there’s a genuine reason. A note about
						a post, city, photograph, shared obsession, or recommendation is always a good
						place to start.
					</li>
					<li>
						If you want to know more about me, check the <a href="/about">About page</a>.
						The <a href="/colophon">Colophon</a> explains how this site was built.
					</li>
				</ul>

				<p>
					I want this place to feel approachable. If something here resonates with you, feel
					free to say hello.
				</p>
			</section>
		</div>
	</article>
</section>

<style>
	.hello-page__body {
		display: block;
	}

	.hello-page__body > * {
		margin: 0;
	}

	.hello-page__body > p + p {
		margin-top: 1.15rem;
	}

	.hello-page__body > h2 {
		margin-top: 2.25rem;
	}

	.hello-page__body > h2 + .hello-page__list {
		margin-top: 0.85rem;
	}

	.hello-page__body > .hello-page__list + h2 {
		margin-top: 2.25rem;
	}

	.hello-page__body > .hello-page__list + p {
		margin-top: 1.4rem;
	}

	.hello-page__list {
		margin: 0;
		padding-left: 1.2rem;
	}

	.hello-page__list li + li {
		margin-top: 0.7rem;
	}

	.hello-page__list li {
		line-height: 1.65;
	}
</style>
