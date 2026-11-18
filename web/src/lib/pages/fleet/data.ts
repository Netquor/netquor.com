// data.ts: the copy of fleet.html that repeats, as typed data. Text fields are trusted HTML (rendered with Rich.svelte). A token {{fleet.mac.month}} or {{fleet.mac.month:usd}} is a price from the live price cache (key and optional format), never typed text.
export interface Feature { icon: string; title: string; text: string }
export interface Chip { b: string; s: string }
export interface Step { n: string; h: string; p: string }
export interface Tier { lic: string; buy: string; pct: string; bps: number }
export interface FaqItem { q: string; a: string; ld: boolean }

export const features: Feature[] = [
    {"icon": "devices", "title": "Enroll and see everything", "text": "Enroll Macs, iPhones and iPads over the air. See hardware, OS version, security status (FileVault, firewall, SIP), installed apps, profiles and certificates, refreshed daily and on demand."},
    {"icon": "sliders", "title": "Settings, without the guesswork", "text": "Guided forms for every Apple setting (127 payloads), with plain-English names, validation and a live preview. Profiles are signed, scoped to devices or groups, and show exactly what landed and where it failed."},
    {"icon": "store", "title": "Buffet, a friendly self-service app", "text": "On every Mac, iPhone and iPad. People install what you offer them, with your name, logo and colors, and see what is already on their device."},
    {"icon": "box", "title": "A library of apps, one click", "text": "Search about 4,000 Mac apps by name. Each Mac downloads the right build for its chip and macOS straight from the vendor, checked by checksum or code signature. For iPhone and iPad, search the App Store and add."},
    {"icon": "refresh", "title": "Patching that is polite", "text": "New releases are held back for a few days, then updated automatically. If an app is open, people choose Update now or Later. Only updates signed by the same developer as the installed app are accepted."},
    {"icon": "list", "title": "Policies for new devices", "text": "List the apps and scripts a group should have. Every Mac in the group works through the list in order, skips apps it already has, retries failures, and a Mac that joins later sets itself up."},
    {"icon": "ban", "title": "Block what should not run", "text": "Stop restricted apps before they launch, by developer, name or path, with a friendly notice to the person. Remove them if you choose."},
    {"icon": "shield", "title": "Endpoint security with Santa", "text": "Hosted, managed Santa for your Macs: allow and block rules by group, Monitor and Lockdown modes, a log of what was blocked, and a malware feed. One click to switch on. <a href=\"#santa\">How it works</a>"},
    {"icon": "terminal", "title": "Scripts, packages, clean uninstalls", "text": "Run scripts as root or as the signed-in user. Install packages, disk images and zip files. Uninstall an app and the files it left behind."},
    {"icon": "shield", "title": "Built to be trusted", "text": "Built on Apple's own MDM protocol. Device credentials are per device and can be revoked. Setup codes are single-use. Downloads are verified before anything is installed."},
];

/** Inner HTML of each tick item's span. */
export const buffetTicks: string[] = [
    "<b>Scoped to who should see it.</b> Groups and individual devices see only what you offer them.",
    "<b>Knows what is installed.</b> Apps already on the device show as Installed, with their version.",
    "<b>Update buttons.</b> When a newer release is ready, the app shows Update right on its card.",
    "<b>Your brand.</b> Your name, tagline, logo and accent color, on Mac, iPhone and iPad.",
    "<b>Zero-touch on iPhone.</b> The device receives its setup from your MDM, or from a home screen icon you send. No password to type."
];

/** Inner HTML of each tick item's span. */
export const vendorTicks: string[] = [
    "<b>The real settings, from the source.</b> Chrome's 540 policies come straight from Chromium's own definitions, each with the description its authors wrote. Other apps are written from the vendor's documentation.",
    "<b>Forms, not XML.</b> Switch on only what you want to manage; everything else stays at the app's default. Values are checked before they are sent, and you can see the exact profile.",
    "<b>WireGuard tunnels, ready to use.</b> Paste a tunnel's configuration and it appears in the WireGuard app and the system VPN settings on Mac, iPhone and iPad. Unsupported options are caught before they reach a device.",
    "<b>Mac tooling, one click.</b> Put the command-line tools your scripts rely on on every Mac: dockutil, mas, swiftDialog and 5 more, from their authors' own releases. Each Mac gets the installer for its processor, and it is installed only if the developer's signature or the published checksum checks out.",
    "<b>Any other app.</b> If an app reads managed preferences, enter its preference domain and the keys it documents. Scoping, versions and rollout status work like any other profile."
];

