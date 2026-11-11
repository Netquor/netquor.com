// Netquor bundle price calculator. Pure functions, integer cents, no dependencies; also loaded by Node for tests.
// Prices are list prices copied from the product pages and ~/Documents/netquor-phone/site/phone/pricing.js. Change them here only.
(function (root) {
  var PRICES = {
    fleet: { macCents: 595, deviceCents: 395, macYearCents: 5950, deviceYearCents: 3950, packSize: 10 },
    phone: {                                                          // planned launch prices; nobody is billed during early access
      starter: { cents: 2500, users: 1, label: 'Starter' },
      business: { cents: 7900, users: 5, extraUserCents: 900, label: 'Business' }
    },
    vpn: { lite: { cents: 500, label: 'Lite' }, plus: { cents: 1000, label: 'Plus' }, fast: { cents: 2000, label: 'Fast' }, gigabit: { cents: 3000, label: 'Gigabit' } },
    // Bundle: percent off the plan fees of every eligible product, by how many BILLABLE products are used together (2 or more).
    // Eligible: Fleet (built and run in house), VPN, and Phone once it bills. Phone keeps >= 40% margin at 15% off monthly plan fees
    // (docs/pricing-model.md). Netquor SDN is quoted per site, so it is not in this calculator. Change the rates here only.
    bundlePercent: { 0: 0, 1: 0, 2: 10, 3: 15 },
    eligible: { fleet: true, vpn: true, phone: true }
  };
  var LIMITS = { devices: 500, people: 100 };

  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function int(v, min, max, fallback) {
    var t = String(v === null || v === undefined ? '' : v).trim();
    if (!/^[-+]?\d+$/.test(t)) return fallback;      // whole numbers only: no 1e9, 1,000, 0x10 or 0.5
    var n = Number(t);
    return Math.min(max, Math.max(min, n));
  }
  function sum(lines) { return lines.reduce(function (n, l) { return n + l.cents; }, 0); }
  function usd(cents) { return (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2); }
  function discountOf(cents, percent) { return Math.floor((cents * percent + 50) / 100); }   // half up, integer cents only

  function totals(eligibleCents, lines, productCount) {
    var percent = eligibleCents > 0 ? PRICES.bundlePercent[Math.min(productCount, 3)] : 0;
    var discount = discountOf(eligibleCents, percent);
    var list = lines.reduce(function (n, l) { return n + l.cents; }, 0);
    return { listCents: list, discountCents: discount, totalCents: list - discount, percent: percent, products: productCount, eligibleCents: eligibleCents };
  }

  function calc(input) {
    var i = input || {};
    var macs = int(i.macs, 0, LIMITS.devices, 0), devices = int(i.devices, 0, LIMITS.devices, 0);
    var phone = has(PRICES.phone, i.phone) ? i.phone : 'none', vpn = has(PRICES.vpn, i.vpn) ? i.vpn : 'none';
    var people = phone === 'business' ? int(i.people, 1, LIMITS.people, 5) : (phone === 'starter' ? 1 : 0);

    var fleetCents = macs * PRICES.fleet.macCents + devices * PRICES.fleet.deviceCents;
    var fleetLine = macs + devices > 0 ? { key: 'fleet', label: 'Netquor Fleet: ' + macs + (macs === 1 ? ' Mac' : ' Macs') + ' and ' + devices + (devices === 1 ? ' iPhone or iPad' : ' iPhones or iPads'), cents: fleetCents } : null;
    var vpnLine = vpn !== 'none' ? { key: 'vpn', label: 'Netquor VPN: ' + PRICES.vpn[vpn].label, cents: PRICES.vpn[vpn].cents } : null;
    var phoneLine = null;
    if (phone !== 'none') {
      var p = PRICES.phone[phone], extra = phone === 'business' ? Math.max(0, people - p.users) : 0;
      phoneLine = { key: 'phone', label: 'Netquor Phone: ' + p.label + (extra ? ', ' + people + ' people' : ''), cents: p.cents + extra * (p.extraUserCents || 0) };
    }

    // TODAY: only products that can be billed now (Fleet and VPN). Phone is early access, so it neither adds to the total nor counts toward the tier.
    var todayLines = [fleetLine, vpnLine].filter(Boolean);
    var today = totals(sum(todayLines), todayLines, todayLines.length);
    today.lines = todayLines;

    // AT PHONE LAUNCH: the same setup with Phone billable. Shown separately and labelled as planned.
    var launch = null;
    if (phoneLine) {
      var launchLines = todayLines.concat([phoneLine]);
      launch = totals(sum(launchLines), launchLines, launchLines.length);
      launch.lines = launchLines;
    }

    // ANNUAL FLEET (before volume pricing): licenses are sold in packs of 10 per device type, so small fleets round up.
    var annual = null;
    if (fleetCents > 0) {
      var packs = function (n) { return Math.ceil(n / PRICES.fleet.packSize) * PRICES.fleet.packSize; };
      var yearCents = packs(macs) * PRICES.fleet.macYearCents + packs(devices) * PRICES.fleet.deviceYearCents;
      var monthlyYearCents = 12 * (fleetCents - discountOf(fleetCents, today.percent));      // a year of monthly Fleet billing with today's bundle percent
      annual = { yearCents: yearCents, monthlyYearCents: monthlyYearCents, annualCheaper: yearCents < monthlyYearCents, exactPacks: macs % 10 === 0 && devices % 10 === 0 };
    }
    return { today: today, launch: launch, annual: annual, hasPhone: !!phoneLine, empty: fleetCents === 0 && !vpnLine && !phoneLine, usd: usd };
  }

  var PRESETS = {
    solo: { name: 'Solo owner', macs: 1, devices: 1, phone: 'starter', people: 1, vpn: 'lite' },
    office: { name: 'Four-person office', macs: 4, devices: 4, phone: 'business', people: 4, vpn: 'fast' },
    team: { name: 'Ten-person team', macs: 10, devices: 10, phone: 'business', people: 10, vpn: 'gigabit' }
  };
  var api = { PRICES: PRICES, PRESETS: PRESETS, LIMITS: LIMITS, calc: calc, usd: usd };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NQBundle = api;
})(typeof self !== 'undefined' ? self : this);
