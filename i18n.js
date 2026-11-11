/* Mehrsprachigkeit: Jeder Nutzer wählt seine Sprache. Oberfläche und fremde Texte erscheinen in dieser Sprache,
   was er schreibt oder diktiert, wird beim Verlassen des Feldes ins Deutsche übersetzt (Dokumente bleiben deutsch).
   Wörterbuch (woerter.js) zuerst, alles andere übersetzt der Server einmal und merkt es sich für alle. */
(function () {
  'use strict';
  if (window.I18N) return;
  var S = window.SPRACHEN || { de: { nativ: 'Deutsch', sr: 'de-DE' } };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var ME = window.__ME || null, lang = 'de', ready = false;
  var LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
  var MSG = {
    trans: { sq: 'Po përkthehet në gjermanisht …', ro: 'Se traduce în germană …', tr: 'Almancaya çevriliyor …', pl: 'Tłumaczenie na niemiecki …', en: 'Translating into German …', el: 'Μετάφραση στα γερμανικά …', bg: 'Превежда се на немски …', es: 'Traduciendo al alemán …' },
    fail: { sq: 'Përkthimi nuk funksionoi. Teksti mbetet në gjuhën tuaj.', ro: 'Traducerea nu a reușit. Textul rămâne în limba ta.', tr: 'Çeviri yapılamadı. Metin kendi dilinizde kalıyor.', pl: 'Tłumaczenie nie powiodło się. Tekst pozostaje w Twoim języku.', en: 'Translation failed. Your text stays in your language.', el: 'Η μετάφραση απέτυχε. Το κείμενο παραμένει στη γλώσσα σας.', bg: 'Преводът не успя. Текстът остава на вашия език.', es: 'La traducción falló. Tu texto se queda en tu idioma.' },
    pick: 'Sprache wählen · Zgjidh gjuhën · Alege limba · Dilinizi seçin · Wybierz język · Choose your language · Επιλέξτε γλώσσα · Изберете език · Elige tu idioma'
  };

  // ---------- Wörterbuch und Zwischenspeicher
  var DICT = {};
  function baueDict() {
    var W = window.WOERTER; DICT = {}; if (!W) return;
    var i = W.sprachen.indexOf(lang); if (i < 1) return;
    W.zeilen.forEach(function (z) { DICT[z[0]] = z[i]; });
  }
  var cache = {}, cacheDirty = false;
  function ladeCache() { try { cache = JSON.parse(LS.get('i18n-cache-' + lang) || '{}') || {}; } catch (e) { cache = {}; } }
  function speichereCache() {
    if (!cacheDirty) return; cacheDirty = false;
    if (Object.keys(cache).length > 4000) cache = {};
    LS.set('i18n-cache-' + lang, JSON.stringify(cache));
  }
  setInterval(speichereCache, 4000);
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function lookup(key) { return DICT[key] != null ? DICT[key] : cache[key] != null ? cache[key] : null; }

  // ---------- Server-Aufruf
  function post(p, b) {
    return fetch(p, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.fehler || ('Fehler ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function uebersetzen(texte, nach) { return post('/api/uebersetzen', { texte: texte, nach: nach }).then(function (r) { return r.texte; }); }

  // ---------- Warteschlange für unbekannte Texte (gesammelt, höchstens 30 je Anfrage)
  var wartend = {}, laeuft = false, timer = null, fehlerBis = {};
  function einreihen(key, fn) {
    if (fehlerBis[key] && fehlerBis[key] > Date.now()) return;
    (wartend[key] = wartend[key] || []).push(fn);
    if (!timer) timer = setTimeout(abarbeiten, 350);
  }
  function abarbeiten() {
    timer = null; if (laeuft) { timer = setTimeout(abarbeiten, 400); return; }
    var keys = Object.keys(wartend).slice(0, 30); if (!keys.length) return;
    var arbeit = {}; keys.forEach(function (k) { arbeit[k] = wartend[k]; delete wartend[k]; });
    laeuft = true;
    uebersetzen(keys, lang).then(function (tr) {
      keys.forEach(function (k, i) { if (typeof tr[i] === 'string' && tr[i]) { cache[k] = tr[i]; cacheDirty = true; arbeit[k].forEach(function (f) { f(tr[i]); }); } });
    }).catch(function (e) {
      keys.forEach(function (k) { fehlerBis[k] = Date.now() + (e && e.status === 401 ? 3600e3 : 60e3); });
    }).then(function () { laeuft = false; if (Object.keys(wartend).length && !timer) timer = setTimeout(abarbeiten, 300); });
  }

  // ---------- Oberfläche und fremde Texte (nur Anzeige, Daten bleiben unverändert)
  var textInfo = new WeakMap(), attrInfo = new WeakMap(), ATTR = ['placeholder', 'title', 'aria-label'];
  function ueberspringen(el) {
    if (!el || !el.closest) return true;
    return !!el.closest('script,style,textarea,input,noscript,code,pre,svg,[data-nt],[translate=no],.daten dd,.i18n-pick,.i18n-orig,.tb[data-lang="' + lang + '"]');
  }
  function rand(raw, tr) { return /^\s*/.exec(raw)[0] + tr + /\s*$/.exec(raw)[0]; }
  function textNode(node) {
    var info = textInfo.get(node), raw = (info && node.nodeValue === info.tr) ? info.de : node.nodeValue;
    if (lang === 'de') { if (info && node.nodeValue === info.tr) { node.nodeValue = info.de; } textInfo.delete(node); return; }
    if (ueberspringen(node.parentElement)) return;
    var key = norm(raw); if (key.length < 2 || key.length > 3000 || !LETTER.test(key)) return;
    var setze = function (tr) { var cur = textInfo.get(node), now = (cur && node.nodeValue === cur.tr) ? cur.de : node.nodeValue; if (now !== raw || !node.isConnected) return; var v = rand(raw, tr); textInfo.set(node, { de: raw, tr: v }); if (node.nodeValue !== v) node.nodeValue = v; };
    var tr = lookup(key); if (tr != null) setze(tr); else einreihen(key, setze);
  }
  function attribut(el, a) {
    var m = attrInfo.get(el) || {}, info = m[a], cur = el.getAttribute(a); if (cur == null) return;
    var raw = (info && cur === info.tr) ? info.de : cur;
    if (lang === 'de') { if (info && cur === info.tr) el.setAttribute(a, info.de); delete m[a]; return; }
    if (el.closest('[data-nt],[translate=no],.i18n-pick')) return;
    var key = norm(raw); if (key.length < 2 || key.length > 300 || !LETTER.test(key)) return;
    var setze = function (tr) { var c = el.getAttribute(a), i2 = (attrInfo.get(el) || {})[a], now = (i2 && c === i2.tr) ? i2.de : c; if (now !== raw) return; var mm = attrInfo.get(el) || {}; mm[a] = { de: raw, tr: tr }; attrInfo.set(el, mm); el.setAttribute(a, tr); };
    var tr = lookup(key); if (tr != null) setze(tr); else einreihen(key, setze);
    attrInfo.set(el, m);
  }
  function scan(root) {
    if (!root || (lang === 'de' && !ready)) return;
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    var w = document.createTreeWalker(root, 4, null), n; while ((n = w.nextNode())) textNode(n);
    var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    for (var i = 0; i < els.length; i++) ATTR.forEach(function (a) { if (els[i].hasAttribute(a)) attribut(els[i], a); });
    if (root.nodeType === 1) ATTR.forEach(function (a) { if (root.hasAttribute(a)) attribut(root, a); });
    if (lang !== 'de') vorschauen(root);
  }

  // ---------- Schreiben in der eigenen Sprache: beim Verlassen des Feldes ins Deutsche übersetzen
  function wert(el) { return el.value || ''; }
  function schreibfeld(el) {
    if (!el || lang === 'de' || el.nodeType !== 1) return false;
    if (el.closest('[data-nt],[translate=no],.i18n-pick') || el.readOnly || el.disabled) return false;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search') && (wert(el).match(/\s+\S/g) || []).length >= 2;
  }
  function ausloesen(el) { el.__feuer = true; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.__feuer = false; }
  function hinweis(el, text) {
    var h = el.nextElementSibling && el.nextElementSibling.classList.contains('i18n-orig') ? el.nextElementSibling : null;
    if (!text) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('div'); h.className = 'i18n-orig'; h.setAttribute('data-nt', '1'); h.style.cssText = 'font:italic 13px/1.35 system-ui,sans-serif;color:#555;margin:3px 0 8px;white-space:pre-wrap'; el.parentNode.insertBefore(h, el.nextSibling); }
    h.textContent = '🌐 ' + (S[lang] ? S[lang].nativ : lang) + ': ' + text;
  }
  function zuDeutsch(el) {
    var v = wert(el); el.__dirty = false;
    if (!schreibfeld(el) || v.trim().length < 4 || !LETTER.test(v) || el.__fertig === v) return Promise.resolve();
    return uebersetzen([v], 'de').then(function (r) {
      var de = r[0]; if (typeof de !== 'string' || !de) return;
      if (de !== v) { el.__orig = v; el.value = de; el.__fertig = de; ausloesen(el); hinweis(el, v); } else { el.__fertig = v; hinweis(el, ''); }
    }).catch(function () { toast((MSG.fail[lang] || MSG.fail.en)); });
  }
  // Deutsche Texte in Feldern für den Leser: Übersetzung in seiner Sprache darunter (nur Ansicht)
  function vorschauen(root) {
    var l = root.querySelectorAll ? root.querySelectorAll('textarea') : [];
    for (var i = 0; i < l.length; i++) (function (el) {
      var v = norm(wert(el)); if (el.__orig || el.__vv === v || v.length < 10 || !LETTER.test(v) || el.closest('[data-nt],[translate=no],.i18n-pick')) return;
      el.__vv = v; var tr = lookup(v);
      var zeige = function (t) { if (norm(wert(el)) === v && !el.__orig) hinweis(el, t && norm(t) !== v ? t : ''); };
      if (tr != null) zeige(tr); else einreihen(v, zeige);
    })(l[i]);
  }
  document.addEventListener('input', function (e) { if (!e.target.__feuer && lang !== 'de' && schreibfeld(e.target)) e.target.__dirty = true; }, true);
  document.addEventListener('focusout', function (e) { if (e.target.__dirty) zuDeutsch(e.target); }, true);
  document.addEventListener('click', function (e) {
    if (lang === 'de' || window.__i18nRedo) return;
    var b = e.target.closest && e.target.closest('button,[role=button],a[href],input[type=button],input[type=submit]'); if (!b || b.closest('.i18n-pick')) return;
    var dirty = [].slice.call(document.querySelectorAll('textarea,input[type=text],input[type=search]')).filter(function (x) { return x.__dirty; });
    if (!dirty.length) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    toast(MSG.trans[lang] || MSG.trans.en);
    Promise.all(dirty.map(zuDeutsch)).then(function () { window.__i18nRedo = true; try { b.click(); } finally { window.__i18nRedo = false; } });
  }, true);

  // ---------- kleine Meldung
  var toastEl = null, toastT = null;
  function toast(t) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'i18n-pick'; toastEl.setAttribute('data-nt', '1'); toastEl.setAttribute('role', 'status'); toastEl.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#222;color:#fff;padding:8px 14px;border-radius:999px;font:14px system-ui,sans-serif;z-index:100001;max-width:90%;text-align:center'; document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { toastEl.style.display = 'none'; }, 2600);
  }

  // ---------- Sprachwahl
  function waehle(code) {
    if (!S[code]) return;
    LS.set('sprache', code);
    var fertig = function () { location.reload(); };
    if (ME) post('/api/sprache', { sprache: code }).then(function () { LS.del('spracheWahl'); fertig(); }).catch(fertig);
    else { LS.set('spracheWahl', code); fertig(); }
  }
  function dialog(erstmals) {
    if (document.querySelector('.i18n-pick.dlg')) return;
    var ov = document.createElement('div'); ov.className = 'i18n-pick dlg'; ov.setAttribute('data-nt', '1'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
    var box = document.createElement('div'); box.style.cssText = 'background:#fff;color:#111;border-radius:16px;padding:20px;max-width:420px;width:100%;max-height:90vh;overflow:auto';
    var h = document.createElement('h2'); h.textContent = '🌐'; h.style.cssText = 'margin:0 0 6px;font-size:22px'; box.appendChild(h);
    var p = document.createElement('p'); p.textContent = MSG.pick; p.style.cssText = 'margin:0 0 14px;font-size:14px;color:#555;line-height:1.4'; box.appendChild(p);
    Object.keys(S).forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = S[c].nativ + (c === lang ? '  ✓' : '');
      b.style.cssText = 'display:block;width:100%;text-align:left;margin:0 0 8px;padding:14px;border:2px solid ' + (c === lang ? '#c2410c' : '#ddd') + ';border-radius:12px;background:#fff;color:#111;font-size:18px;font-weight:600;cursor:pointer';
      b.addEventListener('click', function () { waehle(c); }); box.appendChild(b);
    });
    if (!erstmals) { var x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close'); x.style.cssText = 'display:block;width:100%;padding:12px;border:0;border-radius:12px;background:#eee;color:#111;font-size:16px;cursor:pointer'; x.addEventListener('click', function () { ov.remove(); }); box.appendChild(x); }
    ov.appendChild(box); document.body.appendChild(ov);
    var first = box.querySelector('button'); if (first) first.focus();
  }
  function knopf() {
    if (document.querySelector('.i18n-pick.pill')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'i18n-pick pill'; b.setAttribute('data-nt', '1');
    b.textContent = '🌐 ' + (S[lang] ? S[lang].nativ : lang); b.setAttribute('aria-label', 'Language / Sprache');
    b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99990;padding:8px 12px;border:1px solid #bbb;border-radius:999px;background:rgba(255,255,255,.94);color:#111;font:600 14px system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer';
    b.addEventListener('click', function () { dialog(false); }); document.body.appendChild(b);
  }

  // ---------- Start
  function start() {
    var wahl = LS.get('spracheWahl');
    if (ME) {
      if (!ME.spracheGesetzt && wahl && S[wahl] && wahl !== ME.sprache) { post('/api/sprache', { sprache: wahl }).then(function () { LS.del('spracheWahl'); location.reload(); }).catch(function () {}); }
      lang = S[ME.sprache] ? ME.sprache : 'de';
    } else lang = S[LS.get('sprache')] ? LS.get('sprache') : 'de';
    if (ME && ME.spracheGesetzt === false && !wahl) setTimeout(function () { dialog(true); }, 400);
    document.documentElement.lang = lang;
    window.I18N = { sprache: lang, sr: (S[lang] || {}).sr || 'de-DE', t: function (de) { var k = norm(de); return lang === 'de' ? de : (lookup(k) || de); }, uebersetzen: uebersetzen, zuDeutsch: zuDeutsch, waehle: waehle, dialog: dialog };
    knopf();
    if (lang === 'de') { ready = true; return; }
    baueDict(); ladeCache(); ready = true;
    scan(document.body);
    new MutationObserver(function (ms) {
      var roots = [];
      ms.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (n) { roots.push(n); });
        else if (m.type === 'characterData') roots.push(m.target);
        else if (m.type === 'attributes') { var i = (attrInfo.get(m.target) || {})[m.attributeName]; if (!i || m.target.getAttribute(m.attributeName) !== i.tr) roots.push(m.target); }
      });
      if (!roots.length) return;
      clearTimeout(start.t); start.q = (start.q || []).concat(roots);
      start.t = setTimeout(function () { var q = start.q; start.q = []; q.forEach(function (n) { if (n.isConnected !== false) scan(n); }); }, 80);
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  function los() {
    if (window.__ME !== undefined || window.__I18N_OHNE_ME) { ME = window.__ME || null; return start(); }
    fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (m) { ME = m; start(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
})();
