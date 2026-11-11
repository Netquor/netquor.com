// Copy and data for /central.html (Netquor Central, in development, no price).
export const TITLE = "Netquor Central: people, groups, Gmail filters and sign-in in one place | Netquor";
export const DESCRIPTION = "Netquor Central is the dashboard Netquor runs its own team on: one place for people, Google Workspace users and groups, Gmail filters and labels, email signatures and event-driven policies. In development as a product.";
export const OG_DESCRIPTION = "The dashboard Netquor runs its own team on: directory, Google Workspace, Gmail filters and signatures, with previews for policies and syncs.";

export const MAIL_HREF = "mailto:hello@netquor.com?subject=Netquor Central%20and%20Google%20Workspace";

export interface DiffRow { kind: "" | "add" | "rm"; label: string; title: string; detail: string }
// Text uses the same entities as the legacy page (the arrow is &rarr;), so the markup is rendered with {@html}.
export const DIFF_ROWS: readonly DiffRow[] = [
    { kind: "", label: "Update", title: "Dana Reyes: title", detail: "Technician &rarr; Senior Technician" },
    { kind: "", label: "Update", title: "Dana Reyes: email signature", detail: "Regenerated from the directory" },
    { kind: "", label: "Update", title: "Dana Reyes: Google group", detail: "Added to Support, removed from Sales" },
    { kind: "add", label: "Add", title: "Sam Ortiz", detail: "New hire, held until shortly before the start date" },
    { kind: "rm", label: "Suspend", title: "Lee Park", detail: "Last day reached. Suspended, never deleted" },
];

export type CapStatus = "available" | "in-development";
export interface Capability { name: string; what: string; status: CapStatus; statusLabel: string }
export const CAPABILITIES: readonly Capability[] = [
    { name: "People and directory", what: "One directory is the source of truth for who works here, with employee IDs that are never reused. Hires can be added ahead of their start date and held out of Google until shortly before it. That hold is built in the sync, and its screens are still in progress.", status: "in-development", statusLabel: "Partly built" },
    { name: "Google Workspace", what: "Creates and updates users, org units, licenses, aliases and send-as addresses to match the directory. People who leave are suspended, never deleted.", status: "available", statusLabel: "Built" },
    { name: "Groups", what: "Create and manage directory groups, add and remove people, and sync them to Google Groups. Bring in Google groups that have no directory group yet.", status: "available", statusLabel: "Built" },
    { name: "Inbox rules, filters, labels", what: "Define Gmail filters and labels once and apply them across the organization, to everyone or to chosen people and groups. Forwarding stays inside your domain unless you allow an address.", status: "available", statusLabel: "Built" },
    { name: "Email signatures", what: "One template with per-person values such as name, pronouns, title and phone, plus per-alias signatures. It updates when the underlying value changes.", status: "available", statusLabel: "Built" },
    { name: "Policies", what: "Say what should happen when a person joins, moves, leaves or enters a group, with a condition and a short sandboxed script. New policies start switched off, and you preview them first.", status: "available", statusLabel: "Built" },
    { name: "Single sign-on", what: "Works with your LDAP directory and your Authentik sign-in service. Keycloak can be where administrators create users. Cutting off sign-in after a last day is being finished.", status: "in-development", statusLabel: "Partly built" },
    { name: "Audit trail and roles", what: "Every sync records what it did, and screens are limited by role, so administrators can change group membership and system administrators can change more.", status: "available", statusLabel: "Built" },
    { name: "Phone and incident dashboard", what: "Call log, voicemail inbox, phone menu settings, incidents and outage notices for Netquor Phone, which is in early access and not billed yet, alongside the people tools.", status: "available", statusLabel: "Built" },
    { name: "Retention and offboarding checklist", what: "Removal from groups and deletion after a retention period, and a per-app checklist for leavers.", status: "in-development", statusLabel: "Planned" },
];

export const SAFE_ITEMS: readonly { title: string; text: string }[] = [
    { title: "Preview first", text: "Policies can be previewed, and so can the Google user, ID and group syncs. New policies start switched off." },
    { title: "Leavers are suspended", text: "Accounts are suspended, never deleted, so nothing is lost to a Google license grace period." },
    { title: "Limits on every run", text: "A cap on new accounts and suspensions per run limits the damage a bug can do." },
    { title: "Sandboxed scripts", text: "Policy scripts run in a sandbox with access only to the functions Netquor Central lists." },
    { title: "Mail stays inside", text: "Filter forwarding is limited to your own domain unless you allow an address." },
    { title: "Every change is recorded", text: "Each sync keeps a run record and writes audit entries. Passwords are never logged." },
];

