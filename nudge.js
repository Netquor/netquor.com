// A quiet, relevant prompt on product pages: "Looking at X? See the readiness checklist."
// Rules: shown once per session, after real engagement (25 seconds and 40% scroll), only for people using a pointer,
// never for keyboard-only or reduced-motion visitors, never over content (a small corner card), easy to dismiss.
(function () {
  var MAP = {
    'fleet.html': ['devices', 'Looking at Netquor Fleet?', 'See the Apple device readiness checklist. Seven questions, about two minutes.'],
    'vpn.html': ['network', 'Looking at remote access?', 'See the network and remote access checklist. Seven questions, about two minutes.'],
    'network.html': ['network', 'Looking at routable IPs?', 'See the network and remote access checklist. Seven questions, about two minutes.'],
    'sdn.html': ['network', 'Looking at managed networking?', 'See the network readiness checklist. Seven questions, about two minutes.'],
    'homeassistant.html': ['people', 'Looking at a smarter building?', 'See the people and access checklist. Seven questions, about two minutes.'],
    'digitalaccess.html': ['people', 'Looking at building access?', 'See the people and access checklist. Seven questions, about two minutes.'],
    'central.html': ['people', 'Looking at Netquor Central?', 'See the people and access checklist. Seven questions, about two minutes.']
  };
  var page = (location.pathname.split('/').pop() || 'index.html'), hit = MAP[page];
  if (!hit) return;
  try { if (sessionStorage.getItem('nq-nudge') === '1') return; } catch (e) {}
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
  if (reduce || !fine) return;
  var keyboard = false, ready = false, scrolled = false, shown = false;
  window.addEventListener('keydown', function (e) { if (e.key === 'Tab') keyboard = true; });
  setTimeout(function () { ready = true; maybe(); }, 25000);
  window.addEventListener('scroll', function () {
    var h = document.documentElement; if ((h.scrollTop + innerHeight) / h.scrollHeight >= 0.4) { scrolled = true; maybe(); }
  }, { passive: true });
  function maybe() { if (shown || !ready || !scrolled || keyboard) return; shown = true; show(); }
  function dismiss(box) { try { sessionStorage.setItem('nq-nudge', '1'); } catch (e) {} box.classList.remove('in'); setTimeout(function () { box.remove(); }, 250); }
  function show() {
    var box = document.createElement('aside'); box.className = 'nq-nudge'; box.setAttribute('role', 'complementary'); box.setAttribute('aria-label', 'Suggested checklist');
    var t = document.createElement('b'); t.textContent = hit[1];
    var p = document.createElement('p'); p.textContent = hit[2];
    var go = document.createElement('a'); go.href = 'readiness.html#' + hit[0]; go.textContent = 'Open the checklist'; go.className = 'nq-nudge-go';
    var no = document.createElement('button'); no.type = 'button'; no.textContent = 'Not now'; no.className = 'nq-nudge-no';
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;'; x.className = 'nq-nudge-x';
    [no, x].forEach(function (b) { b.addEventListener('click', function () { dismiss(box); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.contains(box)) dismiss(box); });
    var row = document.createElement('div'); row.className = 'nq-nudge-row'; row.appendChild(go); row.appendChild(no);
    box.appendChild(x); box.appendChild(t); box.appendChild(p); box.appendChild(row);
    document.body.appendChild(box); requestAnimationFrame(function () { box.classList.add('in'); });
  }
})();
