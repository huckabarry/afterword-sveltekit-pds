<svelte:options runes={false} />

<script lang="ts">
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import Card from './Card.svelte'
  import type { TemplatePost } from '$lib/server/template-posts'

  export let post: TemplatePost | null = null
  export let headings: TemplatePost['headings'] = post?.headings ?? []

  let elements: HTMLElement[] = []
  const DESKTOP_OFFSET = 112
  const MOBILE_OFFSET = 88
  const ACTIVE_HEADING_SLACK = 20

  onMount(() => {
    updateHeadings()
    setActiveHeading()
  })

  let activeHeading = headings[0]

  function getScrollOffset() {
    return window.innerWidth >= 1024 ? DESKTOP_OFFSET : MOBILE_OFFSET
  }

  function updateHeadings() {
    headings = post?.headings ?? headings

    if (browser) {
      elements = headings.map((heading) => {
        return document.getElementById(heading.id)
      }).filter((element): element is HTMLElement => Boolean(element))
    }
  }

  function setActiveHeading() {
    if (!browser || elements.length === 0) return

    const offset = getScrollOffset()
    let nextActive = headings[0]

    elements.forEach((element, index) => {
      if (element.getBoundingClientRect().top - offset <= ACTIVE_HEADING_SLACK) {
        nextActive = headings[index]
      }
    })

    activeHeading = nextActive
  }

  function scrollToHeading(event: MouseEvent, headingId: string) {
    if (!browser) return

    const element = document.getElementById(headingId)
    if (!element) return

    event.preventDefault()

    const top = window.scrollY + element.getBoundingClientRect().top - getScrollOffset()
    const clickedHeading = headings.find((heading) => heading.id === headingId)

    if (clickedHeading) {
      activeHeading = clickedHeading
    }

    window.history.replaceState(null, '', `#${headingId}`)
    window.scrollTo({
      top,
      behavior: 'smooth'
    })
  }
</script>

<svelte:window on:scroll={setActiveHeading} on:resize={setActiveHeading} />

<Card>
  <slot slot="description">
    <ul class="flex flex-col gap-2">
      {#each headings as heading}
        <li
          class="pl-2 transition-colors border-[#c06a63] dark:border-[#e08a7a] heading text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100"
          class:active={activeHeading === heading}
          style={`--depth: ${
            // consider h1 and h2 at the same depth, as h1 will only be used for page title
            Math.max(0, heading.depth - 1)
          }`}
        >
          <a href={`#${heading.id}`} on:click={(event) => scrollToHeading(event, heading.id)}
            >{heading.value}</a
          >
        </li>
      {/each}
    </ul>
  </slot>
</Card>

<style lang="postcss">
  .heading {
    padding-left: calc(var(--depth, 0) * 0.35rem);
  }

  .active {
    @apply font-medium text-slate-900 border-l-2 -ml-[2px];
  }

  /* can't use dark: modifier in @apply */
  :global(.dark) .active {
    @apply text-slate-100;
  }
</style>