export const FAQ_ITEMS = [
    { q: "Who is Netquor Central for?", a: "Small and mid-size organizations on Google Workspace that want one place to run people, groups, Gmail filters, signatures and sign-in. It suits an owner or IT admin who is tired of updating the same person in three places and of hand-building Gmail filters one mailbox at a time." },
    { q: "Is it available today?", a: "Not as a product. Netquor runs Netquor Central for its own team, and we are shaping it with a few Google Workspace teams. There is no published price yet, so the way in today is to tell us about your Workspace." },
    { q: "Do I need LDAP or Authentik?", a: "Netquor Central is designed around a directory as the source of truth and works with LDAP, Authentik and Keycloak. If you do not have one, tell us what you use, and we will say honestly whether Netquor Central fits." },
    { q: "Does it use AI?", a: "One feature does. An administrator picks example emails and Netquor Central proposes up to three Gmail filter rules for them. Nothing is created until the administrator reviews and saves a rule, and the text of the emails is treated as data, never as instructions." },
    { q: "What does it need from Google?", a: "A service account with domain-wide delegation. The scopes depend on the features you turn on: directory and group access for sync, Gmail settings for filters and signatures, and broader mail access only for backfill and retention. Recovery details are never touched." },
] as const;

/** The page's own rules, as the legacy page wrote them in its head. */
export const PAGE_CSS = `
        .nq-map-labels text { font: 500 15px var(--nq-body); fill: var(--nq-ink); }
        .nq-map-labels text.sub { font: 400 12px var(--nq-mono); fill: var(--nq-ink-3); }
        .nq-map-lines path { stroke: var(--nq-accent); opacity: .85; }
        .nq-map-nodes circle { fill: var(--nq-accent); }
        .nq-map { width: 100%; height: auto; display: block; }
        .nq-diff { margin: 0; max-width: 520px; margin-inline: auto; background: var(--nq-s1); border: 1px solid var(--nq-line-2); border-radius: 20px; overflow: hidden; }
        .nq-diff figcaption { display: flex; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--nq-line); font: 400 .75rem var(--nq-mono); color: var(--nq-ink-3); }
        .nq-diff figcaption span:first-child { color: var(--nq-ink-2); }
        .nq-diff-row { display: grid; grid-template-columns: 4.5rem 1fr; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--nq-line); font-size: .9375rem; color: var(--nq-ink-2); }
        .nq-diff-row b { font: 500 .75rem var(--nq-mono); color: var(--nq-accent-t); padding-top: 3px; }
        .nq-diff-row b.add { color: var(--nq-ok); }
        .nq-diff-row b.rm { color: #f0907f; }
        .nq-diff-row span { color: var(--nq-ink); }
        .nq-diff-row small { display: block; color: var(--nq-ink-3); font-size: .8125rem; margin-top: 2px; }
        .nq-diff-foot { margin: 0; padding: 14px 20px 18px; font-size: .8125rem; color: var(--nq-ink-3); line-height: 1.5; }
        .nq-cap { width: 100%; border-collapse: collapse; }
        .nq-cap th { text-align: left; font: 400 .75rem var(--nq-mono); color: var(--nq-ink-3); padding: 0 16px 12px 0; border-bottom: 1px solid var(--nq-line); }
        .nq-cap td { padding: 18px 16px 18px 0; vertical-align: top; border-bottom: 1px solid var(--nq-line); color: var(--nq-ink-2); font-size: .9375rem; line-height: 1.55; }
        .nq-cap td:first-child { color: var(--nq-ink); font: 500 1.0625rem var(--nq-display); white-space: nowrap; }
        .nq-cap td:last-child { white-space: nowrap; padding-right: 0; }
        @media (max-width: 767.98px) { .nq-cap, .nq-cap tbody, .nq-cap tr, .nq-cap td { display: block; } .nq-cap thead { display: none; } .nq-cap tr { padding: 16px 0; border-bottom: 1px solid var(--nq-line); } .nq-cap td { border: 0; padding: 2px 0; white-space: normal !important; } }
        .nq-safe { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .nq-safe div { padding: 20px; background: var(--nq-s1); border: 1px solid var(--nq-line); border-radius: 14px; }
        .nq-safe b { display: block; margin-bottom: 6px; font: 500 1rem var(--nq-display); color: var(--nq-ink); }
        .nq-safe p { margin: 0; font-size: .9375rem; color: var(--nq-ink-2); line-height: 1.55; }
    `;