/** Inner HTML of each tick item's span. */
export const santaTicks: string[] = [
    "<b>One click to switch on.</b> Enable Santa sets up the profiles it needs, installs the package and adds a starter rule set that allows Santa itself. Macs start in Monitor mode, so nothing breaks while you look.",
    "<b>Monitor first, then Lockdown.</b> Monitor records what would have been blocked. Lockdown lets only approved programs run. You choose, for everyone or for a group, and where rules disagree the stricter one wins.",
    "<b>Rules for the people who need them.</b> Allow and block lists apply to every Mac or to the groups you pick, and each Mac receives a complete, consistent set, never a half-finished one.",
    "<b>See what was blocked.</b> Blocked launches, and the ones Monitor would have blocked, are listed with the Mac that ran them and kept for 90 days. Turn one into an allow rule in a click.",
    "<b>Known macOS malware, blocked.</b> Switch on a feed of recent macOS malware from abuse.ch's MalwareBazaar, refreshed hourly, and Santa blocks those files.",
    "<b>Yours alone.</b> Your rules, Macs and events live in your own instance, kept apart from every other customer."
];

/** Inner HTML of each tick item's span. */
export const apiTicks: string[] = [
    "<b>Complete.</b> Devices, profiles, groups, policies, patching, software, Buffet catalog, vendor policies and scripts, over 100 endpoints.",
    "<b>Plain JSON over HTTPS.</b> No SDK to install. If you can run <span class=\"mono\">curl</span>, you can automate it.",
    "<b>Locked down.</b> Every request carries your secret key, and the API can be limited to your office or VPN addresses.",
    "<b>An event feed.</b> Read what every device has reported over the last 90 days, to feed your own dashboards and alerts."
];

/** Inner HTML of each tick item's span. */
export const mdmTicks: string[] = [
    "<b>Low-cost and discounted.</b> {{fleet.mac.month}} per Mac and {{fleet.mobile.month}} per iPhone or iPad per month. Two months free on annual, up to 25% off more in volume, or pay once for a lifetime license.",
    "<b>No minimum seats.</b> Month to month, no contract, no minimum device count. Start with one device.",
    "<b>Self-service for your people.</b> Buffet lets employees install approved apps and updates themselves.",
    "<b>A fully-featured API.</b> Automate everything the console does with plain JSON over HTTPS.",
    "<b>Apple device management done properly.</b> Zero-touch style enrollment, configuration profiles, app patching, scripts, restricted software, FileVault and security status, all in one subscription.",
    "<b>Local support in Fargo, ND and the Midwest.</b> Netquor is a Fargo company. We help businesses in Fargo, West Fargo, Moorhead and across the Midwest roll out Fleet, including on-site setup."
];

/** Inner HTML of each tick item's span. */
export const dedicatedTicks: string[] = [
    "<b>Docker-based, secure cloud containers.</b> Your instance runs in its own containers, kept apart from everyone else's.",
    "<b>Your own URL.</b> Your devices enroll with, and talk to, your address, with your name on it.",
    "<b>We scale with you.</b> As your fleet comes and goes, your instance grows and shrinks with it. As life changes, it keeps up."
];

/** Inner HTML of each tick item's span. */
export const packsTicks: string[] = [
    "<b>One license for a year is {{fleet.mac.year}}</b> for a Mac and {{fleet.mobile.year}} for an iPhone or iPad: ten months of the monthly price, so 2 months are free.",
    "<b>Annual licenses come in packs of 10.</b> A pack costs 10 licenses at the price above, less a volume discount that grows with the number of packs. A fleet rounds up to whole packs, and the licenses you have not used yet roll over. For a handful of devices, month to month is the better fit.",
    "<b>Or buy lifetime licenses, once.</b> {{fleet.mac.lifetime}} per Mac and {{fleet.mobile.lifetime}} per iPhone or iPad, with every update and no renewals. Lifetime licenses are sold in packs of 10 too, with the same pack discounts. It costs 3 years of the annual price, so it pays for itself in year four, and it moves to a replacement device when one leaves your fleet. Lifetime licenses are bought outright, so they have no free trial.",
    "<b>Unused licenses roll over.</b> A license you haven't used carries into your next term, so you never lose what you paid for."
];

