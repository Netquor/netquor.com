<script lang="ts">
    // An icon from the sprite (Sprite.svelte). big adds the "big" class the feature cards and plan headers use.
    let { name, big = false }: { name: string; big?: boolean } = $props();
</script>

<svg class={big ? "ico big" : "ico"}><use href={`#i-${name}`}></use></svg>
