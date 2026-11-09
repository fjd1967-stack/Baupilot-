/* Ergänzungen für die portierte Baustellen-App: allgemeine Barauslagen-Abrechnung als Excel (ohne Zusatzbibliothek). */
(function () {
  'use strict';
  var te = new TextEncoder();
  var tab = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = tab[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  function zip(files) { // ohne Kompression ("stored"), von Excel lesbar
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = te.encode(f.name), d = te.encode(f.data), c = crc(d);
      var lh = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(d.length), u32(d.length), u16(nm.length), u16(0));
      parts.push(new Uint8Array(lh), nm, d);
      central.push([0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(d.length), u32(d.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off)), nm);
      off += lh.length + nm.length + d.length;
    });
    var cs = 0; central.forEach(function (x) { var a = x.length ? new Uint8Array(x) : x; parts.push(a); cs += a.length; });
    parts.push(new Uint8Array([0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(files.length), u16(files.length), u32(cs), u32(off), u16(0))));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  var X = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var STL = { '9': '19 %', '8': '7 %', '98': '0 %' };
  var serial = function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000) : null; };
  // D = {name, pnr, firma, rows:[{datum,person,text,betrag,st,konto,kst}], erstellt}
  window.__xlsxGeneric = function (D) {
    var str = function (r, s, v) { return v === '' || v == null ? '<c r="' + r + '" s="' + s + '"/>' : '<c r="' + r + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + X(v) + '</t></is></c>'; };
    var num = function (r, s, v) { return v == null || v === '' || !isFinite(+v) ? '<c r="' + r + '" s="' + s + '"/>' : '<c r="' + r + '" s="' + s + '"><v>' + (+v) + '</v></c>'; };
    var rows = [], n = D.rows.length, first = 5, last = first + Math.max(n, 1) - 1, sum = last + 1, tot = 0;
    rows.push('<row r="1">' + str('A1', 1, 'Barauslagenabrechnung' + (D.name ? ' für ' + D.name : '') + (D.pnr ? ' (Personal-Nr. ' + D.pnr + ')' : '')) + '</row>');
    rows.push('<row r="2">' + str('A2', 0, D.firma || '') + '</row>');
    rows.push('<row r="4">' + ['Datum', 'Name', 'Buchungstext', 'Betrag brutto (€)', 'Steuersatz', 'Konto', 'Kostenstelle'].map(function (h, i) { return str('ABCDEFG'[i] + '4', 2, h); }).join('') + '</row>');
    D.rows.forEach(function (x, i) {
      var r = first + i; tot += +x.betrag || 0;
      rows.push('<row r="' + r + '">' + num('A' + r, 3, serial(x.datum)) + str('B' + r, 0, x.person) + str('C' + r, 0, x.text) + num('D' + r, 4, x.betrag) + str('E' + r, 0, STL[x.st] || x.st || '') + str('F' + r, 0, x.konto) + str('G' + r, 0, x.kst) + '</row>');
    });
    rows.push('<row r="' + sum + '">' + str('C' + sum, 2, 'Summe') + '<c r="D' + sum + '" s="5"><f>SUM(D' + first + ':D' + last + ')</f><v>' + Math.round(tot * 100) / 100 + '</v></c></row>');
    rows.push('<row r="' + (sum + 2) + '">' + str('A' + (sum + 2), 0, 'Abrechnung erstellt' + (D.erstellt ? ': ' + D.erstellt : '')) + '</row>');
    rows.push('<row r="' + (sum + 4) + '">' + str('A' + (sum + 4), 0, 'geprüft:') + '</row>');
    var ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + rel + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ' + ns + ' xmlns:r="' + rel + '"><sheets><sheet name="Barauslagen" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + rel + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + rel + '/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ' + ns + '><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0E4E4"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="2" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ' + ns + '><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="3" width="46" customWidth="1"/><col min="4" max="4" width="16" customWidth="1"/><col min="5" max="7" width="14" customWidth="1"/></cols><sheetData>' + rows.join('') + '</sheetData></worksheet>' }
    ]);
  };
})();
