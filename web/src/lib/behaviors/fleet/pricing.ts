// pricing.ts: the Fleet price and pack math, ported from fleet/pricing.js (a bundled build of lib/pricing.ts). Nothing here types a price: every per-device amount comes in as FleetPrices (read from the live price cache by prices.ts). The structure (packs of 10, ten months paid for twelve, the volume tiers, lifetime as a pack-only purchase, the dedicated instance) is the same as the legacy script, and at the seed prices every output equals the legacy output (pricing.diff.test.ts runs both over a grid).

export const PACK = 10;
export const MAX_DEVICES = 100000;
export const ANNUAL_MONTHS_PAID = 10;
export const ANNUAL_MONTHS_FREE = 12 - ANNUAL_MONTHS_PAID;
/** Volume discount on pack purchases by total packs in one purchase, in basis points. */
export const VOLUME_TIERS: readonly { packs: number; bps: number }[] = [
    { packs: 1, bps: 500 },
    { packs: 2, bps: 1000 },
    { packs: 5, bps: 1500 },
    { packs: 10, bps: 2000 },
    { packs: 25, bps: 2500 },
];
/** Annual and lifetime are sold in packs only; monthly bills whole packs at list price. */
export const PACKS_ONLY = { annual: true, lifetime: true } as const;
/** The dedicated instance is charged a setup fee on the monthly term as well. */
export const DEDICATED_SETUP_ON_MONTHLY = true;
/** A lifetime license is this many years of the annual price (the copy says so; the price cache holds the amount). */
export const LIFETIME_YEARS = 3;

/** Per-device and instance prices in cents: the keys fleet.mac.month, fleet.mobile.month, fleet.{mac,mobile}.{year,lifetime}, fleet.dedicated.{setup,year,month}. */
export interface FleetPrices {
    macMonth: number;
    iosMonth: number;
    macYear: number;
    iosYear: number;
    macLifetime: number;
    iosLifetime: number;
    dedicatedSetup: number;
    dedicatedYear: number;
    dedicatedMonth: number;
}

export type Kind = "mac" | "ios";
export type Term = "annual" | "monthly" | "lifetime";

export interface Bill {
    term: "annual" | "monthly";
    paid_macs: number;
    paid_ios: number;
    packs_mac: number;
    packs_ios: number;
    packs_total: number;
    singles_mac: number;
    singles_ios: number;
    spare_mac: number;
    spare_ios: number;
    months_paid: number;
    volume_bps: number;
    list_month_cents: number;
    yearly_cents: number;
    per_month_cents: number;
}
export interface Dedicated { included: boolean; setup_cents: number; hosting_year_cents: number; year_one_cents: number; renewal_cents: number }
export interface NextTier { packs_more: number; devices_more: number; discount_bps: number }
export interface Price {
    macs: number;
    ios: number;
    term: "annual" | "monthly";
    dedicated: Dedicated;
    total_year_one_cents: number;
    total_renewal_cents: number;
    total_per_month_year_one_cents: number;
    year_one: Bill;
    renewal: Bill;
    list_year_cents: number;
    savings_year_one_cents: number;
    savings_year_one_pct: number;
    next_tier: NextTier | null;
}
export interface LifetimeBill { macs: number; ios: number; packs_mac: number; packs_ios: number; singles_mac: number; singles_ios: number; spare_mac: number; spare_ios: number; volume_bps: number; cents: number }
export interface LifetimePrice {
    macs: number;
    ios: number;
    dedicated: Dedicated;
    year_one: LifetimeBill;
    total_year_one_cents: number;
    total_per_month_year_one_cents: number;
    total_renewal_cents: number;
    five_year_cents: number;
    five_year_annual_cents: number;
    five_year_monthly_cents: number;
    years_of_annual: number;
    next_tier: NextTier | null;
}
export interface Comparison {
    macs: number;
    ios: number;
    annual: Price;
    monthly: Price;
    lifetime: LifetimePrice;
    cheaper_first_year: "annual" | "monthly" | "same";
    annual_extra_year_one_cents: number;
    annual_spare_licenses: number;
    annual_spare_value_cents: number;
}
export interface Quote { macs: number; ios: number; mac_cents: number; ios_cents: number; monthly_cents: number; yearly_cents: number }
export interface PriceInput { macs?: unknown; ios?: unknown; dedicated?: unknown; term?: unknown }

