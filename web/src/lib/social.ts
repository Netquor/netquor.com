// Netquor's social accounts, read from data/social.json. An empty entry adds nothing to the site, so it never links to an account
// that does not exist. The order of NETWORKS is the order of the footer icons and of the JSON-LD sameAs list.
import raw from "./data/social.json";

export type Network = "facebook" | "x" | "instagram" | "linkedin" | "github";
export type SocialLink = { network: Network; url: string; label: string; icon: string; ariaLabel: string };

const NETWORKS: { network: Network; label: string; icon: string }[] = [
    { network: "facebook", label: "Facebook", icon: "bi-facebook" },
    { network: "x", label: "X", icon: "bi-twitter-x" },
    { network: "instagram", label: "Instagram", icon: "bi-instagram" },
    { network: "linkedin", label: "LinkedIn", icon: "bi-linkedin" },
    { network: "github", label: "GitHub", icon: "bi-github" },
];

/** The links that are set, in display order. Throws on a value that is not a full https:// profile URL. */
export function socialLinks(data: Partial<Record<Network, string>> = raw as Partial<Record<Network, string>>): SocialLink[] {
    const out: SocialLink[] = [];
    for (const n of NETWORKS) {
        const url = (data[n.network] ?? "").trim();
        if (!url) continue;
        if (!url.startsWith("https://")) throw new Error(`social.json: ${n.network} must be a full https:// profile URL`);
        out.push({ ...n, url, ariaLabel: `Netquor on ${n.label}` });
    }
    return out;
}

/** The profile URLs, for the Organization's sameAs. */
export function sameAs(data?: Partial<Record<Network, string>>): string[] {
    return socialLinks(data).map((l) => l.url);
}

/** The X handle with its @, for twitter:site; undefined when X is not set. */
export function xHandle(data?: Partial<Record<Network, string>>): string | undefined {
    const x = socialLinks(data).find((l) => l.network === "x");
    return x ? "@" + x.url.replace(/\/+$/, "").split("/").pop() : undefined;
}
