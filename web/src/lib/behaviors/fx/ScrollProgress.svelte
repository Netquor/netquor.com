<script lang="ts">
    // The scroll progress line. Server-rendered as an empty, aria-hidden, fixed 2 px bar (CSS: transform scaleX(0), pointer-events none, hidden under reduced motion and in print), so without JavaScript it is invisible and never shifts layout. use:progressBar fills it on scroll.
    import { progressBar } from "./progress";
</script>

<div class="nq-progress" aria-hidden="true" use:progressBar></div>
