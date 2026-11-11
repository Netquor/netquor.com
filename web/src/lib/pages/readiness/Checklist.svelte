<script lang="ts">
    // One checklist of readiness.html: a section with seven Yes / Not yet questions and an empty result box. The markup is what readiness.js expects (.nq-check with data-key, form inputs named <key>-<n>, .nq-check-result): it listens for change on the form and writes the score into the result box after hydration. Nothing here is interactive on its own, so the server HTML is the whole page and answers never leave the browser.
    import type { Checklist } from "./data";

    let { list }: { list: Checklist } = $props();
</script>

<section class="nq-check" id={list.key} data-key={list.key} aria-labelledby={`${list.key}-t`}>
    <header>
        <span class="nq-app-icon"><i class={`bi ${list.icon}`} aria-hidden="true"></i></span>
        <div><h2 id={`${list.key}-t`}>{list.title}</h2><p>{list.sub}</p></div>
    </header>
    <p class="nq-check-intro">{list.intro}</p>
    <form class="nq-check-form"><ol>
        {#each list.qs as q, i (i)}
            <li><fieldset><legend>{q[0]}</legend>
                <label><input type="radio" name={`${list.key}-${i}`} value="1"> Yes</label>
                <label><input type="radio" name={`${list.key}-${i}`} value="0"> Not yet</label></fieldset></li>
        {/each}
    </ol></form>
    <div class="nq-check-result" aria-live="polite" hidden></div>
</section>
