// Google Analytics 4 for netquor.com. Paste your Measurement ID below (it looks like G-XXXXXXXXXX). Left empty, nothing is loaded and nothing is sent.
// Run  python3 tools/build-nav.py  after editing so every page picks up the new version.
(function () {
    var MEASUREMENT_ID = "G-DDM7J28WFG";

    if (!/^G-[A-Z0-9]{6,}$/.test(MEASUREMENT_ID)) return;

    // Respect the visitor's privacy signals: Global Privacy Control and Do Not Track switch analytics off.
    var nav = window.navigator || {};
    if (nav.globalPrivacyControl === true || nav.doNotTrack === "1" || window.doNotTrack === "1") return;

    // The page can opt out too: window['ga-disable-G-XXXX'] = true is Google's own switch.
    if (window["ga-disable-" + MEASUREMENT_ID]) return;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID, {
        anonymize_ip: true,                 // GA4 does not store full IPs; this keeps older settings consistent
        allow_google_signals: false,        // no cross-device advertising features
        allow_ad_personalization_signals: false
    });

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);
})();
