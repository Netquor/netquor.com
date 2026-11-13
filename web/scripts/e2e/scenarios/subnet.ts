// subnet.ts: the subnet calculator on /subnet-calculator.html: subnet-calc.js (pure maths, window.NQSubnet) plus the page's inline script that wires it up (live calculation on every input event, Calculate button, Enter key, split table, IPv6 count).
import type { Page } from "../browser";
import type { Scenario, Step } from "../scenario";
import type { Observed, ObserveSpec } from "../observe";
import { el, must } from "./helpers";

const OBSERVE: ObserveSpec = {
    selectors: ["#v4", "#v4err", "#v4out", "#v4note", "#v6", "#v6out"],
    attrs: ["hidden", "aria-live", "aria-describedby"],
    classes: false,
    text: true,
    textMax: 160,
    box: false,
    evals: {
        v4: `document.getElementById("v4").value`,
        out: `[...document.querySelectorAll("#v4out > div")].map((d) => d.children[0].textContent + " = " + d.children[1].textContent)`,
        // The split card's content is only read while the card is visible: legacy leaves stale text in the hidden card, which nobody sees.
        splitVisible: `!document.getElementById("splitcard").hidden`,
        options: `document.getElementById("splitcard").hidden ? "(hidden)" : [...document.querySelectorAll("#splitto option")].map((o) => o.value + ":" + o.textContent + (o.selected ? "*" : ""))`,
        rows: `document.getElementById("splitcard").hidden ? "(hidden)" : [...document.querySelectorAll("#splitrows tr")].slice(0, 3).map((r) => [...r.children].map((c) => c.textContent).join(" | "))`,
        rowCount: `document.getElementById("splitcard").hidden ? "(hidden)" : document.querySelectorAll("#splitrows tr").length`,
        splitCount: `document.getElementById("splitcard").hidden ? "(hidden)" : document.getElementById("splitcount").textContent`,
        splitMore: `document.getElementById("splitcard").hidden ? "(hidden)" : document.getElementById("splitmore").textContent`,
        splitValue: `document.getElementById("splitcard").hidden ? "(hidden)" : document.getElementById("splitto").value`,
        v6: `document.getElementById("v6").value`,
        engine: `typeof window.NQSubnet`,
        active: `document.activeElement && document.activeElement.id`,
    },
};

const ev = (o: Observed, k: string) => o.evals?.[k];
const list = (o: Observed, k: string) => ev(o, k) as string[];
const hidden = (o: Observed, id: string) => (id === "#splitcard" ? ev(o, "splitVisible") === false : el(o, id).attrs.hidden !== undefined);

const enter = (value: string): Step["run"] => async (p: Page) => { await p.fill("#v4", value); };

const step = (name: string, value: string, expect?: Step["expect"]): Step => ({ name, run: enter(value), expect });

