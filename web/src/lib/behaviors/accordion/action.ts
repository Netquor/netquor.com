import { initCollapse } from "./collapse";

/**
 * Svelte action: `<div class="accordion" use:collapse>`. Wires Bootstrap-compatible collapse for every `[data-bs-toggle="collapse"]` inside the node (see initCollapse). For toggles and panels in different places, put it on a common ancestor, or on `<svelte:document use:collapse>`.
 */
export const collapse = (node: Element | Document) => {
    const destroy = initCollapse(node);
    return { destroy };
};
