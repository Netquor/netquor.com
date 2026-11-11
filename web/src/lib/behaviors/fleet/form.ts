// form.ts: the pure part of fleet/site.js's demo form: the checks, the drafted email, and the submit sequence with its side effects passed in. The form posts nowhere: it opens the visitor's mail app with a message to hello@netquor.com (the legacy behavior), and no network request is made.

export const LEAD_EMAIL = "hello@netquor.com";
export const LEAD_SUBJECT = "Netquor Fleet free trial";
export const NAME_ERROR = "Please tell us your name.";
export const EMAIL_ERROR = "Please enter a valid email address.";
export const SENDING_TEXT = "Sending…";
export const OPENED_TEXT = "Opening your email app. If nothing opens, write to hello@netquor.com.";
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type StatusKind = "bad" | "ok" | "";
export interface Status { text: string; kind: StatusKind }

/** The values the submit reads from the form's fields. */
export interface LeadValues { name: string; email: string; company: string; macs: string; ios: string; term: string; dedicated: string; message: string }

/** The first problem with the form, or null. */
export const validateLead = (v: Pick<LeadValues, "name" | "email">): Status | null => {
    if (!v.name.trim()) return { text: NAME_ERROR, kind: "bad" };
    if (!EMAIL_PATTERN.test(v.email.trim())) return { text: EMAIL_ERROR, kind: "bad" };
    return null;
};

/** The mailto: URL that drafts the message: subject and body percent-encoded, body lines joined by a newline. */
export const mailtoUrl = (v: LeadValues): string => {
    const lines = [`Name: ${v.name.trim()}`, `Email: ${v.email.trim()}`, `Company: ${v.company.trim()}`, `Macs: ${v.macs}`, `iPhones and iPads: ${v.ios}`, `Plan looked at: ${v.term}${v.dedicated === "1" ? " + dedicated instance" : ""}`, "", v.message.trim()];
    return `mailto:${LEAD_EMAIL}?subject=${encodeURIComponent(LEAD_SUBJECT)}&body=${encodeURIComponent(lines.join("\n"))}`;
};

/** The status line's class: "status " plus the kind (the legacy script writes the trailing space for an empty kind). */
export const statusClass = (kind: StatusKind): string => "status " + kind;

export interface SubmitIo {
    /** Shows a status line. */
    say(status: Status): void;
    /** Disables or enables the submit button. */
    busy(disabled: boolean): void;
    /** Navigates to the URL (window.location.href = url). */
    navigate(url: string): void;
}

/** The submit handler's body, in the legacy order: validate (say the first problem and stop), disable the button, say Sending, navigate to the mailto: URL, say that the mail app is opening; an error becomes a bad status; the button is enabled again at the end. Returns what happened. */
export const submitLead = (v: LeadValues, io: SubmitIo): "invalid" | "sent" | "failed" => {
    const problem = validateLead(v);
    if (problem) {
        io.say(problem);
        return "invalid";
    }
    io.busy(true);
    io.say({ text: SENDING_TEXT, kind: "" });
    try {
        io.navigate(mailtoUrl(v));
        io.say({ text: OPENED_TEXT, kind: "ok" });
        return "sent";
    } catch (err) {
        io.say({ text: err instanceof Error ? err.message : String(err), kind: "bad" });
        return "failed";
    } finally {
        io.busy(false);
    }
};
