// webchat.ts: the embed of the web chat widget (NQ Phone web chat on Netquor's own PBX host). One place for the address and the public site id.
export const WEBCHAT_HOST = "https://pbx-iad-c-01.netquor.net";
export const WEBCHAT_SITE = "95c0197b-334a-4035-8876-1a9baeb4e23e";
export const WEBCHAT_SRC = `${WEBCHAT_HOST}/webchat/widget.js?site=${WEBCHAT_SITE}`;
