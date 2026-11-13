// Browser-side UI audit. In the page: (await import('/tools/ui-audit.js')).default()
// Reports: horizontal overflow, uneven cards within a row, wrapped compact labels, small tap targets, text under 4.5:1 contrast, unlabeled controls.
export default async function audit() {
  document.querySelectorAll('.nq-r').forEach(e => e.classList.add('nq-shown'));
  const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = e => { let x = e; while (x) { const p = parse(getComputedStyle(x).backgroundColor); if (p && p.a > .5) return p.c; x = x.parentElement; } return [18, 22, 28]; };
  const visible = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]') && !(e.closest('.nq-dd-menu') && !e.closest('.nq-dd.open')); };
  const out = { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth ? document.documentElement.scrollWidth + ' > ' + document.documentElement.clientWidth : false, uneven: [], wrapped: [], small: [], contrast: [], unlabeled: [] };
  ['.nq-apps', '.nq-who-grid', '.nq-ready-grid', '.nq-safe', '.nq-calcs', '.nq-facts'].forEach(sel => document.querySelectorAll(sel).forEach(g => {
    const rows = {}; [...g.children].forEach(c => { if (!visible(c)) return; const r = c.getBoundingClientRect(); const k = Math.round(r.top / 10); (rows[k] = rows[k] || []).push(Math.round(r.height)); });
    Object.values(rows).forEach(rw => { if (rw.length > 1 && new Set(rw).size > 1) out.uneven.push(sel + ' ' + JSON.stringify(rw)); });
  }));
  document.querySelectorAll('.nq-app-status,.chip,.badge,.nq-chips2 a,.nq-eyebrow,.nq-nudge-go,.nq-check-tabs a').forEach(e => { if (!visible(e)) return; const r = e.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(e); const lines = new Set([...range.getClientRects()].map(x => Math.round(x.top))).size; if (lines > 1) out.wrapped.push(e.textContent.trim().slice(0, 40)); });
  document.querySelectorAll('a,button,input:not([type=hidden]),select,summary').forEach(e => { if (!visible(e)) return; const r = e.getBoundingClientRect(); const inline = getComputedStyle(e).display === 'inline' && e.tagName === 'A'; if (!inline && (r.height < 24 || r.width < 24)) out.small.push(e.tagName + ' ' + (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  const seen = new Set();
  document.querySelectorAll('p,li,a,span,td,th,h1,h2,h3,h4,label,small,b,summary,dt,dd,button,figcaption').forEach(e => {
    if (!visible(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
    const cs = getComputedStyle(e); const fg = parse(cs.color); if (!fg) return; const bg = bgOf(e);
    const L1 = lum(fg.c), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const key = cs.color + '|' + bg.join(',') + '|' + Math.round(parseFloat(cs.fontSize));
    if (ratio < 4.5 && !seen.has(key)) { seen.add(key); out.contrast.push(ratio.toFixed(2) + ' ' + cs.color + ' on rgb(' + bg.join(',') + ') ' + cs.fontSize + ' "' + e.textContent.trim().slice(0, 28) + '"'); }
  });
  document.querySelectorAll('input:not([type=hidden]):not([type=radio]),select,textarea').forEach(e => { if (!visible(e)) return; const ok = (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label') || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'); if (!ok) out.unlabeled.push(e.id || e.name || e.tagName); });
  return JSON.stringify(out);
}
