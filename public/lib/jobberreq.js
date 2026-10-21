// Reads a Jobber request that Jack has copied (from Jobber's "new request" email,
// the request page in the Jobber app, or a forwarded message) and pulls out the
// details the hub's request needs. It only guesses; Jack checks every field before
// it's added. Used by /money (window.BCJobReq) and tested in Node (module.exports).
(function (root) {
  var MINE = ['0406216212', '0468193772', '61468193772', '61406216212'];
  var STATES = '(?:QLD|Qld|Queensland)';

  // Labels Jobber (and its request form) use, mapped to the hub's field.
  var LABELS = [
    ['name', /^(?:client(?: name)?|contact(?: name)?|full name|your name|name|requested by|customer)$/i],
    ['firstName', /^first name$/i], ['lastName', /^last name$/i],
    ['phone', /^(?:phone(?: number)?|mobile(?: number)?|mobile phone|main phone|cell|contact number|best number)$/i],
    ['email', /^(?:e-?mail(?: address)?)$/i],
    ['address', /^(?:property(?: address)?|service address|address|street(?: address)?|street 1|location|job address|site address)$/i],
    ['street2', /^street 2$/i],
    ['suburb', /^(?:suburb|city|town)$/i],
    ['postcode', /^(?:post ?code|zip(?: code)?|postal code)$/i],
    ['service', /^(?:service(?:s)?(?: needed| required| type| details)?|type of (?:clean|cleaning|service)|what (?:service|kind of clean).*|request title|title|job type)$/i],
    ['beds', /^(?:bed(?:room)?s?|number of bed(?:room)?s|how many bed(?:room)?s.*)$/i],
    ['baths', /^(?:bath(?:room)?s?|number of bath(?:room)?s|how many bath(?:room)?s.*)$/i],
    ['date', /^(?:preferred (?:date|day)|date(?: required| needed)?|availability|available|when.*|first (?:open|available).*|start date|requested date|lease end.*|move(?:-| )?(?:in|out) date|inspection date)$/i],
    ['notes', /^(?:notes?|details|description|message|additional (?:info|information|details|notes)|anything else.*|comments?|request details|tell us .*|job details|instructions)$/i],
  ];

  var SERVICE_RULES = [
    ['presale', /pre[\s-]?sale|selling|for sale|open home|sale prep|listing|vendor/i],
    ['bond', /bond|end[\s-]of[\s-]lease|vacate|vacating|exit clean|move[\s-]?out|final inspection|tenan/i],
    ['movein', /move[\s-]?in/i],
    ['regular', /regular|weekly|fortnightly|monthly|recurring|ongoing/i],
    ['deep', /deep|spring clean|one[\s-]?off|top to bottom/i],
  ];
  var STREET = /\b\d+[a-z]?(?:\/\d+[a-z]?)?\s+(?:[A-Z][\w'’-]+\s+){1,3}(?:st|street|rd|road|ave|avenue|tce|terrace|pde|parade|cres|crescent|ct|court|dr|drive|pl|place|ln|lane|way|cl|close|hwy|highway|blvd|boulevard|cct|circuit|esp|esplanade|gr|grove|sq|square)\b/i;
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function labelOf(line) {
    var t = line.replace(/[:\-–*\s]+$/, '').replace(/^[*\s]+/, '').trim();
    if (t.length > 60) return null;
    for (var i = 0; i < LABELS.length; i++) if (LABELS[i][1].test(t)) return LABELS[i][0];
    return null;
  }

  // "Label: value" on one line, or a label line followed by its value line(s).
  function fields(lines) {
    var out = {}, i, m;
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i];
      m = /^([^:]{1,60}):\s*(.*)$/.exec(ln);
      if (m && !/^https?$/i.test(m[1])) {
        var k = labelOf(m[1]);
        if (k) {
          var v = m[2];
          if (!v && lines[i + 1] && !labelOf(lines[i + 1].replace(/:.*$/, ''))) { v = lines[i + 1]; i++; }
          if (k === 'notes') { var more = []; while (lines[i + 1] && !labelOf(lines[i + 1].replace(/:.*$/, '')) && more.length < 20 && !/^(view|reply|open|unsubscribe)/i.test(lines[i + 1])) more.push(lines[++i]); if (more.length) v = [v].concat(more).filter(Boolean).join('\n'); }
          if (v && !out[k]) out[k] = v.trim();
          continue;
        }
      }
      var k2 = labelOf(ln);
      if (k2 && lines[i + 1] && !labelOf(lines[i + 1]) && !/:/.test(lines[i + 1].slice(0, 30))) {
        var val = lines[i + 1]; i++;
        if (k2 === 'address' && lines[i + 1] && new RegExp(STATES + '|\\b\\d{4}\\b').test(lines[i + 1]) && !labelOf(lines[i + 1])) { val += ', ' + lines[i + 1]; i++; }
        if (k2 === 'notes') { var more2 = []; while (lines[i + 1] && !labelOf(lines[i + 1]) && more2.length < 20 && !/^(view|reply|open|unsubscribe)/i.test(lines[i + 1])) more2.push(lines[++i]); if (more2.length) val = [val].concat(more2).join('\n'); }
        if (!out[k2]) out[k2] = val.trim();
      }
    }
    return out;
  }

  function findEmail(text) {
    var all = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (var i = 0; i < all.length; i++) if (!/jobber|bardonclean|noreply|no-reply|notifications?@/i.test(all[i])) return all[i].toLowerCase();
    return '';
  }
  function findPhone(text) {
    var re = /(?:\+?61[\s-]?|\(?0)\(?[2-478]\)?(?:[\s-]?\d){8}/g, m;
    while ((m = re.exec(String(text)))) { var d = digits(m[0]); if (MINE.indexOf(d) < 0 && MINE.indexOf(d.replace(/^61/, '0')) < 0) return fmtPhone(m[0]); }
    return '';
  }
  function fmtPhone(p) {
    var d = digits(p).replace(/^61/, '0');
    if (d.length === 9 && d[0] !== '0') d = '0' + d;
    if (/^04\d{8}$/.test(d)) return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
    if (/^0[2378]\d{8}$/.test(d)) return d.slice(0, 2) + ' ' + d.slice(2, 6) + ' ' + d.slice(6);
    return clean(p);
  }

  // "12 Smith St, Bardon, Queensland 4065" (or "Bardon QLD 4065" with the street on the line before).
  function splitAddress(a, prevLine) {
    var r = { address: '', suburb: '', postcode: '' };
    var s = clean(a).replace(/,?\s*Australia$/i, '');
    var pm = /\b(\d{4})\s*$/.exec(s); if (pm) { r.postcode = pm[1]; s = s.slice(0, pm.index).trim(); }
    s = s.replace(new RegExp(',?\\s*' + STATES + '\\.?$'), '').replace(/,\s*$/, '').trim();
    var parts = s.split(/\s*,\s*/).filter(Boolean);
    if (parts.length >= 2) { r.suburb = parts.pop(); r.address = parts.join(', '); }
    else if (parts.length === 1) {
      // No comma: "12 Smith Street Bardon" — take the last word(s) after a street type as the suburb.
      var m = /^(.*?\b(?:st|street|rd|road|ave|avenue|tce|terrace|pde|parade|cres|crescent|ct|court|dr|drive|pl|place|ln|lane|way|cl|close|hwy|highway|blvd|boulevard|cct|circuit|esp|esplanade|gr|grove|sq|square)\.?)\s+(.+)$/i.exec(parts[0]);
      if (m) { r.address = m[1]; r.suburb = m[2]; }
      else if (/^\d/.test(parts[0])) r.address = parts[0];
      else r.suburb = parts[0];
    }
    if (!r.address && prevLine && /^\d+[a-z]?(?:\/\d+)?\s+\S/i.test(prevLine)) r.address = clean(prevLine).replace(/,$/, '');
    return r;
  }
  function findAddress(lines) {
    var re = new RegExp('\\b' + STATES + '\\b,?\\s*\\d{4}|,\\s*[A-Z][a-z]+(?: [A-Z][a-z]+)*,?\\s+\\d{4}\\b');
    for (var i = 0; i < lines.length; i++) {
      if (re.test(lines[i]) && !/^(?:abn|from|sent|date)\b/i.test(lines[i]) && !/49 Empress/i.test(lines[i])) {
        var line = lines[i].replace(/^[^:]{1,40}:\s*/, '');
        var end = re.exec(line); if (end) line = line.slice(0, end.index + end[0].length);
        var st = STREET.exec(line); if (st && st.index > 0) line = line.slice(st.index);
        return splitAddress(line, lines[i - 1]);
      }
    }
    return null;
  }

  function findService(text) {
    for (var i = 0; i < SERVICE_RULES.length; i++) if (SERVICE_RULES[i][1].test(text)) return SERVICE_RULES[i][0];
    return '';
  }
  function num(re, text) { var m = re.exec(text); return m ? Math.min(+m[1], 12) : null; }

  function parseDate(s, now) {
    s = String(s || ''); now = now || new Date();
    var m, y, mo, d;
    if ((m = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else if ((m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?(?:\s+(20\d{2}))?/.exec(s)) && MON[m[2].slice(0, 3).toLowerCase()]) { d = +m[1]; mo = MON[m[2].slice(0, 3).toLowerCase()]; y = m[3] ? +m[3] : 0; }
    else if ((m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(20\d{2}))?/.exec(s)) && MON[m[1].slice(0, 3).toLowerCase()]) { mo = MON[m[1].slice(0, 3).toLowerCase()]; d = +m[2]; y = m[3] ? +m[3] : 0; }
    else return '';
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
    if (!y) { y = now.getFullYear(); var t = new Date(y, mo - 1, d); if (t < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14)) y++; }
    return y + '-' + pad(mo) + '-' + pad(d);
  }

  function findName(text, lines, f) {
    if (f.name) return clean(f.name);
    if (f.firstName) return clean(f.firstName + ' ' + (f.lastName || ''));
    var m = /(?:new\s+)?request\s+(?:from|by)\s+([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})/.exec(text)
      || /\b([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})\s+(?:has\s+)?(?:submitted|sent|made)\s+(?:a\s+)?(?:new\s+)?request/.exec(text);
    if (m) return clean(m[1]);
    for (var i = 0; i < Math.min(lines.length, 6); i++) {
      var l = lines[i];
      if (/^[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){1,3}$/.test(l) && !/request|jobber|bardon|clean|overview|details|new|client|property|assessment/i.test(l)) return l;
    }
    return '';
  }

  function parse(text, now) {
    var raw = String(text || '').replace(/\r\n?/g, '\n').replace(/[   ]/g, ' ');
    var lines = raw.split('\n').map(function (l) { return clean(l.replace(/^[>\s]+/, '')); }).filter(Boolean);
    var f = fields(lines), out = {};
    out.name = findName(raw, lines, f);
    out.phone = f.phone && digits(f.phone).length >= 8 ? fmtPhone(f.phone) : findPhone(raw);
    out.email = f.email && /@/.test(f.email) ? clean(f.email).toLowerCase() : findEmail(raw);
    var ad = null;
    if (f.address) {
      var a = f.address + (f.street2 ? ', ' + f.street2 : '');
      if (f.suburb && a.indexOf(f.suburb) < 0) a += ', ' + f.suburb;
      if (f.postcode && a.indexOf(f.postcode) < 0) a += ' ' + f.postcode;
      ad = splitAddress(a);
    }
    if (!ad || !ad.suburb) { var found = findAddress(lines); if (found && (!ad || !ad.address || found.address)) ad = found; else if (found && ad) { ad.suburb = found.suburb; ad.postcode = ad.postcode || found.postcode; } }
    ad = ad || { address: '', suburb: '', postcode: '' };
    if (!ad.suburb && f.suburb) ad.suburb = clean(f.suburb);
    if (!ad.postcode && f.postcode && /^\d{4}$/.test(clean(f.postcode))) ad.postcode = clean(f.postcode);
    out.address = ad.address; out.suburb = ad.suburb; out.postcode = ad.postcode;
    out.service = findService([f.service, f.notes].filter(Boolean).join(' ')) || findService(raw) || 'other';
    var bedsText = (f.beds ? f.beds + ' bed ' : '') + raw, bathsText = (f.baths ? f.baths + ' bath ' : '') + raw;
    out.beds = f.beds && /^\d+/.test(f.beds) ? Math.min(parseInt(f.beds, 10), 12) : num(/(\d{1,2})\s*(?:x\s*)?(?:-\s*)?bed(?:room)?s?\b/i, bedsText);
    out.baths = f.baths && /^\d+/.test(f.baths) ? Math.min(parseInt(f.baths, 10), 10) : num(/(\d{1,2})(?:\.5)?\s*(?:x\s*)?(?:-\s*)?bath(?:room)?s?\b/i, bathsText);
    out.date = f.date ? parseDate(f.date, now) : '';
    out.notes = f.notes ? f.notes.slice(0, 2000) : '';
    out.raw = raw.trim().slice(0, 8000);
    return out;
  }

  var api = { parse: parse, parseDate: parseDate, fmtPhone: fmtPhone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BCJobReq = api;
})(typeof window !== "undefined" ? window : globalThis);