/** Inner HTML of each tick item's span. */
export const demoTicks: string[] = [
    "30 days free, any number of devices",
    "A quote for the rest, based on your device counts",
    "We only use this to reply to you"
];

export const vendorChips: Chip[] = [
    {"b": "Google Chrome", "s": "540 settings"},
    {"b": "Microsoft Edge", "s": "66 settings"},
    {"b": "Mozilla Firefox", "s": "57 settings"},
    {"b": "Zoom Workplace", "s": "192 settings"},
    {"b": "Tailscale (Mac App Store)", "s": "38 settings"},
    {"b": "Tailscale (Standalone)", "s": "44 settings"},
    {"b": "Slack", "s": "7 settings"},
    {"b": "1Password", "s": "24 settings"},
    {"b": "WireGuard", "s": "VPN tunnels, Mac and iPhone"},
    {"b": "Any other app", "s": "any app that reads managed preferences"},
];

export const santaChips: Chip[] = [
    {"b": "Monitor", "s": "Allows everything, records what a rule would block"},
    {"b": "Lockdown", "s": "Runs only what you have approved"},
    {"b": "Allow rules", "s": "By developer, file or path"},
    {"b": "Block rules", "s": "Including known malware"},
];

export const facts: Chip[] = [
    {"b": "3", "s": "device types: Mac, iPhone, iPad"},
    {"b": "~4,000", "s": "Mac apps ready to add by name"},
    {"b": "127", "s": "Apple settings with guided forms"},
    {"b": "0", "s": "sign-ins to remember for Buffet"},
];

export const steps: Step[] = [
    {"n": "1", "h": "Enroll your devices", "p": "Install the Netquor Fleet profile on a Mac, iPhone or iPad. It shows up in your inventory straight away."},
    {"n": "2", "h": "Decide who gets what", "p": "Put devices in groups. Map settings, policies and Buffet apps to those groups."},
    {"n": "3", "h": "Let it run", "p": "New devices configure themselves, patching keeps apps current, and Buffet handles the requests."},
];

export const roadmap: Chip[] = [
    {"b": "Windows and Android", "s": "Coming soon. The same console, Buffet and policies for the rest of your fleet, so Apple devices are not the only ones you can manage."},
    {"b": "Automated device enrollment", "s": "Devices bought through Apple Business Manager enroll themselves out of the box."},
    {"b": "Apps and Books licenses", "s": "Install paid iPhone and iPad apps, and install silently on supervised devices."},
    {"b": "Declarative device management", "s": "Apple's newer model, so devices keep themselves in the state you set."},
    {"b": "Single sign-on", "s": "Sign in to the console with your identity provider (SAML and OIDC), with roles for who can do what."},
    {"b": "Scoped API keys and an audit log", "s": "Give each integration its own key with only the access it needs, and see who changed what."},
    {"b": "Outbound webhooks", "s": "Have Netquor Fleet call your tools when a device enrolls, falls behind or fails an install."},
];

export const macPlanList: string[] = [
    "Enrollment and full inventory",
    "Configuration profiles and security settings",
    "Buffet app, scoped and branded",
    "App library with vendor-direct installs",
    "App patching with deferral prompts",
    "Policies for groups of Macs",
    "Scripts, packages and clean uninstall",
    "Restricted software blocking",
    "Vendor app policies (Chrome, Firefox, Zoom, WireGuard and more)"
];

export const iosPlanList: string[] = [
    "Enrollment and full inventory",
    "Configuration profiles and restrictions",
    "Buffet app, scoped and branded",
    "App Store apps added by name",
    "Installed-app detection with versions",
    "Zero-touch Buffet setup",
    "Wi-Fi, VPN, email and more via profiles",
    "WireGuard VPN tunnels"
];