/** A device count: floored, clamped to 0..MAX_DEVICES, anything that is not a finite number is 0. */
export const countDevices = (n: unknown): number => {
    const v = Math.floor(Number(n));
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_DEVICES) : 0;
};

/** cents less volumeBps basis points, round half up on integer cents (BigInt, as the legacy script does). Throws on a non-integer amount, as BigInt does. */
export const off = (cents: number, volumeBpsValue: number): number => Number((BigInt(cents) * BigInt(10000 - volumeBpsValue) + 5000n) / 10000n);

/** The discount that a purchase of this many packs earns. */
export const volumeBps = (packs: number): number => VOLUME_TIERS.reduce((best, t) => (packs >= t.packs ? t.bps : best), 0);

const wantsDedicated = (d: unknown): boolean => d === true || d === "1" || d === "true" || d === 1;

interface Mix { pm: number; pi: number; sm: number; si: number; v: number; cost: number }

export interface Pricing {
    quote(input: PriceInput): Quote;
    bill(paidMacs: number, paidIos: number, term: "annual" | "monthly", owned?: { mac: number; ios: number }): Bill;
    dedicatedCost(term: "annual" | "monthly", included: boolean): Dedicated;
    price(input: PriceInput): Price;
    lifetimePrice(input: PriceInput): LifetimePrice;
    compare(input: PriceInput): Comparison;
}

