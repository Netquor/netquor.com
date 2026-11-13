<script lang="ts">
    // The free trial request. The server renders the form complete. After hydration the shared model (src/lib/behaviors/fleet) mirrors the calculator into the counts, plan and dedicated fields until the visitor edits a count, and handles the submit: it checks the name and email and opens the visitor's mail app with a drafted message to hello@netquor.com. Nothing is posted to a server, as before.
    import { useFleetModel } from "#lib/behaviors/fleet/context.ts";
    import { statusClass } from "#lib/behaviors/fleet/form.ts";

    const model = useFleetModel();
    const { form: values, status } = model;

    const submit = (e: SubmitEvent & { currentTarget: HTMLFormElement }) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = form.elements as HTMLFormControlsCollection & Record<"name" | "email" | "company" | "macs" | "ios" | "term" | "dedicated" | "message", HTMLInputElement>;
        const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
        model.submit(
            { name: f.name.value, email: f.email.value, company: f.company.value, macs: f.macs.value, ios: f.ios.value, term: f.term.value, dedicated: f.dedicated.value, message: f.message.value },
            (disabled) => { if (button) button.disabled = disabled; },
        );
    };
</script>

<form id="lead-form" class="card form" novalidate data-touched={$values.touched ? "1" : undefined} onsubmit={submit}>
  <label>Your name<input name="name" autocomplete="name" required maxlength="100" /></label>
  <label>Work email<input name="email" type="email" autocomplete="email" required maxlength="254" /></label>
  <label>Company<input name="company" autocomplete="organization" maxlength="120" /></label>
  <div class="two">
    <label>Macs<input name="macs" type="number" min="0" max="100000" value={$values.macs} inputmode="numeric" oninput={(e) => model.formInput("macs", e.currentTarget.value)} /></label>
    <label>iPhones &amp; iPads<input name="ios" type="number" min="0" max="100000" value={$values.ios} inputmode="numeric" oninput={(e) => model.formInput("ios", e.currentTarget.value)} /></label>
  </div>
  <label>Anything we should know?<textarea name="message" rows="3" maxlength="2000"></textarea></label>
  <!-- A field only a bot fills in. -->
  <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off" /></label></div>
  <input type="hidden" name="term" value={$values.term} />
  <input type="hidden" name="dedicated" value={$values.dedicated} />
  <button class="btn" type="submit">Start free <svg class="ico"><use href="#i-arrow"/></svg></button>
  <p id="lead-status" class={$status.kind || $status.text ? statusClass($status.kind) : "status"} role="status" aria-live="polite">{$status.text}</p>
</form>
