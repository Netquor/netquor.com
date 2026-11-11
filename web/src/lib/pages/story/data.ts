// The copy of /story.html. Every dated line comes from public sources (GitHub repos and gists with their dates) or from Jay's own account; the page names no private repository.
export type Figure = { src: string; alt: string; caption: string; width: number; height: number; /** Makes the picture a link (with a play badge) to this https URL, opened in a new tab. */ href?: string };
export type Chapter = { when: string; title: string; body: string; figures?: Figure[] };

export const meta = {
    title: "Our Story: How Netquor Started | Netquor Technologies",
    description: "How a high school curiosity about how a MacBook works became managed networks, Apple device management and a business phone system for small business, told by Jay Peters, Netquor's principal.",
};

export const hero = {
    eyebrow: "Our story",
    title: "It started with a MacBook and a question",
    lead: "Jay Peters, Netquor's principal, on how wondering how a Mac works turned into our own network, device management and a phone system for small business.",
};

export const chapters: Chapter[] = [
    { when: "2018", title: "How does this thing work?", body: "It began in high school with a MacBook and a question I could not leave alone. I started writing bash and AppleScript, took a programming class, and pushed my first repositories that spring.", figures: [{ src: "/brand/story/teardown.webp", alt: "A smart device taken apart on a workbench: circuit boards, a speaker, a small screwdriver and a dish of screws.", caption: "Taking a connected device apart to see what is inside.", width: 1200, height: 675 }] },
    { when: "2018", title: "Macs, from the outside", body: "Curiosity turned into management: MDM, then LaunchAgents, the small background jobs that make a Mac do things on its own. I wrote a Go tool, MacTask, to automate the Mac chores I kept repeating." },
    { when: "2018", title: "A Raspberry Pi", body: "Then I got a Raspberry Pi. I ran FreeRADIUS and a Wi-Fi hotspot on it and installed Pi-hole, which taught me DNS from the inside.", figures: [{ src: "/brand/story/pihole-labeled.webp", alt: "A white UniFi gateway and a UniFi switch labeled with their addresses, with a Raspberry Pi in a clear case in front of them carrying a Pi-hole sticker and its own address label.", caption: "Everything labeled with its address, the Pi-hole included.", width: 1000, height: 1334 }] },
    { when: "June 2018", title: "It works", body: "On June 2, 2018 the family server served its first page. It said \"It Works!\" and I signed it JP. Webmin was open in the next tab, and the router was still a Netgear.", figures: [{ src: "/brand/story/family-server-2018.webp", alt: "A MacBook screen showing a web page titled Welcome to the Family Server, with the words It Works and a note that it was created by JP on 06.2.18.", caption: "The first page on the family server, June 2, 2018.", width: 1100, height: 1467 }] },
    { when: "2019", title: "An antenna on the roof", body: "In January 2019 I set up a Plane Finder receiver and put the antenna on top of the house, feeding live flight data from my own roof." },
    { when: "2019", title: "Taking over the network", body: "I patched up the home network, added access points, and started managing it myself instead of trusting whatever the ISP handed me. A first cloud server was the first time something I built left the house.", figures: [{ src: "/brand/story/main-switch-before-the-rack.webp", alt: "A black Netgear ProSAFE Plus switch hanging in a tangle of ethernet cables against a concrete block wall, labeled Main Switch with its address and an Uplink cable tag.", caption: "Before the rack: the main switch, labeled and very tangled.", width: 900, height: 1200 }, { src: "/brand/story/first-unifi-and-pis.webp", alt: "A white UniFi gateway and an eight-port UniFi switch on a desk, cabled together, with two Raspberry Pis stacked in clear cases beside them.", caption: "An early UniFi gateway and switch, with Raspberry Pis stacked beside them.", width: 1200, height: 900 }] },
    { when: "2019", title: "Tools other people used", body: "I published a Pi-hole SafeSearch script and other tools that people I had never met installed, and I started helping clients with domains, DNS and networks." },
    { when: "2019", title: "Learning Java", body: "In April 2019 I started working through a Java book with jshell open beside it, and pushed a repository called Java as I went. After C and C++, it felt easy to learn.", figures: [{ src: "/brand/story/java-book.webp", alt: "An open programming book on a page titled Examining conditions, explaining the Java conditional operator, with a thumb holding the page and a jshell session shown on the right.", caption: "Working through a Java book, with jshell open beside it.", width: 1000, height: 1334 }] },
    { when: "May 2019", title: "The YouTube era", body: "In May 2019 I started making videos. My Pi-hole Google Cloud Platform tutorial walks through running Pi-hole on a cloud server with DNS over HTTPS and DNS over TLS. It has been watched thousands of times since, and explaining it on camera turned out to be one more way of learning it. Looking back, I know now that a public DNS resolver is a bad idea, even with a firewall scoped around it. Running a real network taught me that one.", figures: [{ src: "/brand/story/youtube-pihole-gcp.webp", alt: "The title card of a video: the Pi-hole logo and the words Pi-hole on GCP over a blue sky with clouds and the Google Cloud Platform logo.", caption: "Pi-hole Google Cloud Platform Tutorial, on the JakeNology channel (17 minutes). Watch on YouTube.", width: 800, height: 450, href: "https://www.youtube.com/watch?v=tnytpjmSwXA" }] },
    { when: "2019", title: "BlueJay IT", body: "That work became BlueJay IT in 2019, on the motto \"We make IT work\". It was where I learned what small businesses actually need from technology." },
    { when: "September 2019", title: "Fixing things", body: "In September 2019 I ordered a screen and a battery from iFixit through BlueJay IT and replaced both in a cracked iPhone 6s. Taking apart something that broke and putting it back together is still one of the best ways I know to learn how it works.", figures: [{ src: "/brand/story/iphone-repair-2019.webp", alt: "A cracked iPhone 6s with its screen facing up, a replacement battery in the middle, and a working iPhone 6s in a black case on the right, laid out on paper.", caption: "A cracked iPhone 6s, its replacement battery, and the repaired phone, September 2019.", width: 1200, height: 712 }] },
    { when: "February 2020", title: "Robots", body: "Then came FIRST Robotics. Build season meant Java, Gradle builds and a robot chassis sitting right next to the laptop, with a deadline that does not move. It taught me to ship code that has to work in the real world on a schedule.", figures: [{ src: "/brand/story/frc-build-season-2020.webp", alt: "A MacBook Air in a robotics build area showing Java code and a build terminal, with a robot chassis and wheels beside it and hands typing on the keyboard.", caption: "Robot code during FIRST Robotics build season, February 2020.", width: 1200, height: 675 }] },
    { when: "2020 to 2024", title: "Scripts become software", body: "Scripts were no longer enough, so I learned to code properly. UniFi and RADIUS automation, API clients and tools for clients followed, one problem at a time." },
    { when: "2025", title: "AI changes the pace", body: "I started working with Claude, Codex and Cursor, and learned to manage them with skills, agents and careful review. In March 2025 I sketched an AI receptionist. It became Netquor Phone." },
    { when: "2025", title: "Putting it together", body: "By 2025 the pieces were in place: a network I knew how to run, device management I understood from the protocol up, and tools that let one person build like a team. Netquor Technologies is where they came together." },
    { when: "2026", title: "Building the platform", body: "Through 2026 we built it out: software-defined networking on Ubiquiti and VyOS, Netquor Fleet, Netquor Central and our API, then Netquor Phone. We publish some of our own tools too, including ylctl, mongodb-tenant-proxy and fleet-core." },
    { when: "Today", title: "Our own network", body: "We run our own autonomous system, AS403008, with routable address space and locations in Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo.", figures: [{ src: "/brand/story/home-rack.webp", alt: "A small wall-mounted network rack lit in pink, holding a patch panel, a UniFi switch and gateway, a Plane Finder Radar receiver, a cable modem and a UniFi network recorder.", caption: "The home rack, Plane Finder receiver and all.", width: 1000, height: 1334 }] },
];

export const closing = {
    title: "We run what we sell",
    body: "Our own team works in Netquor Central and our own traffic crosses our own network. When something breaks, it breaks for us first, and that is why we fix it properly.",
};

export const credits = {
    title: "Built on the work of others",
    body: "Fleet's MDM core builds on NanoMDM, the open-source (MIT) Apple MDM server by Jesse Peterson of the MicroMDM project, extended by Netquor. Pi-hole, the network-wide ad blocker, was where a lot of this began. Thank you to everyone who publishes their work.",
};

// JSON-LD: an AboutPage about the organization, with its principal. The organization @id matches the one on the home page.
export const jsonLd = (origin: string) => ({
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "AboutPage",
            "@id": `${origin}/story.html#page`,
            url: `${origin}/story.html`,
            name: "Our Story: How Netquor Started",
            about: { "@id": `${origin}/#org` },
            mainEntity: { "@id": `${origin}/story.html#principal` },
            isPartOf: { "@id": `${origin}/#site` },
        },
        {
            "@type": "Person",
            "@id": `${origin}/story.html#principal`,
            name: "Jay Peters",
            jobTitle: "Principal",
            worksFor: { "@id": `${origin}/#org` },
            sameAs: ["https://github.com/jakenology"],
        },
    ],
});