/** The pack and term math bound to one set of prices. */
export const createPricing = (p: FleetPrices): Pricing => {
    const bestMix = (needMac: number, needIos: number, unit: { mac: number; ios: number }, packsOnly: boolean): Mix => {
        const choices = (n: number): number[] => [...new Set(packsOnly ? [Math.ceil(n / PACK)] : [Math.floor(n / PACK), Math.ceil(n / PACK)])];
        let best: Mix | null = null;
        for (const pm of choices(needMac)) {
            for (const pi of choices(needIos)) {
                const sm = Math.max(0, needMac - pm * PACK);
                const si = Math.max(0, needIos - pi * PACK);
                const v = volumeBps(pm + pi);
                const cost = off(pm * PACK * unit.mac + pi * PACK * unit.ios, v) + sm * unit.mac + si * unit.ios;
                if (!best || cost < best.cost || (cost === best.cost && pm + pi < best.pm + best.pi)) best = { pm, pi, sm, si, v, cost };
            }
        }
        return best as Mix;
    };

    const quote = (input: PriceInput): Quote => {
        const macs = countDevices(input.macs);
        const ios = countDevices(input.ios);
        const mac_cents = macs * p.macMonth;
        const ios_cents = ios * p.iosMonth;
        const monthly_cents = mac_cents + ios_cents;
        return { macs, ios, mac_cents, ios_cents, monthly_cents, yearly_cents: monthly_cents * 12 };
    };

    const bill = (paidMacs: number, paidIos: number, term: "annual" | "monthly", owned = { mac: 0, ios: 0 }): Bill => {
        if (term === "monthly") {
            const packsMac = Math.ceil(paidMacs / PACK);
            const packsIos = Math.ceil(paidIos / PACK);
            const list = packsMac * PACK * p.macMonth + packsIos * PACK * p.iosMonth;
            return { term, paid_macs: paidMacs, paid_ios: paidIos, packs_mac: packsMac, packs_ios: packsIos, packs_total: packsMac + packsIos, singles_mac: 0, singles_ios: 0, spare_mac: packsMac * PACK - paidMacs, spare_ios: packsIos * PACK - paidIos, months_paid: 12, volume_bps: 0, list_month_cents: list, yearly_cents: list * 12, per_month_cents: list };
        }
        const needMac = Math.max(0, paidMacs - owned.mac);
        const needIos = Math.max(0, paidIos - owned.ios);
        const b = bestMix(needMac, needIos, { mac: p.macYear, ios: p.iosYear }, PACKS_ONLY.annual);
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
            list_month_cents: needMac * p.macMonth + needIos * p.iosMonth,
            yearly_cents: b.cost,
            per_month_cents: Math.round(b.cost / 12),
        };
    };

    const dedicatedCost = (term: "annual" | "monthly", included: boolean): Dedicated => {
        if (!included) return { included: false, setup_cents: 0, hosting_year_cents: 0, year_one_cents: 0, renewal_cents: 0 };
        const hosting = term === "annual" ? p.dedicatedYear : p.dedicatedMonth * 12;
        const setup = term === "annual" || DEDICATED_SETUP_ON_MONTHLY ? p.dedicatedSetup : 0;
        return { included: true, setup_cents: setup, hosting_year_cents: hosting, year_one_cents: setup + hosting, renewal_cents: hosting };
    };

    const price = (input: PriceInput): Price => {
        const macs = countDevices(input.macs);
        const ios = countDevices(input.ios);
        const term = input.term === "monthly" ? "monthly" : "annual";
        const year_one = bill(macs, ios, term);
        const renewal = bill(macs, ios, term, { mac: year_one.spare_mac, ios: year_one.spare_ios });
        const dedicated = dedicatedCost(term, wantsDedicated(input.dedicated));
        const list_year_cents = quote({ macs, ios }).yearly_cents;
        const savings = Math.max(0, list_year_cents - year_one.yearly_cents);
        let next_tier: NextTier | null = null;
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
            savings_year_one_pct: list_year_cents ? Math.round((savings / list_year_cents) * 1000) / 10 : 0,
            next_tier,
        };
    };

    const lifetimeBill = (macs: number, ios: number): LifetimeBill => {
        const b = bestMix(macs, ios, { mac: p.macLifetime, ios: p.iosLifetime }, PACKS_ONLY.lifetime);
        return { macs, ios, packs_mac: b.pm, packs_ios: b.pi, singles_mac: b.sm, singles_ios: b.si, spare_mac: b.pm * PACK + b.sm - macs, spare_ios: b.pi * PACK + b.si - ios, volume_bps: b.v, cents: b.cost };
    };

    const lifetimePrice = (input: PriceInput): LifetimePrice => {
        const macs = countDevices(input.macs);
        const ios = countDevices(input.ios);
        const dedicatedWanted = wantsDedicated(input.dedicated);
        const year_one = lifetimeBill(macs, ios);
        const dedicated = dedicatedCost("annual", dedicatedWanted);
        const total_year_one_cents = year_one.cents + dedicated.year_one_cents;
        const fiveAnnual = price({ macs, ios, term: "annual", dedicated: dedicatedWanted });
        const fiveMonthly = price({ macs, ios, term: "monthly", dedicated: dedicatedWanted });
        const five = (x: Price): number => x.total_year_one_cents + 4 * x.total_renewal_cents;
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
            years_of_annual: LIFETIME_YEARS,
            next_tier: t ? { packs_more: t.packs - packs, devices_more: (t.packs - packs) * PACK, discount_bps: t.bps } : null,
        };
    };

    const compare = (input: PriceInput): Comparison => {
        const annual = price({ ...input, term: "annual" });
        const monthly = price({ ...input, term: "monthly" });
        const extra = annual.total_year_one_cents - monthly.total_year_one_cents;
        const a = annual.year_one;
        const spare_value = a.spare_mac * p.macYear + a.spare_ios * p.iosYear;
        return {
            macs: annual.macs,
            ios: annual.ios,
            annual,
            monthly,
            lifetime: lifetimePrice(input),
            cheaper_first_year: extra < 0 ? "annual" : extra > 0 ? "monthly" : "same",
            annual_extra_year_one_cents: extra,
            annual_spare_licenses: a.spare_mac + a.spare_ios,
            annual_spare_value_cents: off(spare_value, a.volume_bps),
        };
    };

    return { quote, bill, dedicatedCost, price, lifetimePrice, compare };
};
