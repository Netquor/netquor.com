/* Netquor hero background: hairline grid, circuit traces ending in nodes, one travelling pulse.
   Static SVG always; the pulse is skipped for reduced motion and Save-Data, pauses off-screen and in hidden tabs,
   and has a visible pause control. No libraries. */
(function () {
  var hero = document.querySelector('.hero-section');
  if (!hero || !hero.getBoundingClientRect) return;
  var NS = 'http://www.w3.org/2000/svg', G = 48;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var paused = false;
  try { paused = localStorage.getItem('nq-bg-paused') === '1'; } catch (e) {}

  var wrap = document.createElement('div');
  wrap.className = 'nq-bg'; wrap.setAttribute('aria-hidden', 'true');
  var svg = document.createElementNS(NS, 'svg');
  var cv = document.createElement('canvas');
  wrap.appendChild(svg); wrap.appendChild(cv);
  hero.insertBefore(wrap, hero.firstChild);

  var W = 0, H = 0, paths = [], ctx = cv.getContext('2d'), pulse = null, nextAt = 1200, last = 0, visible = true, raf = 0;
  var snap = function (v) { return Math.round(v / G) * G; };

  function build() {
    W = hero.clientWidth; H = hero.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // traces live in the bottom band and far edges, away from the headline and the product map
    var base = snap(H - 32);
    var seeds = [
      [0.04, base, [[0, 0], [2, 0], [2, -1], [5, -1]]],
      [0.30, base + G, [[0, 0], [4, 0], [4, -1], [8, -1]]],
      [0.62, base, [[0, 0], [3, 0], [3, 1], [7, 1]]],
      [0.86, base, [[0, 0], [2, 0], [2, -1], [4, -1]]]
    ];
    paths = []; var out = '';
    seeds.forEach(function (s) {
      var ox = snap(W * s[0]), oy = s[1];
      var P = s[2].map(function (p) { return [ox + p[0] * G, oy + p[1] * G]; }).filter(function (p) { return p[0] <= W && p[1] <= H && p[1] > 0; });
      if (P.length < 2) return; paths.push(P);
      out += '<polyline points="' + P.map(function (p) { return p.join(','); }).join(' ') + '" fill="none" stroke="#2f8fe0" stroke-opacity=".3" stroke-width="1.5" stroke-linejoin="round"/>';
      var e = P[P.length - 1];
      out += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="3.5" fill="#12161c" stroke="#5eaaf0" stroke-opacity=".6" stroke-width="1.5"/>';
    });
    svg.innerHTML = '<defs><pattern id="nqg" width="' + G + '" height="' + G + '" patternUnits="userSpaceOnUse"><path d="M' + G + ' 0H0V' + G + '" fill="none" stroke="#eaf1f8" stroke-opacity=".05"/></pattern>' +
      '<linearGradient id="nqf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12161c" stop-opacity="1"/><stop offset=".35" stop-color="#12161c" stop-opacity=".2"/><stop offset=".8" stop-color="#12161c" stop-opacity=".1"/><stop offset="1" stop-color="#12161c" stop-opacity="1"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#nqg)"/>' + out + '<rect width="100%" height="100%" fill="url(#nqf)"/>';
  }
  function len(P) { var L = 0; for (var i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
  function at(P, d) {
    for (var i = 1; i < P.length; i++) {
      var l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      if (d <= l) { var t = d / l; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; }
      d -= l;
    }
    return P[P.length - 1];
  }
  var idx = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden || paused) { last = t; return; }
    ctx.clearRect(0, 0, W, H);
    if (!pulse && t > nextAt && paths.length) { var P = paths[idx++ % paths.length]; pulse = { P: P, L: len(P), d: 0 }; }
    if (pulse) {
      pulse.d += Math.min(t - last, 50) * 0.16;
      for (var k = 0; k < 60; k += 3) {
        var d = pulse.d - k; if (d < 0 || d > pulse.L) continue;
        var q = at(pulse.P, d); ctx.fillStyle = 'rgba(94,170,240,' + ((1 - k / 60) * 0.85) + ')'; ctx.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3);
      }
      if (pulse.d > pulse.L + 60) { pulse = null; nextAt = t + 6000; ctx.clearRect(0, 0, W, H); }
    }
    last = t;
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, W, H); pulse = null; }

  build();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
  if (reduce || saveData) return;   // static grid and traces only, no control needed
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(hero);

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'nq-bg-pause';
  function label() { btn.textContent = paused ? 'Play background motion' : 'Pause background motion'; btn.setAttribute('aria-pressed', paused ? 'true' : 'false'); }
  btn.addEventListener('click', function () {
    paused = !paused; label();
    try { localStorage.setItem('nq-bg-paused', paused ? '1' : '0'); } catch (e) {}
    if (paused) stop(); else start();
  });
  label(); hero.appendChild(btn);
  if (!paused) start();
})();
