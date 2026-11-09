/* Konto-Modus: verbindet die App mit dem Server (Anmeldung, Variante, Team, Einblick, KI-Assistent).
   Ohne Server (z. B. Vorschau) bleibt alles wie bisher lokal auf dem Gerät. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var VAR = { vorarbeiter: 'Vorarbeiter', polier: 'Polier', bauleiter: 'Bauleiter' };
  var me = null;

  function api(m, p, b) {
    return fetch(p, { method: m, credentials: 'same-origin', headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); });
  }
  function el(tag, cls, text, kids) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text;
    (kids || []).forEach(function (k) { if (k) e.appendChild(k); }); return e;
  }
  function knopf(text, fn, cls) { var b = el('button', 'btn klein ' + (cls || 'ghost'), text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function feld(label, kontrolle, id) { var l = el('label', null, label); l.setAttribute('for', id); kontrolle.id = id; return el('div', 'feld', null, [l, kontrolle]); }
  function varWahl(wert) {
    var s = el('select'); Object.keys(VAR).forEach(function (k) { var o = el('option', null, VAR[k]); o.value = k; s.appendChild(o); }); s.value = wert || 'polier'; return s;
  }

  // ---------- Einstellungen der KI (Schrift, Kontrast, ausgeblendete Funktionen)
  var einst = {};
  function anwenden() {
    var r = document.documentElement;
    r.style.fontSize = einst.schriftgroesse === 'gross' ? '112%' : einst.schriftgroesse === 'sehr-gross' ? '125%' : '';
    r.classList.toggle('kontrast', einst.kontrast === 'hoch');
  }

  // ---------- Tabs
  var tabs = $('tabs'), main = document.querySelector('main.profil');
  function neuerTab(name, titel, inhalt, vorn) {
    var b = el('button', null, titel); b.setAttribute('role', 'tab'); b.id = 't-' + name; b.dataset.tab = name; b.setAttribute('aria-selected', 'false'); b.setAttribute('aria-controls', 'tab-' + name); b.tabIndex = -1;
    var d = el('div', 'tab', null, inhalt); d.id = 'tab-' + name; d.setAttribute('role', 'tabpanel'); d.hidden = true;
    if (vorn) { tabs.insertBefore(b, tabs.firstChild); main.insertBefore(d, main.firstChild); } else { tabs.appendChild(b); main.appendChild(d); }
    return d;
  }
  function entferneTab(name) { var b = $('t-' + name), d = $('tab-' + name); if (b) b.remove(); if (d) d.remove(); }
  function waehle(name) { var b = $('t-' + name); if (b) b.click(); }

  // ---------- Start: Funktionen der Variante
  function startTab() {
    var d = neuerTab('start', 'Start', [], true), liste = el('div');
    d.appendChild(el('h1', null, 'Hallo ' + me.name.split(' ')[0] + '.'));
    d.appendChild(el('p', 'lead', me.firma + ' · ' + VAR[me.variante] + (me.rolle === 'chef' ? ' (Chef)' : '')));
    d.appendChild(el('h2', 'gruppe', 'Das kannst du in deiner Variante'));
    var aus = einst.ausblenden || [];
    me.funktionen.forEach(function (k) {
      if (aus.indexOf(k) >= 0) return;
      liste.appendChild(el('div', 'b-eintrag', null, [el('div', 'name', me.funktionenText[k])]));
    });
    d.appendChild(liste);
    d.appendChild(el('p', 'hilfe', 'Funktionen, die zu einer anderen Variante gehören, sind für dich nicht freigeschaltet. Frag deinen Chef, wenn du mehr brauchst.'));
    d.appendChild(knopf('Abmelden', function () { api('POST', '/api/logout', {}).then(function () { location.href = 'login.html'; }); }));
  }

  // ---------- KI-Assistent
  function kiTab() {
    var ta = el('textarea'); ta.rows = 4; ta.maxLength = 1000; ta.placeholder = 'Zum Beispiel: Die Schrift soll größer sein. Oder: Blende die Arbeitseinteilung aus.';
    var antw = el('p', 'hilfe', ''); antw.setAttribute('role', 'status');
    var senden = knopf('Wunsch abschicken', function () {
      var w = ta.value.trim(); if (w.length < 3) { antw.textContent = 'Bitte schreib deinen Wunsch.'; return; }
      senden.disabled = true; antw.textContent = 'Einen Moment …';
      api('POST', '/api/ki', { wunsch: w }).then(function (r) {
        senden.disabled = false;
        if (r.s === 200) { einst = r.j.einstellungen || einst; anwenden(); antw.textContent = r.j.antwort || 'Erledigt.'; ta.value = ''; }
        else antw.textContent = r.j.fehler || 'Das hat nicht geklappt.';
      }).catch(function () { senden.disabled = false; antw.textContent = 'Keine Verbindung.'; });
    }, 'gelb gross');
    neuerTab('assistent', 'Assistent', [el('h1', null, 'Dein Assistent'),
      el('p', 'lead', 'Sag oder schreib, wie du die App haben willst. Der Assistent stellt sie nur für dich ein, die anderen im Team merken nichts davon.'),
      feld('Dein Wunsch', ta, 'ki-wunsch'), el('div', 'knoepfe', null, [senden]), antw,
      el('p', 'hilfe', 'Er kann Schriftgröße, Kontrast, Startseite, ausgeblendete Funktionen, Übersetzungssprachen und Standardtext einstellen. Alles andere gibt er als Wunsch an den Hersteller weiter.')]);
  }

  // ---------- Team (Chef)
  function einladungAnzeigen(box, e, kontakt) {
    var wa = kontakt.indexOf('@') < 0 ? 'https://wa.me/' + kontakt.replace(/[^\d]/g, '').replace(/^0/, '49') + '?text=' + encodeURIComponent(e.text) : null;
    box.textContent = '';
    box.appendChild(el('p', 'hilfe ok', 'Einladung bereit.'));
    var z = el('div', 'zeile2');
    if (wa) { var a = el('a', 'btn klein ghost', 'Per WhatsApp senden'); a.href = wa; a.target = '_blank'; a.rel = 'noopener'; z.appendChild(a); }
    z.appendChild(knopf('Link kopieren', function () { if (navigator.clipboard) navigator.clipboard.writeText(e.link); }));
    box.appendChild(z);
  }
  function teamTab() {
    var d = $('tab-team'); d.textContent = '';
    d.appendChild(el('h1', null, 'Dein Team'));
    d.appendChild(el('p', 'lead', 'Lege deine Mitarbeiter an und wähle ihre Variante. Du kannst sie später ändern.'));
    var plan = el('p', 'plan'), liste = el('div'), meld = el('p', 'hilfe', ''); meld.setAttribute('role', 'status');
    var nameF = el('input'); nameF.type = 'text'; nameF.autocomplete = 'off';
    var konF = el('input'); konF.type = 'text'; konF.inputMode = 'email'; konF.autocomplete = 'off';
    var varF = varWahl('polier'), kiF = el('input'); kiF.type = 'checkbox';
    var kiZeile = el('label', 'check', ' KI-Assistent für diesen Nutzer', [null]); kiZeile.insertBefore(kiF, kiZeile.firstChild);
    var einl = el('div');
    var anlegen = el('button', 'btn gelb gross', 'Nutzer anlegen'); anlegen.type = 'submit';
    var form = el('form', null, null, [feld('Name', nameF, 'k-name'), feld('Handynummer oder E-Mail', konF, 'k-kon'), feld('Variante', varF, 'k-var'), kiZeile, el('div', 'knoepfe', null, [anlegen])]);
    form.noValidate = true;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); meld.textContent = '';
      api('POST', '/api/team', { name: nameF.value, kontakt: konF.value, variante: varF.value, ki: kiF.checked }).then(function (r) {
        if (r.s !== 200) { meld.textContent = r.j.fehler || 'Das hat nicht geklappt.'; return; }
        einladungAnzeigen(einl, r.j.einladung, konF.value); form.reset(); laden();
      });
    });
    var zahlen = el('div');
    d.appendChild(plan); d.appendChild(form); d.appendChild(meld); d.appendChild(einl); d.appendChild(liste); d.appendChild(zahlen);

    function laden() {
      api('GET', '/api/team').then(function (r) {
        if (r.s !== 200) return;
        var n = r.j.nutzer, kiN = n.filter(function (x) { return x.ki; }).length;
        plan.textContent = 'Gebucht: ' + r.j.gebucht + ' Nutzer · angelegt: ' + n.length + ' · KI-Assistenten: ' + kiN + ' von ' + r.j.kiGebucht;
        liste.textContent = '';
        n.forEach(function (u) {
          var v = varWahl(u.variante), k = el('input'); k.type = 'checkbox'; k.checked = !!u.ki;
          var kl = el('label', 'check', ' KI', [null]); kl.insertBefore(k, kl.firstChild);
          function speichern() { api('POST', '/api/team/aendern', { id: u.id, variante: v.value, ki: k.checked }).then(function (x) { if (x.s !== 200) { meld.textContent = x.j.fehler || 'Das hat nicht geklappt.'; laden(); } else meld.textContent = 'Gespeichert.'; }); }
          v.addEventListener('change', speichern); k.addEventListener('change', speichern);
          var z = el('div', 'zeile2');
          if (u.rolle === 'mitglied') {
            z.appendChild(v); z.appendChild(kl);
            z.appendChild(knopf('Einladung', function () { api('POST', '/api/team/einladen', { id: u.id }).then(function (x) { if (x.s === 200) einladungAnzeigen(einl, x.j.einladung, u.kontakt); else meld.textContent = x.j.fehler || ''; }); }));
            z.appendChild(knopf('Entfernen', function () { if (confirm(u.name + ' wirklich entfernen?')) api('DELETE', '/api/team', { id: u.id }).then(laden); }));
          }
          liste.appendChild(el('div', 't-eintrag', null, [el('div', 'name', u.name + (u.rolle === 'chef' ? ' (Chef)' : '')), el('div', 'meta', u.kontakt + ' · ' + VAR[u.variante] + (u.angenommen ? ' · installiert' : u.eingeladen ? ' · eingeladen' : '')), z]));
        });
        zahlen.textContent = '';
        var nz = el('input'); nz.type = 'number'; nz.min = 1; nz.max = 200; nz.value = r.j.gebucht;
        var kz = el('input'); kz.type = 'number'; kz.min = 0; kz.max = 200; kz.value = r.j.kiGebucht;
        zahlen.appendChild(el('h2', 'gruppe', 'Buchung ändern'));
        zahlen.appendChild(feld('Anzahl Nutzer', nz, 'k-nz')); zahlen.appendChild(feld('Anzahl KI-Assistenten', kz, 'k-kz'));
        zahlen.appendChild(knopf('Buchung speichern', function () {
          api('POST', '/api/abo/nutzer', { nutzer: +nz.value }).then(function (a) {
            if (a.s !== 200) { meld.textContent = a.j.fehler || ''; return; }
            api('POST', '/api/abo/ki', { anzahl: +kz.value }).then(function (b) { meld.textContent = b.s === 200 ? 'Gespeichert. Neu: ' + (b.j.monatlichNetto / 100).toFixed(2).replace('.', ',') + ' € netto im Monat.' : (b.j.fehler || ''); laden(); });
          });
        }, 'gelb'));
        zahlen.appendChild(el('p', 'hilfe', 'Änderungen werden anteilig mit der nächsten Rechnung abgerechnet.'));
      });
    }
    laden();
  }

  // ---------- Einblick (Chef)
  function einblickTab() {
    var sel = el('select'), out = el('div'), meld = el('p', 'hilfe', '');
    var d = neuerTab('einblick', 'Einblick', [el('h1', null, 'Einblick'), el('p', 'lead', 'Hier siehst du die Angaben und Daten deiner Mitarbeiter. Du kannst nur lesen.'), feld('Mitarbeiter', sel, 'e-wer'), meld, out]);
    api('GET', '/api/team').then(function (r) {
      (r.j.nutzer || []).filter(function (u) { return u.rolle === 'mitglied'; }).forEach(function (u) { var o = el('option', null, u.name + ' (' + VAR[u.variante] + ')'); o.value = u.id; sel.appendChild(o); });
      if (!sel.options.length) meld.textContent = 'Noch keine Mitarbeiter angelegt.'; else zeige();
    });
    function zeige() {
      out.textContent = ''; if (!sel.value) return;
      api('GET', '/api/team/einblick?id=' + sel.value).then(function (r) {
        if (r.s !== 200) { meld.textContent = r.j.fehler || ''; return; }
        var p = r.j.profil || {}, dl = el('dl', 'daten');
        [['Name', ((p.vorname || '') + ' ' + (p.nachname || '')).trim() || r.j.name], ['Funktion', p.funktion], ['Handy', p.handy], ['E-Mail', p.email]].forEach(function (x) { if (x[1]) dl.appendChild(el('div', null, null, [el('dt', null, x[0]), el('dd', null, x[1])])); });
        out.appendChild(dl);
        out.appendChild(el('h2', 'gruppe', 'Daten'));
        if (!r.j.bereiche.length) out.appendChild(el('p', 'hilfe', 'Noch keine Daten gespeichert.'));
        r.j.bereiche.forEach(function (b) {
          var pre = el('pre', 'hilfe'); pre.hidden = true; pre.style.whiteSpace = 'pre-wrap';
          out.appendChild(el('div', 'b-eintrag', null, [el('div', 'name', b.schluessel), el('div', 'meta', 'geändert ' + new Date(b.geaendert).toLocaleString('de-DE')),
            knopf('Ansehen', function () { api('GET', '/api/team/einblick?id=' + sel.value + '&bereich=' + encodeURIComponent(b.schluessel)).then(function (x) { pre.textContent = JSON.stringify(x.j.wert, null, 2); pre.hidden = !pre.hidden; }); }), pre]));
        });
      });
    }
    sel.addEventListener('change', zeige);
  }

  // ---------- Profil und Firma mit dem Server abgleichen
  var FIRMA_MAP = { name: 'name', form: 'form', str: 'strasse', plz: 'plz', ort: 'ort', tel: 'tel', mail: 'mail', web: 'web', gf: 'gf', ust: 'ust', steuer: 'steuer', hr: 'hr', iban: 'iban' };
  function lokal(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function profilHoch() {
    var p = lokal('profil-v1'); if (!p) return;
    api('POST', '/api/profil', { vorname: p.vorname, nachname: p.nachname, funktion: p.funktion, geburt: p.geburt, handy: p.handy, email: p.email });
  }
  function firmaHoch() {
    var f = lokal('firma-v1'); if (!f || me.rolle !== 'chef') return; var o = {};
    Object.keys(FIRMA_MAP).forEach(function (k) { if (f[k] != null) o[FIRMA_MAP[k]] = f[k]; });
    api('POST', '/api/firma', o);
  }
  function abgleichen() {
    api('GET', '/api/profil').then(function (r) {
      if (r.s === 200 && r.j.vorname && !lokal('profil-v1')) {
        var p = { vorname: r.j.vorname, nachname: r.j.nachname || '', firma: me.firma, funktion: r.j.funktion || '', geburt: r.j.geburt || '', handy: r.j.handy || '', email: r.j.email || '' };
        try { localStorage.setItem('profil-v1', JSON.stringify(p)); } catch (e) {} document.dispatchEvent(new Event('profil-geaendert'));
      } else if (!lokal('profil-v1')) {
        // Neuer Nutzer: Formular nur vorbelegen, nichts erfinden
        var teil = me.name.split(' '), vor = function (id, v) { var e = $(id); if (e && !e.value) e.value = v; };
        vor('vorname', teil[0]); vor('nachname', teil.slice(1).join(' ')); vor('firma', me.firma); vor('funktion', VAR[me.variante]);
      }
    });
    api('GET', '/api/firma').then(function (r) {
      if (r.s !== 200 || lokal('firma-v1') || !r.j.name) return;
      var f = {}; Object.keys(FIRMA_MAP).forEach(function (k) { f[k] = r.j[FIRMA_MAP[k]] || ''; });
      try { localStorage.setItem('firma-v1', JSON.stringify(f)); } catch (e) {}
    });
    document.addEventListener('profil-geaendert', profilHoch);
    var alt = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { alt.call(this, k, v); if (k === 'firma-v1') firmaHoch(); };
  }

  // ---------- Start
  function los() {
    document.body.classList.add('konto');
    var kopf = document.querySelector('header.top');
    kopf.appendChild(el('span', 'hilfe', me.firma + ' · ' + VAR[me.variante]));
    tabs.hidden = false;
    api('GET', '/api/einstellungen').then(function (r) {
      einst = r.s === 200 ? r.j : {}; anwenden();
      // Das Profil-Formular wird erst gebraucht, wenn noch kein lokales Profil da ist; abgleichen füllt es vor.
      abgleichen();
      startTab();
      if (me.ki) kiTab();
      if (me.rolle === 'chef') { teamTab(); einblickTab(); } else entferneTab('team');
      if (me.rolle !== 'chef') entferneTab('firma');
      if (me.status !== 'aktiv') {
        main.insertBefore(el('p', 'fehler', 'Das Abo ist nicht aktiv (' + me.status + '). Bitte kläre die Zahlung, bis dahin ist die App nur lesend.'), main.firstChild);
      }
      // Tabs neu verdrahten (app.js kennt die neuen Tabs nicht)
      [].slice.call(tabs.querySelectorAll('[role=tab]')).forEach(function (b) {
        if (b.dataset.verdrahtet) return; b.dataset.verdrahtet = '1';
        b.addEventListener('click', function () {
          [].slice.call(tabs.querySelectorAll('[role=tab]')).forEach(function (x) { var an = x === b; x.setAttribute('aria-selected', an); x.tabIndex = an ? 0 : -1; var p = $('tab-' + x.dataset.tab); if (p) p.hidden = !an; });
        });
      });
      waehle('start');
    });
  }
  fetch('/api/me', { credentials: 'same-origin' }).then(function (r) {
    if (r.status === 401) { // Server da, aber nicht angemeldet
      var h = $('tabs'); if (h && h.parentNode) h.parentNode.insertBefore(el('p', 'hilfe', null, [document.createTextNode('Schon Kunde? '), Object.assign(el('a', null, 'Anmelden'), { href: 'login.html' })]), h);
      return null;
    }
    return r.ok ? r.json() : null;
  }).then(function (j) { if (j && j.name) { me = j; los(); } }).catch(function () {});
})();
