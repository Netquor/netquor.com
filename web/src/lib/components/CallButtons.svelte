<script lang="ts">
    // The phone button of a contact section: the main (toll-free) number, unlabeled. `cls` is the button class of the page (they differ: pill buttons or plain), `prefix` is "Call " where the page words it that way. Both numbers are in the footer.
    import { MAIN } from "../contact";
    let { cls = "btn btn-outline-info btn-lg rounded-pill px-4", prefix = "" }: { cls?: string; prefix?: string } = $props();
</script>

<a class={cls} href={MAIN.href}>{prefix}{MAIN.display}</a>
