// "What does it cost you" calculators for netquor.com. Pure functions, no dependencies; also loaded by Node for tests.
// Nothing is assumed: the visitor's own numbers go in, and a figure comes out. We add only our own list prices,
// so the result can be set beside them. We make no claim about how much time any product saves.
(function (root) {
  var WEEKS = 52, MONTHS = 12, WORK_WEEK_HOURS = 40;
  var PRICES = {                                 // list prices, US dollars; keep in step with the product pages
    fleet: { macMonthly: 5.95, deviceMonthly: 3.95 },
    phoneStarterMonthly: 25                      // planned launch price; Phone is in early access and not billed yet
  };
  var MAX = 1e6;                                  // sanity cap on every input
  function num(v) {
    if (v === null || v === undefined) return null;
    var t = String(v).trim();
    if (t === '') return null;
    if (/^[-+]?0[xob]/i.test(t)) return NaN;      // hex, octal and binary notation are not numbers here
    var n = Number(t);
    return isFinite(n) ? n : NaN;
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  // Time spent on device setup, one-off app and settings work, and sign-in and password interruptions.
  function deviceTime(i) {
    i = i || {};
    var f = { newPerYear: num(i.newPerYear), setupHours: num(i.setupHours), changesPerWeek: num(i.changesPerWeek), changeMinutes: num(i.changeMinutes),
              signinsPerWeek: num(i.signinsPerWeek), signinMinutes: num(i.signinMinutes), hourly: num(i.hourly), macs: num(i.macs), devices: num(i.devices) };
    var keys = Object.keys(f);
    for (var k = 0; k < keys.length; k++) if (f[keys[k]] === null) f[keys[k]] = 0;
    for (k = 0; k < keys.length; k++) if (!(f[keys[k]] >= 0 && f[keys[k]] <= MAX)) return { error: 'Use numbers from zero to ' + MAX.toLocaleString('en-US') + '.' };
    var setup = f.newPerYear * f.setupHours;
    var changes = f.changesPerWeek * f.changeMinutes / 60 * WEEKS;
    var signins = f.signinsPerWeek * f.signinMinutes / 60 * WEEKS;
    var hours = setup + changes + signins;
    if (hours > 0 && f.hourly === 0 && !(i.hourly === 0 || i.hourly === '0')) return { error: 'Enter what an hour of your time is worth.' };
    var dollars = hours * f.hourly;
    var fleetYear = (f.macs * PRICES.fleet.macMonthly + f.devices * PRICES.fleet.deviceMonthly) * MONTHS;
    var share = [25, 50, 75].map(function (p) { return { percent: p, hours: round2(hours * p / 100), dollars: round2(dollars * p / 100) }; });
    return { rate: f.hourly, setupHours: round2(setup), changeHours: round2(changes), signinHours: round2(signins), hours: round2(hours), weeks: round2(hours / WORK_WEEK_HOURS),
             dollars: round2(dollars), perMonth: round2(dollars / MONTHS), fleetYear: round2(fleetYear), share: share, empty: hours === 0 };
  }

  // Missed calls: jobs lost per week x value of a job.
  function missedCalls(i) {
    i = i || {};
    var value = num(i.value), missed = num(i.missed), jobs = num(i.jobs);
    if (value === null || missed === null || jobs === null) return { empty: true };
    if (![value, missed, jobs].every(function (n) { return isFinite(n) && n >= 0 && n <= MAX; })) return { error: 'Use numbers from zero to ' + MAX.toLocaleString('en-US') + '.' };
    if (jobs > missed) return { error: 'You cannot lose more jobs than calls you miss. Check the last number.' };
    var yearly = jobs * WEEKS * value, monthly = yearly / MONTHS;
    var needed = value > 0 ? Math.max(1, Math.ceil(PRICES.phoneStarterMonthly / value)) : null;
    return { yearly: round2(yearly), monthly: round2(monthly), jobsToPayForStarter: needed, starterMonthly: PRICES.phoneStarterMonthly };
  }
  var api = { PRICES: PRICES, deviceTime: deviceTime, missedCalls: missedCalls };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NQCost = api;
})(typeof self !== 'undefined' ? self : this);