/** The pack discount tiers; the per-license prices in the table are computed from the annual prices (see tokens.ts). */
export const tiers: Tier[] = [
    {"lic": "10 to 19 licenses", "buy": "1 pack", "pct": "5%", "bps": 500},
    {"lic": "20 to 49 licenses", "buy": "2 to 4 packs", "pct": "10%", "bps": 1000},
    {"lic": "50 to 99 licenses", "buy": "5 to 9 packs", "pct": "15%", "bps": 1500},
    {"lic": "100 to 249 licenses", "buy": "10 to 24 packs", "pct": "20%", "bps": 2000},
    {"lic": "250+ licenses", "buy": "25+ packs", "pct": "25%", "bps": 2500},
];

/** ld: the question is also in the page's FAQPage JSON-LD (the two Santa questions are not). */
export const faq: FaqItem[] = [
    {"q": "Is there an affordable MDM for a small business?", "a": "Yes, that is what Netquor Fleet is for. Mobile device management (MDM) starts at {{fleet.mac.month}} per Mac and {{fleet.mobile.month}} per iPhone or iPad per month, every feature is included, and your first 30 days are free. Annual and lifetime licenses are cheaper still, with volume discounts of up to 25% on top.", "ld": true},
    {"q": "Is there a minimum number of devices or seats?", "a": "Not on the monthly plan: pay for one Mac or a hundred, and add or remove devices whenever you like. Annual and lifetime licenses are sold in packs of 10 so the discounts can be passed on, and licenses you have not used yet roll over.", "ld": true},
    {"q": "Does Netquor Fleet have a full API?", "a": "Yes. Everything in the console is an API call: devices, profiles, groups, policies, patching, software and the Buffet catalog, over 100 endpoints of plain JSON over HTTPS. The API is included on every plan.", "ld": true},
    {"q": "What is Santa, and do I have to use it?", "a": "Santa is an open-source tool that decides which programs may run on a Mac. Netquor Fleet hosts and manages it for you: one click turns it on, rules apply by group, and you can start in Monitor mode, which only records what would be blocked. It is included on every plan, it is optional, and it is for Macs.", "ld": false},
    {"q": "Does Santa replace antivirus?", "a": "No. Santa controls which programs are allowed to run, and it can block known macOS malware from a feed we keep up to date. It does not scan files, and a list of known files only stops what has been seen before, so a rebuilt sample can get past it. Use it as one layer: patched apps, sensible policies, and Lockdown mode where you can approve what runs.", "ld": false},
    {"q": "Do you offer self-service software for employees?", "a": "Yes. Buffet is a branded self-service app for Mac, iPhone and iPad. People install the apps you approve and update them without opening a ticket, and nobody has to sign in.", "ld": true},
    {"q": "Is Netquor Fleet a good alternative to Jamf, Kandji or Mosyle?", "a": "If you manage Macs, iPhones and iPads and want a simple per-device price with every feature included, no minimum, and a real API, it is worth a free 30-day trial next to whatever you use today. Windows and Android are not supported yet.", "ld": true},
    {"q": "Do you serve Fargo, North Dakota and the Midwest?", "a": "Yes. Netquor is based in Fargo, ND. Netquor Fleet is a cloud service that works anywhere, and we also offer on-site setup and field support for businesses in Fargo, West Fargo, Moorhead and across North Dakota, Minnesota, South Dakota and the Midwest.", "ld": true},
    {"q": "What do I need to get started?", "a": "An Apple push certificate for your organization, which we walk you through once, and the devices you want to manage. Enrollment is a profile you install on each device.", "ld": true},
    {"q": "Do my people have to sign in to Buffet?", "a": "No. The Mac app talks to the Netquor Fleet agent already on the Mac. On iPhone and iPad, your MDM sends the app its setup, or you send a home screen icon that does it with one tap.", "ld": true},
    {"q": "Can I manage the settings of apps like Chrome or Zoom?", "a": "Yes. Vendor policies give you a guided form for each supported app's documented settings, plus WireGuard tunnels, and a generic editor for any other Mac app that reads managed preferences. The app has to support managed settings: Netquor Fleet delivers them, the app decides what they do. They are included on every plan.", "ld": true},
    {"q": "Where do Mac apps come from?", "a": "Straight from each vendor. The right build for each Mac's chip and macOS is chosen automatically, and nothing is installed unless it matches the published checksum or is signed by the developer.", "ld": true},
    {"q": "Can I install paid iPhone and iPad apps?", "a": "Not yet. Free App Store apps install after the person accepts the prompt on their device. Apps and Books licenses, for paid apps and silent installs, are on our list.", "ld": true},
    {"q": "What happens when an app is open during an update?", "a": "Nobody's work is closed without asking. People choose Update now or Later a set number of times; after that they get a short countdown to save their work.", "ld": true},
    {"q": "How does the free trial work?", "a": "Your first 30 days are free, with every feature and no limit on devices. We remind you before it ends, and then you get an invoice for the devices you chose (or the ones you enrolled, if that is more). Nothing is charged automatically.", "ld": true},
    {"q": "Can I earn free devices?", "a": "Yes. Keep paying and you earn free devices at 3, 6, 9 and 12 months (one, one, one and two: five a year), and again every year after. They never expire. A free device counts while you pay for at least as many licenses, so with 5 paid licenses and 5 free devices you have 10. Refer a business that moves to a paid plan and you each get a free lifetime seat, up to ten a year.", "ld": true},
    {"q": "How do annual licenses, packs and rollover work?", "a": "An annual license is ten months of the monthly price, so you get 2 months free: {{fleet.mac.year}} a year for a Mac and {{fleet.mobile.year}} for an iPhone or iPad. They are sold in packs of 10, with a volume discount that grows with the number of packs, so a fleet rounds up to whole packs. Any license you have not used rolls over to your next term instead of expiring.", "ld": true},
    {"q": "What does a lifetime license cover?", "a": "One device at a time, for as long as Netquor Fleet is offered, with every update and nothing to renew. It costs 3 years of the annual price ({{fleet.mac.lifetime}} a Mac, {{fleet.mobile.lifetime}} an iPhone or iPad), and it is sold only in packs of 10 with the same pack discounts. Licenses you don't use yet never expire, so they cover the devices you add later. If a device leaves your fleet, the license moves to its replacement. Lifetime licenses are bought outright, so they have no free trial. A dedicated instance stays a small yearly or monthly hosting fee, because hosting never stops costing us.", "ld": true},
    {"q": "Do you support Windows or Android?", "a": "Not yet. Netquor Fleet manages Macs, iPhones and iPads today, and Windows and Android support is coming soon. Tell us what you need when you <a href=\"#demo\">ask for a demo</a> and it helps us choose what to build first.", "ld": true},
    {"q": "What is the guarantee?", "a": "We guarantee you will love Netquor Fleet, or you get your money back. If it is not right for you, tell us and we will refund what you paid.", "ld": true},
    {"q": "Do you support single sign-on? Is there an API?", "a": "There is a complete API today: everything the console does is available to your scripts over HTTPS with a secret key, and it can be limited to your own addresses. Single sign-on for the console (SAML and OIDC), scoped API keys and outbound webhooks are on our roadmap.", "ld": true},
    {"q": "Can I see it before I buy?", "a": "The free trial is the best way: 30 days with everything switched on and no limit on devices. If you would like a walkthrough first, <a href=\"#demo\">ask for a demo</a> and tell us about your fleet.", "ld": true},
];

export const apiCode = "# Your devices\ncurl -H \"Authorization: Bearer $KEY\" \\\n  https://fleet.netquor.com/fleet/v1/devices\n\n# A managed Chrome, as a policy\ncurl -X POST -H \"Authorization: Bearer $KEY\" \\\n  -H \"content-type: application/json\" \\\n  https://fleet.netquor.com/fleet/v1/profiles \\\n  -d '{\"name\":\"Chrome: managed\",\n       \"vendor\":{\"app\":\"chrome\",\"values\":{\n         \"HomepageLocation\":\"https://intranet.example.com\"}}}'\n\n# Update every Mac that is behind\ncurl -X POST -H \"Authorization: Bearer $KEY\" \\\n  -H \"content-type: application/json\" \\\n  https://fleet.netquor.com/fleet/v1/patch/titles/$ID/update \\\n  -d '{\"behind\":true}'";
