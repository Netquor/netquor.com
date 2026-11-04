// lib/pricing.ts
var PRICE_CENTS = {
  mac: 595,
  ios: 395
};
var CURRENCY = "USD";
var MAX_DEVICES = 1e5;
var PACK = 10;
var ANNUAL_MONTHS_PAID = 10;
var ANNUAL_MONTHS_FREE = 12 - ANNUAL_MONTHS_PAID;
var VOLUME_TIERS = [
  { packs: 1, bps: 500 },
  { packs: 2, bps: 1000 },
  { packs: 5, bps: 1500 },
  { packs: 10, bps: 2000 },
  { packs: 25, bps: 2500 }
];
var PACKS_ONLY = { annual: true, lifetime: true };
var TRIAL = { days: 30 };
var DEDICATED = {
  setup_cents: 30000,
  yearly_cents: 30000,
  monthly_cents: 3000,
  setup_on_monthly: true
};
var LIFETIME = {
  annual_multiple: 3
};
var annualLicenseCents = (kind) => PRICE_CENTS[kind] * ANNUAL_MONTHS_PAID;
var lifetimeLicenseCents = (kind) => annualLicenseCents(kind) * LIFETIME.annual_multiple;
var count = (n) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_DEVICES) : 0;
};
function off(cents, volumeBps) {
  return Number((BigInt(cents) * BigInt(1e4 - volumeBps) + 5000n) / 10000n);
}
var volumeBps = (packs) => VOLUME_TIERS.reduce((best, t) => packs >= t.packs ? t.bps : best, 0);
function quote(input) {
  const macs = count(input.macs);
  const ios = count(input.ios);
  const mac_cents = macs * PRICE_CENTS.mac;
  const ios_cents = ios * PRICE_CENTS.ios;
  const monthly_cents = mac_cents + ios_cents;
  return { macs, ios, mac_cents, ios_cents, monthly_cents, yearly_cents: monthly_cents * 12 };
}
function bestMix(needMac, needIos, unit, packsOnly) {
  const choices = (n) => [...new Set(packsOnly ? [Math.ceil(n / PACK)] : [Math.floor(n / PACK), Math.ceil(n / PACK)])];
  let best = null;
  for (const pm of choices(needMac)) {
    for (const pi of choices(needIos)) {
      const sm = Math.max(0, needMac - pm * PACK);
      const si = Math.max(0, needIos - pi * PACK);
      const v = volumeBps(pm + pi);
      const cost = off(pm * PACK * unit.mac + pi * PACK * unit.ios, v) + sm * unit.mac + si * unit.ios;
      if (!best || cost < best.cost || cost === best.cost && pm + pi < best.pm + best.pi)
        best = { pm, pi, sm, si, v, cost };
    }
  }
  return best;
}
var bestAnnual = (needMac, needIos) => bestMix(needMac, needIos, { mac: annualLicenseCents("mac"), ios: annualLicenseCents("ios") }, PACKS_ONLY.annual);
function bill(paidMacs, paidIos, term, owned = { mac: 0, ios: 0 }) {
  if (term === "monthly") {
    const packsMac = Math.ceil(paidMacs / PACK);
    const packsIos = Math.ceil(paidIos / PACK);
    const list = packsMac * PACK * PRICE_CENTS.mac + packsIos * PACK * PRICE_CENTS.ios;
    return { term, paid_macs: paidMacs, paid_ios: paidIos, packs_mac: packsMac, packs_ios: packsIos, packs_total: packsMac + packsIos, singles_mac: 0, singles_ios: 0, spare_mac: packsMac * PACK - paidMacs, spare_ios: packsIos * PACK - paidIos, months_paid: 12, volume_bps: 0, list_month_cents: list, yearly_cents: list * 12, per_month_cents: list };
  }
  const needMac = Math.max(0, paidMacs - owned.mac);
  const needIos = Math.max(0, paidIos - owned.ios);
  const b = bestAnnual(needMac, needIos);
  const bought_mac = b.pm * PACK + b.sm;
  const bought_ios = b.pi * PACK + b.si;
  return {
    term,
    paid_macs: paidMacs,
    paid_ios: paidIos,
    packs_mac: b.pm,
    packs_ios: b.pi,
    packs_total: b.pm + b.pi,
    singles_mac: b.sm,
    singles_ios: b.si,
    spare_mac: owned.mac + bought_mac - paidMacs,
    spare_ios: owned.ios + bought_ios - paidIos,
    months_paid: ANNUAL_MONTHS_PAID,
    volume_bps: b.v,
    list_month_cents: needMac * PRICE_CENTS.mac + needIos * PRICE_CENTS.ios,
    yearly_cents: b.cost,
    per_month_cents: Math.round(b.cost / 12)
  };
}
function dedicatedCost(term, included) {
  if (!included)
    return { included: false, setup_cents: 0, hosting_year_cents: 0, year_one_cents: 0, renewal_cents: 0 };
  const hosting = term === "annual" ? DEDICATED.yearly_cents : DEDICATED.monthly_cents * 12;
  const setup = term === "annual" || DEDICATED.setup_on_monthly ? DEDICATED.setup_cents : 0;
  return { included: true, setup_cents: setup, hosting_year_cents: hosting, year_one_cents: setup + hosting, renewal_cents: hosting };
}
function price(input) {
  const macs = count(input.macs);
  const ios = count(input.ios);
  const term = input.term === "monthly" ? "monthly" : "annual";
  const wantsDedicated = input.dedicated === true || input.dedicated === "1" || input.dedicated === "true" || input.dedicated === 1;
  const year_one = bill(macs, ios, term);
  const renewal = bill(macs, ios, term, { mac: year_one.spare_mac, ios: year_one.spare_ios });
  const dedicated = dedicatedCost(term, wantsDedicated);
  const list_year_cents = quote({ macs, ios }).yearly_cents;
  const savings = Math.max(0, list_year_cents - year_one.yearly_cents);
  let next_tier = null;
  if (term === "annual") {
    const t = VOLUME_TIERS.find((x) => x.packs > year_one.packs_total);
    if (t) {
      const packs_more = t.packs - year_one.packs_total;
      next_tier = { packs_more, devices_more: packs_more * PACK, discount_bps: t.bps };
    }
  }
  const total_year_one_cents = year_one.yearly_cents + dedicated.year_one_cents;
  return {
    macs,
    ios,
    term,
    dedicated,
    total_year_one_cents,
    total_renewal_cents: renewal.yearly_cents + dedicated.renewal_cents,
    total_per_month_year_one_cents: Math.round(total_year_one_cents / 12),
    year_one,
    renewal,
    list_year_cents,
    savings_year_one_cents: savings,
    savings_year_one_pct: list_year_cents ? Math.round(savings / list_year_cents * 1000) / 10 : 0,
    next_tier
  };
}
function lifetimeBill(macs, ios) {
  const b = bestMix(macs, ios, { mac: lifetimeLicenseCents("mac"), ios: lifetimeLicenseCents("ios") }, PACKS_ONLY.lifetime);
  return {
    macs,
    ios,
    packs_mac: b.pm,
    packs_ios: b.pi,
    singles_mac: b.sm,
    singles_ios: b.si,
    spare_mac: b.pm * PACK + b.sm - macs,
    spare_ios: b.pi * PACK + b.si - ios,
    volume_bps: b.v,
    cents: b.cost
  };
}
function lifetimePrice(input) {
  const macs = count(input.macs);
  const ios = count(input.ios);
  const wantsDedicated = input.dedicated === true || input.dedicated === "1" || input.dedicated === "true" || input.dedicated === 1;
  const year_one = lifetimeBill(macs, ios);
  const dedicated = dedicatedCost("annual", wantsDedicated);
  const total_year_one_cents = year_one.cents + dedicated.year_one_cents;
  const fiveAnnual = price({ macs, ios, term: "annual", dedicated: wantsDedicated });
  const fiveMonthly = price({ macs, ios, term: "monthly", dedicated: wantsDedicated });
  const five = (p) => p.total_year_one_cents + 4 * p.total_renewal_cents;
  const packs = year_one.packs_mac + year_one.packs_ios;
  const t = VOLUME_TIERS.find((x) => x.packs > packs);
  return {
    macs,
    ios,
    dedicated,
    year_one,
    total_year_one_cents,
    total_per_month_year_one_cents: Math.round(total_year_one_cents / 12),
    total_renewal_cents: dedicated.renewal_cents,
    five_year_cents: total_year_one_cents + 4 * dedicated.renewal_cents,
    five_year_annual_cents: five(fiveAnnual),
    five_year_monthly_cents: five(fiveMonthly),
    years_of_annual: LIFETIME.annual_multiple,
    next_tier: t ? { packs_more: t.packs - packs, devices_more: (t.packs - packs) * PACK, discount_bps: t.bps } : null
  };
}
var yearlyLicenseCents = (kind, volume = 0) => off(annualLicenseCents(kind), volume);
var monthlyEquivalentCents = (kind, volume = 0) => Math.round(yearlyLicenseCents(kind, volume) / 12);
function money(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${whole}.${String(abs % 100).padStart(2, "0")}`;
}
var pct = (bps) => `${bps / 100}%`;
function compare(input) {
  const annual = price({ ...input, term: "annual" });
  const monthly = price({ ...input, term: "monthly" });
  const extra = annual.total_year_one_cents - monthly.total_year_one_cents;
  const a = annual.year_one;
  const spare_value = a.spare_mac * annualLicenseCents("mac") + a.spare_ios * annualLicenseCents("ios");
  return {
    macs: annual.macs,
    ios: annual.ios,
    annual,
    monthly,
    lifetime: lifetimePrice(input),
    cheaper_first_year: extra < 0 ? "annual" : extra > 0 ? "monthly" : "same",
    annual_extra_year_one_cents: extra,
    annual_spare_licenses: a.spare_mac + a.spare_ios,
    annual_spare_value_cents: off(spare_value, a.volume_bps)
  };
}
export {
  ANNUAL_MONTHS_FREE,
  ANNUAL_MONTHS_PAID,
  CURRENCY,
  DEDICATED,
  LIFETIME,
  MAX_DEVICES,
  PACK,
  PACKS_ONLY,
  PRICE_CENTS,
  TRIAL,
  VOLUME_TIERS,
  annualLicenseCents,
  bill,
  compare,
  dedicatedCost,
  lifetimeLicenseCents,
  lifetimePrice,
  money,
  monthlyEquivalentCents,
  pct,
  price,
  quote,
  volumeBps,
  yearlyLicenseCents
};
