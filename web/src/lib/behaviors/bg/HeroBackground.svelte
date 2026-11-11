<script lang="ts">
    // The home page hero's background: a hairline grid and circuit traces (svg), one travelling pulse (canvas) and a pause control. Port of bg.js. Place as the FIRST child of the element with class "hero-section" (the legacy script inserts it there). Server-rendered as the empty aria-hidden wrapper; after hydration the grid and traces are built from the hero's size, rebuilt on resize, and unless reduced motion or Save-Data is on, the pulse runs and "button.nq-bg-pause" is appended to the hero.
    import { onMount } from "svelte";
    import { startBackground, type BgCanvas, type BgHero, type BgSvg } from "./background.ts";

    let wrap: HTMLDivElement;
    let svg: SVGSVGElement;
    let canvas: HTMLCanvasElement;

    onMount(() => {
        const hero = wrap.closest(".hero-section") as HTMLElement | null;
        return startBackground(hero as unknown as BgHero | null, svg as unknown as BgSvg, canvas as unknown as BgCanvas);
    });
</script>

<div class="nq-bg" aria-hidden="true" bind:this={wrap}><svg bind:this={svg}></svg><canvas bind:this={canvas}></canvas></div>
