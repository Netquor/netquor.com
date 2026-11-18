// Subnet math for the free calculator at /subnet-calculator.html. No dependencies; also loaded by Node for tests.
(function (root) {
  // Octets with a leading zero are rejected: some tools read them as octal, so the result would be ambiguous.
  function parseV4(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
    if (!m) return null;
    var n = 0;
    for (var i = 1; i <= 4; i++) { if (m[i].length > 1 && m[i][0] === '0') return null; var o = +m[i]; if (o > 255) return null; n = n * 256 + o; }
    return n;
  }
  function fmtV4(n) { return [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255].join('.'); }
  function maskOf(p) { return p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; }
  function describe(n) {
    var a = n >>> 24, b = n >>> 16 & 255;
    if (a === 10) return 'Private (RFC 1918)';
    if (a === 172 && b >= 16 && b <= 31) return 'Private (RFC 1918)';
    if (a === 192 && b === 168) return 'Private (RFC 1918)';
    if (a === 100 && b >= 64 && b <= 127) return 'Shared address space (CGNAT, RFC 6598)';
    if (a === 169 && b === 254) return 'Link-local';
    if (a === 127) return 'Loopback';
    if (a === 0 || a >= 240) return 'Reserved';
    if (a >= 224 && a <= 239) return 'Multicast';
    return 'Public';
  }
  // Accepts "192.168.1.0/24", "192.168.1.77/26" or an address with a dotted mask ("10.0.0.5 255.255.255.0").
  function calcV4(input) {
    var t = String(input).trim(), ip, p;
    if (/\/\s*\D*$/.test(t) || /\/\s*-?\d{3,}$/.test(t) || /\/\s*-/.test(t)) return { error: 'The prefix must be a whole number from 0 to 32.' };
    var m = /^(\S+)\s*\/\s*(\d{1,2})$/.exec(t);
    if (m) { ip = parseV4(m[1]); p = +m[2]; }
    else {
      var mm = /^(\S+)\s+(\S+)$/.exec(t);
      if (!mm) return { error: 'Enter an address with a prefix, like 192.168.1.0/24.' };
      ip = parseV4(mm[1]); var mk = parseV4(mm[2]);
      if (mk === null) return { error: 'That netmask is not valid.' };
      var bits = (mk >>> 0).toString(2);
      if (!/^1*0*$/.test(bits.padStart(32, '0'))) return { error: 'The netmask must be contiguous, like 255.255.255.0.' };
      p = bits.replace(/0/g, '').length;
    }
    if (ip === null) return { error: 'That IPv4 address is not valid.' };
    if (!(p >= 0 && p <= 32)) return { error: 'The prefix must be between 0 and 32.' };
    var mask = maskOf(p), net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
    var total = Math.pow(2, 32 - p);
    var usable = p >= 31 ? total : total - 2;
    return {
      prefix: p, address: fmtV4(ip), network: fmtV4(net), broadcast: p === 32 ? '-' : (p === 31 ? '-' : fmtV4(bc)),
      netmask: fmtV4(mask), wildcard: fmtV4((~mask) >>> 0),
      first: p === 32 ? fmtV4(net) : (p === 31 ? fmtV4(net) : fmtV4(net + 1)),
      last: p === 32 ? fmtV4(net) : (p === 31 ? fmtV4(bc) : fmtV4(bc - 1)),
      total: total, usable: usable, kind: describe(ip),
      point2point: p === 31, host: p === 32, _net: net
    };
  }
  // Split a network into equal subnets of a longer prefix (up to 64 rows shown).
  function splitV4(netNum, p, q) {
    if (q <= p || q > 32) return [];
    var count = Math.pow(2, q - p), size = Math.pow(2, 32 - q), rows = [];
    for (var i = 0; i < Math.min(count, 64); i++) {
      var n = netNum + i * size;
      rows.push({ cidr: fmtV4(n) + '/' + q, first: q >= 31 ? fmtV4(n) : fmtV4(n + 1), last: q >= 31 ? fmtV4(n + size - 1) : fmtV4(n + size - 2), usable: q >= 31 ? size : size - 2 });
    }
    return { count: count, rows: rows };
  }
  // IPv6: how many /64 networks (one per LAN) fit in a prefix. Uses BigInt for exact counts.
  function calcV6(prefix) {
    if (!/^[1-9]\d{0,2}$/.test(String(prefix).trim())) return { error: 'The IPv6 prefix must be a whole number between 1 and 128.' };
    var p = +prefix;
    if (!(p >= 1 && p <= 128)) return { error: 'The IPv6 prefix must be a whole number between 1 and 128.' };
    var n64 = p <= 64 ? (1n << BigInt(64 - p)) : 0n;
    return { prefix: p, lans: n64, notes: p > 64 ? 'Longer than /64: smaller than one standard LAN.' : '' };
  }
  var api = { parseV4: parseV4, fmtV4: fmtV4, calcV4: calcV4, splitV4: splitV4, calcV6: calcV6 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NQSubnet = api;
})(typeof self !== 'undefined' ? self : this);
