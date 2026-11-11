// Motion and interaction for netquor.com. Everything here is optional: with reduced motion or no JavaScript the page is complete and static.
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // 1. Scroll progress line
  var bar = document.createElement('div'); bar.className = 'nq-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  function prog() { var h = root.scrollHeight - innerHeight; bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')'; }
  addEventListener('scroll', prog, { passive: true }); prog();

  // 2. Signal pulses travel from the hub along each trace, and hovering a product lights its trace
  var map = document.querySelector('.nq-map');
  if (map) {
    var lines = [].slice.call(map.querySelectorAll('.nq-map-lines path'));
    var labels = [].slice.call(map.querySelectorAll('.nq-map-labels > a'));
    var order = [8, 0, 1, 2, 3, 4, 5, 6, 7];   // label i -> trace index. The centre label (Netquor Central) is authored first; its trace is the last path.
    var pulses = [];
    lines.forEach(function (p, i) {
      p.setAttribute('pathLength', '100');
      var c = p.cloneNode(); c.setAttribute('class', 'nq-pulse'); c.setAttribute('pathLength', '100'); c.style.animationDelay = (i * 0.55) + 's';
      p.parentNode.appendChild(c); pulses.push(c);
    });
    // traces are authored left (4), right (4), then the centre trace last
    // tap area: an invisible rect behind each label so the link is easy to hit on a phone
    labels.forEach(function (a) { try { var b = a.getBBox(), r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); r.setAttribute('x', b.x - 14); r.setAttribute('y', b.y - 22); r.setAttribute('width', b.width + 28); r.setAttribute('height', b.height + 44); r.setAttribute('fill', 'transparent'); a.insertBefore(r, a.firstChild); } catch (e) {} });
    labels.forEach(function (a, i) {
      var on = function () { if (lines[order[i]]) { lines[order[i]].classList.add('hot'); pulses[order[i]].classList.add('hot'); } };
      var off = function () { if (lines[order[i]]) { lines[order[i]].classList.remove('hot'); pulses[order[i]].classList.remove('hot'); } };
      a.addEventListener('mouseenter', on); a.addEventListener('focus', on); a.addEventListener('mouseleave', off); a.addEventListener('blur', off);
    });
  }
  if (reduce) return;

  // 3. Reveal sections and cards as they enter, with a short stagger
  if ('IntersectionObserver' in window) {
    root.classList.add('nq-reveal-on');
    var targets = [].slice.call(document.querySelectorAll('.nq-section-head, .nq-who, .nq-app, .nq-calc, .nq-start, .nq-bundle, .nq-prices, .nq-cmp-list details, .nq-facts li, .nq-together li, .nq-check'));
    targets.forEach(function (t, i) { t.classList.add('nq-r'); t.style.transitionDelay = ((i % 3) * 70) + 'ms'; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('nq-shown'); io.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }

  // 4. Card spotlight follows the pointer
  document.addEventListener('pointermove', function (e) {
    var card = e.target.closest && e.target.closest('.nq-app, .nq-who, .nq-calc, .nq-check, .nq-prices-row');
    if (!card) return;
    var r = card.getBoundingClientRect(); card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();
