import { compare } from "./pricing.js";
// Netquor Fleet public page: the price calculator and the demo form. No libraries.
(() => {
  const $ = (id) => document.getElementById(id);
  const money = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- calculator: every number comes from the server (/fleet/public/quote), never from page arithmetic ----
  const calc = $("calc");
  if (calc) {
    const macN = $("calc-mac"), macR = $("calc-mac-r"), iosN = $("calc-ios"), iosR = $("calc-ios-r");
    const count = (el) => Math.min(Math.max(Math.floor(Number(el.value)) || 0, 0), 100000);
    const pct = (bps) => `${bps / 100}%`;
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    let term = "annual";
    let seq = 0;
    let timer;

    const line = (text) => { const li = document.createElement("li"); li.textContent = text; return li; };

    // One card per plan, in the same terms: what the first year costs and what that is a month.
    function card(id, p, tag) {
      $(id + "-main").textContent = money(p.total_year_one_cents);
      $(id + "-sub").textContent = p.total_year_one_cents === 0 ? "enter your devices" : `a year, about ${money(p.total_per_month_year_one_cents)} a month`;
      $(id + "-tag").textContent = tag;
      $(id + "-tag").hidden = !tag;
    }

    // Lifetime has its own shape: paid once, so the sub line says what else is due and when.
    function lifetimeCard(l, tag) {
      $("lifetime-main").textContent = money(l.total_year_one_cents);
      $("lifetime-sub").textContent = l.total_year_one_cents === 0 ? "enter your devices" : "paid once, nothing to renew";
      $("lifetime-tag").textContent = tag;
      $("lifetime-tag").hidden = !tag;
    }

    function render(c) {
      const list = $("breakdown");
      list.replaceChildren();
      $("calc-error").textContent = "";
      const a = c.annual, m = c.monthly;
      if (c.macs + c.ios === 0) {
        card("annual", a, ""); card("monthly", m, ""); lifetimeCard(c.lifetime, "");
        $("verdict").textContent = "Enter your devices to compare the plans.";
        return;
      }
      const diff = Math.abs(c.annual_extra_year_one_cents);
      card("annual", a, c.cheaper_first_year === "annual" ? "Lower first-year cost" : "");
      card("monthly", m, c.cheaper_first_year === "monthly" ? "Lower first-year cost" : "");
      const L = c.lifetime;
      const lifeWins = L.five_year_cents < L.five_year_annual_cents;
      lifetimeCard(L, lifeWins ? "Lowest over 5 years" : "");

      // Say which is cheaper, and why when it is the one people would not expect.
      let verdict = "";
      if (c.cheaper_first_year === "annual") {
        verdict = `Annual saves you ${money(diff)} in the first year.`;
      } else if (c.cheaper_first_year === "monthly") {
        verdict = `Monthly costs ${money(diff)} less in the first year. ${plural(c.annual_spare_licenses, "license", "licenses")} in your packs aren't in use yet (worth ${money(c.annual_spare_value_cents)}); they roll over and cover the devices you add next.`;
      }
      if (lifeWins) verdict += `${verdict ? " " : ""}Over five years, lifetime costs ${money(L.five_year_cents)} against ${money(L.five_year_annual_cents)} on annual and ${money(L.five_year_monthly_cents)} month to month.`;
      $("verdict").textContent = verdict;

      // The details of the plan the visitor has selected.
      if (term === "lifetime") { renderLifetime(L, list); return; }
      const p = term === "annual" ? a : m;
      const py = p.year_one;
      if (term === "annual") {
        const parts = [];
        if (py.packs_mac) parts.push(plural(py.packs_mac, "Mac pack", "Mac packs"));
        if (py.packs_ios) parts.push(plural(py.packs_ios, "iPhone & iPad pack", "iPhone & iPad packs"));
        if (parts.length) list.append(line(`${parts.join(" + ")} (${py.packs_total * 10} licenses).`));
        list.append(line(`Annual means ${py.months_paid} months' price for 12${py.volume_bps ? `, plus ${pct(py.volume_bps)} off for the packs` : ""}.`));
        const spare = py.spare_mac + py.spare_ios;
        if (spare) list.append(line(`${plural(spare, "license", "licenses")} not in use yet roll over to your next term.`));
        if (p.next_tier) list.append(line(`Buy ${plural(p.next_tier.packs_more, "more pack", "more packs")} (${p.next_tier.devices_more} licenses) to reach ${pct(p.next_tier.discount_bps)} off.`));
      }
      if (term === "monthly") list.append(line("Month to month at list price, no commitment. Pay for a year at once and two months are free."));
      if (p.savings_year_one_cents > 0) list.append(line(`${money(p.savings_year_one_cents)} (${p.savings_year_one_pct}%) less than list price for the first year.`));
      if (p.dedicated.included) {
        const d = p.dedicated;
        list.append(line(term === "annual"
          ? `Dedicated instance: ${money(d.setup_cents)} one-time setup + ${money(d.hosting_year_cents)} a year, on your own URL.`
          : `Dedicated instance: ${money(d.setup_cents)} one-time setup + ${money(d.hosting_year_cents / 12)} a month, on your own URL.`));
      }
      if (p.total_renewal_cents) list.append(line(`Year two with the same devices${p.dedicated.included ? " and instance" : ""}: ${money(p.total_renewal_cents)}${term === "monthly" ? ` (${money(Math.round(p.total_renewal_cents / 12))} a month)` : ""}.`));
    }

    function renderLifetime(L, list) {
      const y = L.year_one;
      const parts = [];
      if (y.packs_mac) parts.push(plural(y.packs_mac, "Mac pack", "Mac packs"));
      if (y.packs_ios) parts.push(plural(y.packs_ios, "iPhone & iPad pack", "iPhone & iPad packs"));
      if (parts.length) list.append(line(`${parts.join(" + ")} (${(y.packs_mac + y.packs_ios) * 10} licenses), bought once${y.volume_bps ? `, with ${pct(y.volume_bps)} off` : ""}.`));
      const spare = y.spare_mac + y.spare_ios;
      if (spare) list.append(line(`${plural(spare, "license", "licenses")} beyond your devices ${spare === 1 ? "is" : "are"} yours to keep: lifetime licenses never expire, so they cover the devices you add later.`));
      if (L.next_tier) list.append(line(`Buy ${plural(L.next_tier.packs_more, "more pack", "more packs")} (${L.next_tier.devices_more} licenses) to reach ${pct(L.next_tier.discount_bps)} off.`));
      list.append(line(`A lifetime license costs ${L.years_of_annual} years of the annual price. Nothing renews, and it moves to a replacement device when one leaves.`));
      if (L.dedicated.included) list.append(line(`Dedicated instance: ${money(L.dedicated.setup_cents)} one-time setup + ${money(L.dedicated.hosting_year_cents)} a year of hosting, on your own URL.`));
      if (L.total_renewal_cents) list.append(line(`Every year after: ${money(L.total_renewal_cents)} for the dedicated instance. Nothing else.`));
      list.append(line(`Over five years: ${money(L.five_year_cents)}, against ${money(L.five_year_annual_cents)} on annual.`));
    }

    async function refresh() {
      const mine = ++seq;
      const macs = count(macN), ios = count(iosN);
      const form = $("lead-form");
      if (form && !form.dataset.touched) { form.elements.macs.value = macs; form.elements.ios.value = ios; }
      const dedicated = $("calc-dedicated") && $("calc-dedicated").checked ? 1 : 0;
      if (form) { form.elements.term.value = term; form.elements.dedicated.value = String(dedicated); }
      try {
        const c = compare({ macs, ios, dedicated });
        if (mine === seq) { lastQuote = c; render(c); }
      } catch {
        if (mine === seq) $("calc-error").textContent = "Couldn't work out a price right now. Please try again.";
      }
    }
    let lastQuote = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(refresh, 120); };

    // A slider and its number box edit the same value; a number past the slider's end still counts.
    const link = (num, rng) => {
      rng.addEventListener("input", () => { num.value = rng.value; soon(); });
      num.addEventListener("input", () => { rng.value = Math.min(count(num), Number(rng.max)); soon(); });
    };
    link(macN, macR);
    link(iosN, iosR);
    $("calc-dedicated").addEventListener("change", refresh);
    // "Add it to my estimate" in the dedicated section ticks the box and takes you to the calculator.
    document.querySelectorAll("[data-add-dedicated]").forEach((a) => a.addEventListener("click", () => { $("calc-dedicated").checked = true; refresh(); }));

    for (const t of ["annual", "monthly", "lifetime"]) {
      $("term-" + t).addEventListener("click", () => {
        term = t;
        for (const x of ["annual", "monthly", "lifetime"]) { $("term-" + x).classList.toggle("on", x === t); $("term-" + x).setAttribute("aria-pressed", String(x === t)); }
        const form = $("lead-form");
        if (form) form.elements.term.value = term;
        if (lastQuote) render(lastQuote); else refresh();
      });
    }
    refresh();
  }

  // ---- demo form ----
  const form = $("lead-form");
  if (form) {
    form.addEventListener("input", (e) => { if (e.target.name === "macs" || e.target.name === "ios") form.dataset.touched = "1"; });
    const status = $("lead-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = form.elements;
      if (!f.name.value.trim()) return say("Please tell us your name.", "bad");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) return say("Please enter a valid email address.", "bad");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      say("Sending…", "");
      try {
        const lines = [`Name: ${f.name.value.trim()}`, `Email: ${f.email.value.trim()}`, `Company: ${f.company.value.trim()}`, `Macs: ${f.macs.value}`, `iPhones and iPads: ${f.ios.value}`, `Plan looked at: ${f.term.value}${f.dedicated.value === "1" ? " + dedicated instance" : ""}`, "", f.message.value.trim()];
        window.location.href = "mailto:hello@netquor.com?subject=" + encodeURIComponent("Netquor Fleet free trial") + "&body=" + encodeURIComponent(lines.join("\n"));
        say("Opening your email app. If nothing opens, write to hello@netquor.com.", "ok");
      } catch (err) {
        say(err.message, "bad");
      } finally {
        button.disabled = false;
      }
    });
    function say(text, kind) { status.textContent = text; status.className = "status " + kind; }
  }
})();
