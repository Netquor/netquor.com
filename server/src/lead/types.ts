// lead/types.ts: what a lead is, and where one goes.
export interface LeadInput {
    name: string;
    email: string;
    company: string;
    /** Number of Macs (whole number, 0 to 100000). */
    macs: number;
    ios: number;
    message: string;
    /** Billing term chosen on the page, such as "annual". */
    term: string;
    /** Which form on which page sent it, such as "fleet" or "home". */
    source: string;
    /** Path of the page the form was on (no query or fragment). Absent when not sent. */
    page?: string;
    /** Campaign tags from the page address. Absent when none were sent. */
    utm?: { source?: string; medium?: string; campaign?: string };
}

export interface Lead extends LeadInput {
    id: string;
    /** ISO time the server received it. */
    receivedAt: string;
}

/** Things about the request that are not part of the lead itself and are never stored raw. */
export interface DeliveryMeta {
    /** The client address. Only ever used to make a keyed hash; never written anywhere. */
    clientIp?: string;
}

export interface LeadSink {
    /** Resolves when the lead is safely handed over; rejects when it is not. */
    deliver(lead: Lead, meta?: DeliveryMeta): Promise<void>;
}
