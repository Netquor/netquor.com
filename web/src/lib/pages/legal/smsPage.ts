// The data of /sms.html: the same program terms as Terms section 13, as a page of their own.
import { smsProgram } from "./sms";
import type { LegalPageData } from "./types";

export const smsPage: LegalPageData = {
    meta: { title: "Text messaging program terms" },
    cardClass: "terms-card",
    icon: "bi-chat-text",
    logo: "/brand/nq-emblem.svg",
    subtitle: "Text Messaging (SMS) Program",
    updated: "Last Updated: November 11, 2026",
    intro: null,
    blocks: [...smsProgram, { k: "html", t: "These terms are part of our <a href=\"/terms.html\">Terms of Use</a>." }],
};
