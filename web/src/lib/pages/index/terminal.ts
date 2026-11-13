// The homelab terminal types itself out when it scrolls into view. Ported from the inline script of the legacy page: "typing" on <html> hides the lines (CSS in the page head), "play" on .term runs the animation once the terminal is on screen.
export interface TerminalDoc {
    querySelector(sel: string): HTMLElement | null;
    documentElement: HTMLElement;
}

/** Returns a cleanup function. */
export const initTerminal = (doc: TerminalDoc, win: Window = window): (() => void) => {
    const t = doc.querySelector(".term");
    if (!t) return () => {};
    doc.documentElement.classList.add("typing");
    let done = false;
    let observer: IntersectionObserver | undefined;
    const stop = () => {
        win.removeEventListener("scroll", check);
        win.removeEventListener("resize", check);
        observer?.disconnect();
    };
    function play() {
        if (done) return;
        done = true;
        t!.classList.add("play");
        stop();
    }
    function check() {
        const r = t!.getBoundingClientRect();
        if (r.top < win.innerHeight * 0.85 && r.bottom > win.innerHeight * 0.15) play();
    }
    if ("IntersectionObserver" in win) {
        observer = new IntersectionObserver((es, o) => {
            es.forEach((e) => { if (e.isIntersecting) { play(); o.disconnect(); } });
        }, { threshold: 0.35 });
        observer.observe(t);
    }
    // A scroll check as well, in case the observer never reports (some embedded or throttled views).
    win.addEventListener("scroll", check, { passive: true });
    win.addEventListener("resize", check);
    check();
    return stop;
};