const calc: Scenario = {
    name: "subnet-v4",
    description: "IPv4: default result, live typing, Calculate, Enter, dotted mask, /31, /32, errors, the split table and its 64-row cap",
    legacyPath: "/subnet-calculator.html",
    viewport: { width: 1280, height: 900 },
    ready: (p) => p.waitFor(() => document.querySelectorAll("#v4out > div").length > 0 && typeof (window as unknown as { NQSubnet?: unknown }).NQSubnet === "object", 15000),
    observe: OBSERVE,
    steps: [
        { name: "default 192.168.1.0/24", expect: (o) => {
            must(ev(o, "v4") === "192.168.1.0/24", "the field starts as 192.168.1.0/24");
            must(JSON.stringify(list(o, "out")) === JSON.stringify(["Network = 192.168.1.0/24", "Netmask = 255.255.255.0", "Wildcard = 0.0.0.255", "Broadcast = 192.168.1.255", "First host = 192.168.1.1", "Last host = 192.168.1.254", "Usable hosts = 254", "Total addresses = 256", "Type = Private (RFC 1918)"]), `result rows: ${JSON.stringify(list(o, "out"))}`);
            must(!hidden(o, "#v4out") && !hidden(o, "#splitcard"), "result and split card are visible");
            must(JSON.stringify(list(o, "options")) === JSON.stringify(["25:/25*", "26:/26", "27:/27", "28:/28", "29:/29", "30:/30", "31:/31", "32:/32"]), `split options /25../32 with the first selected: ${JSON.stringify(list(o, "options"))}`);
            must(ev(o, "splitCount") === "2 subnets of 126 usable hosts each" && ev(o, "rowCount") === 2, "two /25 rows");
            must(ev(o, "v6") === "56" && el(o, "#v6out").text === "A /56 holds 256 separate /64 networks, one per LAN or VLAN.", "IPv6 /56 holds 256 networks");
        } },
        step("typing 10.0.0.0/8", "10.0.0.0/8", (o) => { must(list(o, "out")[0] === "Network = 10.0.0.0/8" && list(o, "out")[6] === "Usable hosts = 16,777,214", "10.0.0.0/8 with grouped numbers"); must(JSON.stringify(list(o, "options")) === JSON.stringify(["9:/9*", "10:/10", "11:/11", "12:/12", "13:/13", "14:/14", "15:/15", "16:/16"]), "options /9../16"); }),
        step("host bits are masked: 172.16.5.77/26", "172.16.5.77/26", (o) => must(list(o, "out")[0] === "Network = 172.16.5.64/26", "network is 172.16.5.64/26")),
        step("dotted netmask", "10.0.0.5 255.255.255.0", (o) => must(list(o, "out")[0] === "Network = 10.0.0.0/24", "address plus dotted mask")),
        step("/31 is point to point", "192.168.1.0/31", (o) => { must(el(o, "#v4note").text.startsWith("/31 networks have no network or broadcast address"), "RFC 3021 note"); must(list(o, "out")[3] === "Broadcast = -", "no broadcast shown"); must(JSON.stringify(list(o, "options")) === JSON.stringify(["32:/32*"]), "only /32 to split into"); }),
        step("/32 is one host", "192.168.1.1/32", (o) => { must(el(o, "#v4note").text === "A /32 is a single host address." && hidden(o, "#splitcard"), "single host note, split card hidden"); }),
        step("error: bad address", "300.1.1.1/24", (o) => { must(el(o, "#v4err").text === "That IPv4 address is not valid." && hidden(o, "#v4out") && hidden(o, "#splitcard"), "error shown, result and split hidden"); must(list(o, "out").length === 0, "result rows cleared"); }),
        step("error: prefix too long", "10.0.0.0/33", (o) => must(el(o, "#v4err").text === "The prefix must be between 0 and 32.", "prefix range error")),
        step("error: missing prefix digits", "10.0.0.0/", (o) => must(el(o, "#v4err").text === "The prefix must be a whole number from 0 to 32.", "whole-number error")),
        step("error: one word", "hello", (o) => must(el(o, "#v4err").text === "Enter an address with a prefix, like 192.168.1.0/24.", "format hint")),
        step("error: leading zero octet", "010.0.0.0/8", (o) => must(el(o, "#v4err").text === "That IPv4 address is not valid.", "leading zeros are rejected")),
        step("error: non contiguous mask", "10.0.0.0 255.0.255.0", (o) => must(el(o, "#v4err").text === "The netmask must be contiguous, like 255.255.255.0.", "contiguous mask error")),
        step("error: empty", "", (o) => must(el(o, "#v4err").text === "Enter an address with a prefix, like 192.168.1.0/24.", "empty shows the format hint")),
        step("0.0.0.0/0", "0.0.0.0/0", (o) => must(list(o, "out")[8] === "Type = Reserved", "0.0.0.0 is Reserved")),
        { name: "split into /8: capped at 64 rows", run: (p) => p.setValue("#splitto", "8"), expect: (o) => { must(ev(o, "rowCount") === 64 && ev(o, "splitMore") === "Showing the first 64 of 256 subnets.", "64 rows and the cap note"); must(ev(o, "splitCount") === "256 subnets of 16,777,214 usable hosts each", "256 subnets"); } },
        step("back to 192.168.1.0/24 for the split", "192.168.1.0/24"),
        { name: "split into /26", run: (p) => p.setValue("#splitto", "26"), expect: (o) => { must(JSON.stringify(ev(o, "rows")) === JSON.stringify(["192.168.1.0/26 | 192.168.1.1 | 192.168.1.62 | 62", "192.168.1.64/26 | 192.168.1.65 | 192.168.1.126 | 62", "192.168.1.128/26 | 192.168.1.129 | 192.168.1.190 | 62"]), `rows: ${JSON.stringify(ev(o, "rows"))}`); must(ev(o, "splitMore") === "", "no cap note"); } },
        { name: "Enter key recalculates", run: async (p) => { await p.setValue("#splitto", "25"); await p.eval(`document.getElementById("v4").focus()`); await p.press("Enter"); }, expect: (o) => must(ev(o, "active") === "v4" && list(o, "out")[0] === "Network = 192.168.1.0/24", "still focused, same result") },
        { name: "Calculate button", run: (p) => p.click("#v4go"), expect: (o) => must(ev(o, "active") === "v4go" && list(o, "out")[0] === "Network = 192.168.1.0/24", "button takes focus, result unchanged") },
        { name: "edit the field: the split resets to the first option", run: async (p) => { await p.setValue("#splitto", "27"); await p.fill("#v4", "192.168.2.0/24"); }, expect: (o, side) => { if (side === "legacy") must(list(o, "options")[0] === "25:/25*" && ev(o, "splitValue") === "25", "editing the field rebuilds the option list and selects the first prefix again"); } },
    ],
};

