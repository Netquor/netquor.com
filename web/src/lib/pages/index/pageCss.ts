// The page-specific CSS of the legacy home page (its inline <style> block), unchanged except for two rules that never applied there and would here: the `body` colours (nq.css, loaded after the block in the legacy head, overrides all three properties) and the map label hover colour (nq.css has the same rule and wins in the legacy head). In the Svelte page this block sits after nq.css in the head, so those two rules would otherwise win over it.
export const PAGE_CSS = `
        :root {
            --cyber-blue: #5eaaf0;
            --obsidian: #12161c;
            --slate-800: #1e293b;
        }

        .navbar {
            backdrop-filter: blur(15px);
            background: rgba(2, 6, 23, 0.8);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        
              
        
        .icon-accent {
            font-size: 2rem;
            color: var(--cyber-blue);
            margin-bottom: 1.5rem;
            display: inline-block;
        }

        
        footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding: 60px 0;
        }

        /* Logo is dark slate on transparent, so it sits on a light plate */
        .brand-logo-img { height: 44px; width: auto; background: #f1f5f9; border-radius: 10px; padding: 3px 8px; }
        .brand-logo-img-lg { height: 96px; padding: 6px 14px; border-radius: 14px; }

        section[id], header[id] { scroll-margin-top: 84px; }

        /* --- Hello, Homelabbers --- */
        .homelab { position: relative; padding: 90px 0 70px; overflow: hidden; }
                .homelab .container { position: relative; }
        .hello { margin: 0; }
        .chip { display: inline-flex; align-items: center; gap: .4rem; padding: .35rem .8rem; border-radius: 50px; font-size: .82rem; font-weight: 600; color: #e2e8f0; background: rgba(56, 189, 248, 0.09); border: 1px solid rgba(56, 189, 248, 0.25); }
        .chip i { color: var(--cyber-blue); }
        .price-pop { display: inline-flex; align-items: baseline; gap: .35rem; padding: 8px 16px; border-radius: 12px; background: var(--nq-s1); border: 1px solid var(--nq-line-2); font-variant-numeric: tabular-nums; }
        .price-pop b { font-family: var(--nq-display); font-size: 1.75rem; font-weight: 600; color: var(--nq-ink); }
        .term { background: #090c10; border: 1px solid var(--nq-line-2); border-radius: 14px; overflow: hidden; font-family: var(--nq-mono); }
        .term-bar { display: flex; align-items: center; gap: 7px; padding: .65rem .9rem; background: rgba(255, 255, 255, .04); border-bottom: 1px solid rgba(255, 255, 255, .06); }
        .term-bar span { width: 10px; height: 10px; border-radius: 50%; background: var(--nq-s3); }
        .term-bar em { margin-left: .5rem; font-style: normal; font-size: .75rem; color: var(--nq-ink-3); }
        .term-body { padding: 1.1rem 1.2rem 1.3rem; font-size: .82rem; line-height: 1.75; color: #cbd5e1; }
        .term-body .l { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
        .typing .term-body .l { clip-path: inset(0 100% 0 0); }
        .typing .term.play .term-body .l { animation: reveal .9s steps(34) forwards; animation-delay: var(--d, 0s); }
        .term-body .p { color: var(--nq-accent-t); } .term-body .ok { color: var(--nq-ok); } .term-body .dim { color: var(--nq-ink-3); } .term-body .ip { color: var(--nq-ink); }
        .term-body .cur { display: inline-block; width: .55em; height: 1.05em; background: var(--nq-accent-t); vertical-align: -.18em; animation: blink 1s steps(1) infinite; }
        @keyframes reveal { to { clip-path: inset(0 0 0 0); } }
        @keyframes blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
                .typing .term-body .l, .typing .term.play .term-body .l { clip-path: none; animation: none; }
        }
            /* Product map: the logo's trace-and-node idea, linking the six products to one network. */
        .nq-map { width: 100%; height: auto; display: block; }
        .nq-map-lines path { stroke: var(--nq-accent); opacity: .85; }
        .nq-map-nodes circle { fill: var(--nq-accent); }
        .nq-map-labels text { font: 500 15px var(--nq-body); fill: var(--nq-ink); transition: fill .15s; }
        .nq-map-labels text.sub { font: 400 12px var(--nq-mono); fill: var(--nq-ink-3); }
        .nq-map-labels a { cursor: pointer; }
        @media (max-width: 575.98px) { .nq-map-labels text { font-size: 17px; } .nq-map-labels text.sub { font-size: 14px; } }
    `;
