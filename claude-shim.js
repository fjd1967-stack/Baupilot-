/* Laufzeit-Brücke: stellt der Baustellen-App (bau.html) die Funktionen bereit, die sie von der Claude-Umgebung erwartet
   (Datenbank, Dateispeicher, Mail, Downloads, KI), und leitet sie an den eigenen Server weiter. */
(function () {
  'use strict';
  var ROLLE = { chef: false };
  // Angemeldeten Nutzer und Firmendaten sofort (synchron) laden, bevor die App startet.
  function sync(p) { try { var x = new XMLHttpRequest(); x.open('GET', p, false); x.send(); if (x.status === 401) { location.replace('login.html'); return null; } return x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e) { return null; } }
  var ME = sync('/api/me') || { name: 'Gast', firma: '', rolle: 'mitglied', funktionen: [], variante: 'polier' };
  var FD = sync('/api/firma') || {}, PR = sync('/api/profil') || {};
  ROLLE.chef = ME.rolle === 'chef';
  var F = { name: FD.name || ME.firma || '', strasse: FD.strasse || '', plz: FD.plz || '', ort: FD.ort || '', tel: FD.tel || '', fax: FD.fax || '', belegvorlage: FD.belegvorlage || '', belegkategorien: FD.belegkategorien, mail: FD.mail || '', web: FD.web || '' };
  window.__ME = ME; window.__F = F;
  window.__RUECK = 'Rückfragen und Rückantwort bitte an ' + ME.name + (PR.handy ? ', T: ' + PR.handy : '') + ((PR.email || ME.rolle === 'chef' && F.mail) ? ', E-Mail: ' + (PR.email || F.mail) : '') + '.';
  window.__FUSS1 = (F.name + '  •  ' + F.strasse + '  •  ' + F.plz + ' ' + F.ort).toUpperCase().replace(/GMBH/, 'GmbH');
  window.__FUSS2 = 'Tel. ' + F.tel + (F.fax ? '  •  Fax ' + F.fax : '') + (F.mail ? '  •  ' + F.mail : '');
  function api(m, p, b, roh) {
    var opt = { method: m, credentials: 'same-origin', headers: {} };
    if (roh) { opt.headers['Content-Type'] = roh.typ; opt.headers['X-Dateiname'] = encodeURIComponent(roh.name || ''); opt.body = roh.blob; }
    else if (b !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(b); }
    return fetch(p, opt).then(function (r) {
      return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) {} if (!r.ok) { var e = new Error(j.fehler || ('Fehler ' + r.status)); e.code = r.status === 401 ? 'login' : r.status === 403 ? 'forbidden' : r.status === 402 ? 'abo' : 'http_' + r.status; e.status = r.status; throw e; } return j; });
    });
  }
  var kopie = function (o) { return o == null ? o : JSON.parse(JSON.stringify(o)); };
  var teil = function (p) { var i = p.lastIndexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };

  // ---- Datenbank
  var hoerer = {}; // koll -> [{cb, err, stand, timer}]
  function snap(docs) { return { docs: docs.map(function (d) { return { id: d.id, data: function () { return kopie(d.data); } }; }), size: docs.length, empty: !docs.length, forEach: function (f) { this.docs.forEach(f); } }; }
  function lade(koll, stand) { return api('GET', '/api/doc/liste?koll=' + encodeURIComponent(koll) + (stand ? '&stand=' + encodeURIComponent(stand) : '')); }
  function melde(koll) { (hoerer[koll] || []).forEach(function (h) { h.pruefe(true); }); }
  var db = {
    doc: function (pfad) {
      var t = teil(pfad);
      return {
        id: t[1], path: pfad,
        get: function () { return api('GET', '/api/doc?pfad=' + encodeURIComponent(pfad)).then(function (r) { return { exists: !!r.vorhanden, id: t[1], data: function () { return kopie(r.data); } }; }); },
        set: function (w) { return api('PUT', '/api/doc', { pfad: pfad, wert: w }).then(function () { melde(t[0]); }); },
        update: function (w) { return api('POST', '/api/doc/update', { pfad: pfad, wert: w }).then(function () { melde(t[0]); }); },
        delete: function () { return api('DELETE', '/api/doc', { pfad: pfad }).then(function () { melde(t[0]); }); }
      };
    },
    collection: function (koll) {
      return {
        path: koll,
        doc: function (id) { return db.doc(koll + '/' + id); },
        get: function () { return lade(koll).then(function (r) { return snap(r.docs || []); }); },
        onSnapshot: function (cb, err) {
          var h = { stand: '', zu: false, laeuft: false };
          h.pruefe = function (erzwingen) {
            if (h.zu || h.laeuft) return; h.laeuft = true;
            lade(koll, erzwingen ? '' : h.stand).then(function (r) { if (h.zu) return; if (!r.unveraendert) { h.stand = r.stand; cb(snap(r.docs || [])); } }).catch(function (e) { if (e && e.code === 'forbidden') { h.zu = true; clearInterval(h.timer); if (!h.leer) { h.leer = true; cb(snap([])); } } else if (!h.zu && err) err(e); }).then(function () { h.laeuft = false; });
          };
          (hoerer[koll] = hoerer[koll] || []).push(h);
          h.pruefe(true);
          h.timer = setInterval(function () { if (!document.hidden) h.pruefe(false); }, 6000);
          return function () { h.zu = true; clearInterval(h.timer); hoerer[koll] = (hoerer[koll] || []).filter(function (x) { return x !== h; }); };
        }
      };
    }
  };

  // ---- Dateispeicher
  var assets = {
    upload: function (blob, opt) { return api('POST', '/api/asset', undefined, { typ: (opt && opt.type) || blob.type || 'application/octet-stream', name: (blob.name || ''), blob: blob }); },
    delete: function (id) { return api('DELETE', '/api/asset', { id: id }); },
    list: function () { return api('GET', '/api/asset/liste'); }
  };

  // ---- Mail und Drive-Ersatz
  var mcp = {
    listTools: function () { return Promise.resolve([{ name: 'send_message' }]); },
    callTool: function (server, tool, args) {
      if (/gmail/i.test(server) && tool === 'send_message') return api('POST', '/api/mail', args).then(function () { return { ok: true }; });
      if (/drive/i.test(server) && tool === 'create_file') {
        var blob = new Blob([args.textContent || ''], { type: 'application/json' });
        return assets.upload(blob, { type: 'application/json' }).then(function (r) { return { id: r.id }; });
      }
      return Promise.reject({ code: 'not_supported', message: server + '/' + tool + ' gibt es hier nicht.' });
    }
  };
  var permissions = { state: function () { return Promise.resolve('granted'); }, request: function () { return Promise.resolve({ 'mcp:Gmail': 'granted' }); } };

  // ---- Downloads
  var downloads = { save: function (o) {
    var u = URL.createObjectURL(o.data), a = document.createElement('a'); a.href = u; a.download = o.filename || 'datei'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 3000); return Promise.resolve();
  } };

  // ---- KI (Übersetzen, Belege lesen)
  function blobB64(b) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1]); }; r.onerror = no; r.readAsDataURL(b); }); }
  async function bilder(x) { if (!x) return []; var l = [].concat(x), out = []; for (var i = 0; i < l.length; i++) out.push({ typ: l[i].type || 'image/jpeg', daten: await blobB64(l[i]) }); return out; }
  var sample = async function (prompt, opt) { var r = await api('POST', '/api/sample', { prompt: prompt, bilder: await bilder(opt && opt.images) }); return { text: r.text }; };
  sample.json = async function (prompt, opt) {
    var r = await api('POST', '/api/sample', { prompt: prompt + '\n\nAntworte ausschließlich mit gültigem JSON.', json: true, bilder: await bilder(opt && opt.images) });
    var m = /[\[{][\s\S]*[\]}]/.exec(r.text || ''); try { return JSON.parse(m ? m[0] : r.text); } catch (e) { throw { code: 'bad_json', message: 'Antwort nicht lesbar' }; }
  };

  var user = { canEdit: function () { return Promise.resolve(ROLLE.chef); } };
  window.claude = { use: function (n) { return Promise.resolve({ db: db, assets: assets, mcp: mcp, permissions: permissions, downloads: downloads, sample: sample, user: user }[n] || null); } };
  window.BAU_ROLLE = ROLLE;
})();