const v6: Scenario = {
    name: "subnet-v6",
    description: "IPv6 prefix length: how many /64 networks fit",
    legacyPath: "/subnet-calculator.html",
    viewport: { width: 1280, height: 900 },
    ready: (p) => p.waitFor(() => document.querySelectorAll("#v4out > div").length > 0 && !!document.getElementById("v6out")?.textContent, 15000),
    observe: { ...OBSERVE, selectors: ["#v6", "#v6out"] },
    steps: [
        { name: "48", run: (p) => p.fill("#v6", "48"), expect: (o) => must(el(o, "#v6out").text === "A /48 holds 65,536 separate /64 networks, one per LAN or VLAN.", "65,536") },
        { name: "64", run: (p) => p.fill("#v6", "64"), expect: (o) => must(el(o, "#v6out").text === "A /64 holds 1 separate /64 networks, one per LAN or VLAN.", "1 (the text does not singularise)") },
        { name: "65", run: (p) => p.fill("#v6", "65"), expect: (o) => must(el(o, "#v6out").text === "A /65 is smaller than one standard /64 LAN.", "smaller than a LAN") },
        { name: "1", run: (p) => p.fill("#v6", "1"), expect: (o) => must(el(o, "#v6out").text === "A /1 holds 9,223,372,036,854,775,808 separate /64 networks, one per LAN or VLAN.", "exact BigInt count") },
        { name: "0 is an error", run: (p) => p.fill("#v6", "0"), expect: (o) => must(el(o, "#v6out").text === "The IPv6 prefix must be a whole number between 1 and 128.", "range error") },
        { name: "129 is an error", run: (p) => p.fill("#v6", "129"), expect: (o) => must(el(o, "#v6out").text.startsWith("The IPv6 prefix must be"), "range error") },
        { name: "letters are an error", run: (p) => p.fill("#v6", "ab"), expect: (o) => must(el(o, "#v6out").text.startsWith("The IPv6 prefix must be"), "format error") },
        { name: "empty is an error", run: (p) => p.fill("#v6", ""), expect: (o) => must(el(o, "#v6out").text.startsWith("The IPv6 prefix must be"), "empty is an error") },
    ],
};

export default [calc, v6];
