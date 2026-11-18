// data.ts: the scoring data of readiness.js (the DATA object), copied verbatim: per checklist the title, seven [question, gap title, gap text, link] entries, and the two calls to action. This is NOT readiness-data.json: the legacy script and the JSON have drifted (see README.md), and the legacy behavior is the baseline, so the result boxes use this copy. readiness.test.ts compares it with the legacy file.
export type GapQuestion = readonly [string, string, string, string];
export interface ScoredList {
    title: string;
    qs: readonly GapQuestion[];
    cta: readonly [string, string];
    calc: readonly [string, string];
}
export const SCORING: Readonly<Record<string, ScoredList>> = {
    devices: {
        title: "Apple device readiness",
        qs: [
            ["You can list every device and who has it.","Enrollment and full inventory","Netquor Fleet enrolls Macs, iPhones and iPads and shows you everything in one inventory.","fleet.html"],
            ["New devices are set up from a standard configuration, not by hand.","Configuration profiles","Fleet applies settings through configuration profiles, so a new device starts the same way as the last one.","fleet.html"],
            ["Staff can install approved apps without asking you.","A self-service app library","Fleet includes a self-service app library, so people install what you approve in one click.","fleet.html"],
            ["Operating system and app updates happen on a schedule you control.","Patching","Fleet handles patching on your schedule.","fleet.html"],
            ["You can block software that should not run.","Restricted software","Fleet can block restricted software and apply vendor app policies.","fleet.html"],
            ["You can run a script or install a package on a device without visiting it.","Scripts and packages","Fleet runs scripts and installs packages remotely, with clean uninstalls.","fleet.html"],
            ["VPN and Wi-Fi settings reach devices without touching each one.","Settings and WireGuard tunnels","Fleet can push Wi-Fi, VPN and WireGuard tunnel configuration to the devices you choose.","fleet.html"],
        ],
        cta: ["See Netquor Fleet","fleet.html"],
        calc: ["Estimate what setup and sign-ins cost you","index.html#calculators"],
    },
    calls: {
        title: "Call handling readiness",
        qs: [
            ["Every business call is answered or returned the same day.","Answering and messages","Netquor Phone answers calls and takes messages. It is in early access and not billed yet.","https://phone.netquor.com/"],
            ["After-hours callers get an answer or can leave a message.","After-hours answering","Netquor Phone can answer after hours with an AI receptionist, in early access.","https://phone.netquor.com/"],
            ["You know what each caller wanted without listening to every voicemail.","Summaries after each call","Netquor Phone tells you what each caller needed. Summaries arrive by email with a transcript, and text summaries are in preview.","https://phone.netquor.com/"],
            ["Callers reach the right person or department.","Extensions and call flows","Netquor Phone has extensions, desk phones and call flows you draw. It is in early access.","https://phone.netquor.com/"],
            ["A second person can pick up when you cannot.","Queues and routing","Netquor Phone has queues and call flows to route calls to other people. It is in early access.","https://phone.netquor.com/"],
            ["Missed calls get a callback the same day.","Callbacks","Callbacks shows who called and when, so nothing depends on memory.","https://phone.netquor.com/"],
            ["Your number stays yours if you change provider.","Number porting","Number porting is part of onboarding for Netquor Phone, which is in early access.","https://phone.netquor.com/"],
        ],
        cta: ["See Netquor Phone, early access","https://phone.netquor.com/"],
        calc: ["Estimate what missed calls cost you","index.html#calculators"],
    },
    network: {
        title: "Network and remote access readiness",
        qs: [
            ["You can list every device on your network.","Visibility and monitoring","Netquor SDN gives managed networks centralized monitoring.","sdn.html"],
            ["Guest, staff and device traffic are on separate networks.","Segmentation","Netquor SDN automates Ubiquiti UniFi networks and VyOS routing and firewall rules.","sdn.html"],
            ["Remote access uses a VPN, not open ports.","A WireGuard VPN","Netquor VPN is a local WireGuard VPN with plans from 25 Mbps to 1 Gbps.","vpn.html"],
            ["You have a public IP address you control for hosting.","Routable addresses","Network Solutions gives you a routable IPv4 and an IPv6 /56 over WireGuard, from our own network.","network.html"],
            ["Your firewall rules are written down and reviewed.","Routing and firewall","Netquor SDN covers VyOS routing and firewall configuration.","sdn.html"],
            ["Someone notices when something goes down.","Centralized monitoring","Netquor SDN includes centralized monitoring.","sdn.html"],
            ["Your router and switch configuration is backed up.","Automation and an API","Netquor SDN automates configuration and has an API.","sdn.html"],
        ],
        cta: ["See Netquor SDN","sdn.html"],
        calc: ["Plan an address block with the free subnet calculator","subnet-calculator.html"],
    },
    people: {
        title: "People and access readiness",
        qs: [
            ["Adding a person updates every system from one place.","One directory, many systems","Netquor Central keeps your directory and Google Workspace in step. It is in development.","central.html"],
            ["A leaver loses access the same day.","Joiners, movers and leavers","Netquor Central reacts when people join, move or leave. Cutting off sign-in after a last day is still being finished.","central.html"],
            ["Email signatures are consistent and updated automatically.","Signatures from one template","Netquor Central builds signatures from directory fields.","central.html"],
            ["Group membership is managed in one place, not in each tool.","Groups","Netquor Central manages directory groups and syncs them to Google Groups.","central.html"],
            ["Inbox filters and labels are shared across the organization.","Gmail filters and labels","Netquor Central defines Gmail filters and labels once and applies them to everyone or chosen groups.","central.html"],
            ["Door access can be changed without replacing hardware.","Access control","Digital Access keeps many existing call boxes and systems and adds mobile entry.","digitalaccess.html"],
            ["Visitors and guests can be given temporary access.","Guest access","Digital Access supports guest and visitor access.","digitalaccess.html"],
        ],
        cta: ["See Netquor Central, in development","central.html"],
        calc: ["See Digital Access for buildings","digitalaccess.html"],
    },
};
