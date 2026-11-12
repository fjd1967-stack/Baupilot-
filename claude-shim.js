/* Laufzeit-Brücke: stellt der Baustellen-App (bau.html) die Funktionen bereit, die sie von der Claude-Umgebung erwartet
   (Datenbank, Dateispeicher, Mail, Downloads, KI), und leitet sie an den eigenen Server weiter. */
(function () {
  'use strict';
  var ROLLE = { chef: false };
  // Angemeldeten Nutzer und Firmendaten sofort (synchron) laden, bevor die App startet.
  // Gibt es keinen Server (404/405/keine Antwort/keine JSON-Antwort, z. B. auf GitHub Pages), läuft die App im
  // Probelauf-Modus: alle Daten bleiben im Browser dieses Geräts (IndexedDB), ohne Konto und ohne Server.
  var KEIN_SERVER = false;
  function sync(p) { try { var x = new XMLHttpRequest(); x.open('GET', p, false); x.send(); if (x.status === 401) { location.replace('login.html'); return null; } if (x.status === 200) { try { return JSON.parse(x.responseText); } catch (e) { KEIN_SERVER = true; return null; } } if (x.status === 404 || x.status === 405 || x.status === 0) KEIN_SERVER = true; return null; } catch (e) { KEIN_SERVER = true; return null; } }
  var ME = sync('/api/me');
  var LOKAL = !ME && KEIN_SERVER, PROFIL = null;
  var ALLE = ['aufgaben', 'belege', 'information', 'arbeitseinteilung', 'fotos', 'bautagebuch', 'rapporte', 'aufmass', 'dokumente', 'lv', 'nachtraege', 'bauzeitenplan', 'anfragen', 'sicherung', 'teamuebersicht'];
  if (LOKAL) {
    try { PROFIL = JSON.parse(localStorage.getItem('bp_profil') || 'null'); } catch (e) { PROFIL = null; }
    if (!PROFIL || !PROFIL.name) { // erst Daten eintragen (einmalig), dann zurück
      location.replace('start.html');
      window.__ME = { name: '', firma: '', rolle: 'chef', funktionen: [] }; window.__F = {};
      window.claude = { use: function () { return new Promise(function () {}); } };
      return;
    }
    ME = { name: PROFIL.name, firma: PROFIL.firma || '', rolle: 'chef', funktionen: ALLE, variante: 'bauleiter' };
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }
  ME = ME || { name: 'Gast', firma: '', rolle: 'mitglied', funktionen: [], variante: 'polier' };
  var FD = LOKAL ? PROFIL : (sync('/api/firma') || {}), PR = LOKAL ? { handy: PROFIL.tel, email: PROFIL.mail } : (sync('/api/profil') || {});
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

  // ---- Probelauf-Modus ohne Server: Daten und Dateien liegen im Browser dieses Geräts (IndexedDB)
  if (LOKAL) {
    var IDB = null, MEM = null;
    var idb = function () { return IDB || (IDB = new Promise(function (ok, no) {
      var r = indexedDB.open('bp-lokal', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('dok', { keyPath: 'p' }); r.result.createObjectStore('assets', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error || new Error('Speicher nicht verfügbar')); };
    })); };
    var tx = function (store, mode, fn) { return idb().then(function (d) { return new Promise(function (ok, no) {
      var t = d.transaction(store, mode), res = fn(t.objectStore(store));
      t.oncomplete = function () { ok(res && 'result' in res ? res.result : res); };
      t.onabort = t.onerror = function () { var e = t.error || new Error('Speichern fehlgeschlagen'); no(e.name === 'QuotaExceededError' ? new Error('Speicherplatz auf dem Gerät ist voll.') : e); };
    }); }); };
    var memLoad = function () { return MEM ? Promise.resolve(MEM) : tx('dok', 'readonly', function (s) { return s.getAll(); }).then(function (rows) { MEM = {}; rows.forEach(function (r) { (MEM[r.k] = MEM[r.k] || {})[r.id] = r.data; }); return MEM; }); };
    var liste = function (m, koll) { var o = m[koll] || {}; return Object.keys(o).sort().map(function (id) { return { id: id, data: o[id] }; }); };
    var lSpeichern = function (pfad, wert, mischen) {
      var t = teil(pfad); if (!t[0] || wert === null || typeof wert !== 'object' || Array.isArray(wert)) return Promise.reject(new Error('Ungültiger Pfad oder Wert.'));
      return memLoad().then(function (m) {
        var alt = (m[t[0]] || {})[t[1]], neu = kopie(mischen && alt ? Object.assign({}, alt, wert) : wert);
        return tx('dok', 'readwrite', function (s) { return s.put({ p: pfad, k: t[0], id: t[1], data: neu }); }).then(function () { (m[t[0]] = m[t[0]] || {})[t[1]] = neu; melde(t[0]); });
      });
    };
    db = {
      doc: function (pfad) {
        var t = teil(pfad);
        return {
          id: t[1], path: pfad,
          get: function () { return memLoad().then(function (m) { var d = (m[t[0]] || {})[t[1]]; return { exists: d !== undefined, id: t[1], data: function () { return kopie(d); } }; }); },
          set: function (w) { return lSpeichern(pfad, w, false); },
          update: function (w) { return lSpeichern(pfad, w, true); },
          delete: function () { return memLoad().then(function (m) { return tx('dok', 'readwrite', function (s) { return s.delete(pfad); }).then(function () { if (m[t[0]]) delete m[t[0]][t[1]]; melde(t[0]); }); }); }
        };
      },
      collection: function (koll) {
        return {
          path: koll,
          doc: function (id) { return db.doc(koll + '/' + id); },
          get: function () { return memLoad().then(function (m) { return snap(liste(m, koll)); }); },
          onSnapshot: function (cb, err) {
            var h = { zu: false };
            h.pruefe = function () { if (h.zu) return; memLoad().then(function (m) { if (!h.zu) cb(snap(liste(m, koll))); }).catch(function (e) { if (!h.zu && err) err(e); }); };
            (hoerer[koll] = hoerer[koll] || []).push(h); h.pruefe();
            return function () { h.zu = true; hoerer[koll] = (hoerer[koll] || []).filter(function (x) { return x !== h; }); };
          }
        };
      }
    };
    assets = {
      upload: function (blob, opt) {
        var id = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        return tx('assets', 'readwrite', function (s) { return s.put({ id: id, typ: (opt && opt.type) || blob.type || 'application/octet-stream', name: blob.name || '', groesse: blob.size, erstellt: Date.now(), blob: blob }); }).then(function () { return { id: id, groesse: blob.size }; });
      },
      delete: function (id) { return tx('assets', 'readwrite', function (s) { return s.delete(String(id)); }).then(function () { return { ok: true }; }); },
      list: function () {
        return tx('assets', 'readonly', function (s) { return s.getAll(); }).then(function (a) {
          var bytes = a.reduce(function (n, x) { return n + (x.groesse || 0); }, 0);
          var est = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().catch(function () { return {}; }) : Promise.resolve({});
          return est.then(function (e) { return { assets: a.map(function (x) { return { id: x.id, typ: x.typ, name: x.name, groesse: x.groesse, erstellt: x.erstellt }; }), usage: { bytes: bytes, maxBytes: (e && e.quota) || 1073741824, files: a.length, maxFiles: 100000 } }; });
        });
      }
    };
    var nein = function (text) { return Promise.reject({ code: 'testversion', message: text }); };
    mcp = {
      listTools: function () { return Promise.resolve([]); },
      callTool: function () { return nein('Direkt senden gibt es in der Testversion nicht. Bitte PDF speichern und per WhatsApp oder E-Mail selbst verschicken.'); }
    };
    sample = function () { return Promise.reject({ code: 'no_sample', message: 'Die automatische Übersetzung ist in der Testversion nicht freigeschaltet.' }); };
    sample.json = sample;
  }

  window.claude = { use: function (n) { return Promise.resolve({ db: db, assets: assets, mcp: mcp, permissions: permissions, downloads: downloads, sample: sample, user: user }[n] || null); } };
  window.BAU_ROLLE = ROLLE;
})();
