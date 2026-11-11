<script lang="ts">
    // One card of the readiness and comparison grids: <a class="nq-ready">.
    import type { ReadyCard } from "./data";
    let { card }: { card: ReadyCard } = $props();
</script>

<a class="nq-ready" href={card.href}>
    <span class="nq-app-icon"><i class="bi bi-{card.icon}" aria-hidden="true"></i></span>
    <h3>{card.title}</h3>
    <p>{card.text}</p>
    <span class="nq-ready-go">{card.go}</span>
</a>
