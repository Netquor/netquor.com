// sms.ts: the text-messaging program language for the toll-free number, in one place. The Terms of Use (section 13), the Privacy Policy (section 11) and /sms.html all take their words from here, so carriers reviewing a registration see the same program everywhere. It covers what carriers and registries look for: who sends, what is sent, how consent is given, frequency, rates, STOP and HELP, the carrier disclaimer, consent not being a condition of purchase, and mobile information not being sold or shared for marketing. It states a service and support program with no marketing messages: if that stops being true, change it here and in the registration.
import { EMAIL, MAIN } from "../../contact";
import type { LegalBlock } from "./types";

const D = MAIN.display;

export const SMS_HEADING_TERMS = "13. Text Messaging (SMS) Program";
export const SMS_HEADING_PRIVACY = "11. Text Messaging (SMS)";

/** The program terms, shown in the Terms of Use and on /sms.html. */
export const smsProgram: readonly LegalBlock[] = [
    { k: "p", t: `Netquor Technologies LLC (“Netquor”) sends text messages from its toll-free number, ${D}, to people who have agreed to receive them. This section is the terms of that program.` },
    { k: "html", t: "<strong>Program name:</strong> Netquor Technologies account and support messages." },
    { k: "p", t: "What we send: messages about your account and services, support requests and our replies, quotes and follow-ups you asked for, and appointment or service coordination. We do not send marketing or promotional text messages." },
    { k: "p", t: "How you agree: you agree to receive these messages when you give us your mobile number and tell us we may text it, for example by checking a consent box on a Netquor form, by saying so when you sign up for or ask about a service, or by texting us first. Consent to receive text messages is not a condition of buying anything from Netquor." },
    { k: "p", t: "Message frequency varies with your activity and requests. Message and data rates may apply." },
    { k: "p", t: "To stop: reply STOP (or CANCEL, END, QUIT or UNSUBSCRIBE) at any time. You will receive one message confirming that you are unsubscribed, and no more after that. To start again, reply START or contact us." },
    { k: "p", t: `For help: reply HELP, email ${EMAIL} or call ${D}.` },
    { k: "p", t: "Carriers and the companies that deliver messages for us are not liable for delayed or undelivered messages." },
    { k: "html", t: "Your mobile information is handled under our <a href=\"/privacy.html\">Privacy Policy</a>. Mobile information will not be sold or shared with third parties for promotional or marketing purposes." },
];

/** The Privacy Policy section for the same program. */
export const smsPrivacy: readonly LegalBlock[] = [
    { k: "p", t: "If you agree to receive text messages from Netquor, we collect your mobile number, a record of your consent (when and how you gave it), the content of the messages we exchange, and delivery status information." },
    { k: "p", t: "We use this information only to send and manage the messages you agreed to receive, to answer your requests, to keep a record of your consent and opt-outs, and to prevent abuse." },
    { k: "html", t: "<strong><em>Your mobile information, including your phone number and your consent, will not be sold or shared with third parties for promotional or marketing purposes.</em></strong> The messaging platform and mobile carriers that deliver our messages handle it only on our behalf, to deliver them." },
    { k: "html", t: "You can opt out at any time by replying STOP to any message (or CANCEL, END, QUIT or UNSUBSCRIBE). We keep a record of your opt-out so that we do not text you again. The full program terms are in our <a href=\"/sms.html\">text messaging terms</a>." },
];

/** Privacy Policy paragraph (section 5) for the web chat widget. */
export const webchatPrivacy: LegalBlock = { k: "p", t: "Our website chat is served from Netquor's own phone system. It keeps a chat session token in your browser's local storage so a conversation can continue, and it sends your chat messages and the page you are on to Netquor so we can answer them. Chats are recorded and kept by Netquor as a record of the conversation, and the chat window says so. We do not use chat for advertising." };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The markup the legal card renders for a list of blocks (used to patch the baseline pages so parity compares like with like). */
export const blocksHtml = (heading: string, blocks: readonly LegalBlock[]): string =>
    [`<h3>${esc(heading)}</h3>`, ...blocks.map((b) => (b.k === "h3" ? `<h3>${esc(b.t)}</h3>` : b.k === "p" ? `<p>${esc(b.t)}</p>` : b.k === "html" ? `<p>${b.t}</p>` : `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`))].join("\n");
