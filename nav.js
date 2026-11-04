// Shared site navigation behavior: mobile menu and the Products dropdown. Plain JavaScript, no dependencies.
document.documentElement.classList.add('nq-js');
document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('.nq-nav');
    if (!nav) return;
    var burger = nav.querySelector('.nq-burger'), menu = nav.querySelector('.nq-menu');
    var dd = nav.querySelector('.nq-dd'), btn = dd && dd.querySelector('.nq-dd-btn');
    var desktop = window.matchMedia('(min-width: 992px)');
    function setDd(open) { if (!dd) return; dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); }
    function setMenu(open) { menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); }
    burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    if (dd) {
        btn.addEventListener('click', function (e) { e.stopPropagation(); setDd(desktop.matches ? true : !dd.classList.contains('open')); });
        dd.addEventListener('mouseenter', function () { if (desktop.matches) setDd(true); });
        dd.addEventListener('mouseleave', function () { if (desktop.matches) setDd(false); });
        document.addEventListener('click', function (e) { if (!dd.contains(e.target)) setDd(false); });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        setDd(false); setMenu(false);
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) { setDd(false); setMenu(false); } });
});
