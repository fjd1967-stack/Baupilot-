/* Persönliche Angaben: prüfen, auf dem Gerät speichern, anzeigen, ändern, löschen. */
(function () {
  'use strict';
  var KEY = 'profil-v1';
  var FELDER = ['vorname', 'nachname', 'firma', 'funktion', 'geburt', 'handy', 'email'];
  var $ = function (id) { return document.getElementById(id); };

  function laden() { try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function speichern(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }
  function entfernen() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function heute() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function datumDE(iso) { var t = iso.split('-'); return t[2] + '.' + t[1] + '.' + t[0]; }

  var regeln = {
    vorname: function (v) { return v.length < 2 ? 'Bitte gib deinen Vornamen ein.' : ''; },
    nachname: function (v) { return v.length < 2 ? 'Bitte gib deinen Nachnamen ein.' : ''; },
    firma: function (v) { return v.length < 2 ? 'Bitte gib den Namen deiner Firma ein.' : ''; },
    funktion: function (v) { return v.length < 2 ? 'Bitte gib deine Funktion in der Firma ein.' : ''; },
    geburt: function (v) {
      if (!v) return 'Bitte gib dein Geburtsdatum ein.';
      var d = new Date(v + 'T00:00:00'); if (isNaN(d)) return 'Das Datum ist nicht gültig.';
      var min = new Date(1920, 0, 1), max = heute(); max.setFullYear(max.getFullYear() - 16);
      if (d < min || d > max) return 'Bitte prüfe das Geburtsdatum. Du musst mindestens 16 Jahre alt sein.';
      return '';
    },
    handy: function (v) {
      if (!v) return 'Bitte gib deine Handynummer ein.';
      if (!/^[+0-9 ()\/-]+$/.test(v)) return 'Bitte gib eine Handynummer nur mit Ziffern ein, zum Beispiel +49 171 1234567.';
      var n = v.replace(/\D/g, ''); return n.length < 7 || n.length > 15 ? 'Die Handynummer hat zu wenige oder zu viele Ziffern.' : '';
    },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Bitte gib eine gültige E-Mail-Adresse ein, zum Beispiel name@firma.de.'; }
  };

  function fehler(id, text) {
    var el = $(id), f = $('e-' + id);
    if (!el || !f) return;
    f.textContent = text || ''; if (text) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function pruefen(id) { var v = $(id).value.trim(); var t = regeln[id](v); fehler(id, t); return !t; }

  function zeigen(name) { $('ansicht-form').hidden = name !== 'form'; $('ansicht-profil').hidden = name !== 'profil'; window.scrollTo(0, 0); }

  function profilAnzeigen(p) {
    $('gruss').textContent = 'Hallo ' + p.vorname + '.';
    var zeilen = [['Name', p.vorname + ' ' + p.nachname], ['Firma', p.firma], ['Funktion', p.funktion],
      ['Geburtsdatum', datumDE(p.geburt)], ['Handynummer', p.handy], ['E-Mail', p.email]];
    var dl = $('daten'); dl.textContent = '';
    zeilen.forEach(function (z) {
      var d = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd');
      a.textContent = z[0]; b.textContent = z[1]; d.appendChild(a); d.appendChild(b); dl.appendChild(d);
    });
    $('meldung').textContent = '';
    zeigen('profil');
  }

  function formular(p) {
    FELDER.forEach(function (id) { $(id).value = p ? p[id] || '' : ''; fehler(id, ''); });
    $('zustimmung').checked = !!p; fehler('zustimmung', '');
    $('form-titel').textContent = p ? 'Angaben ändern' : 'Wer bist du?';
    $('abbrechen').hidden = !p;
    zeigen('form');
  }

  FELDER.forEach(function (id) {
    $(id).addEventListener('blur', function () { if ($(id).value !== '') pruefen(id); });
    $(id).addEventListener('input', function () { if ($(id).getAttribute('aria-invalid')) pruefen(id); });
  });

  $('zustimmung').addEventListener('change', function () { if ($('zustimmung').checked) fehler('zustimmung', ''); });

  $('profil-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var ok = true, erster = null;
    FELDER.forEach(function (id) { if (!pruefen(id)) { ok = false; erster = erster || $(id); } });
    if (!$('zustimmung').checked) { fehler('zustimmung', 'Bitte stimme der Speicherung deiner Angaben zu.'); ok = false; erster = erster || $('zustimmung'); } else fehler('zustimmung', '');
    if (!ok) { erster.focus(); return; }
    var p = {}; FELDER.forEach(function (id) { p[id] = $(id).value.trim(); });
    p.gespeichert = new Date().toISOString();
    if (!speichern(p)) { fehler('email', 'Die Angaben konnten auf diesem Gerät nicht gespeichert werden. Schließe den privaten Modus des Browsers und versuche es noch einmal.'); $('email').focus(); return; }
    profilAnzeigen(p);
  });

  $('bearbeiten').addEventListener('click', function () { formular(laden()); $('vorname').focus(); });
  $('abbrechen').addEventListener('click', function () { var p = laden(); if (p) profilAnzeigen(p); });
  $('loeschen').addEventListener('click', function () {
    if (!window.confirm('Alle deine Angaben auf diesem Gerät löschen?')) return;
    entfernen(); formular(null);
  });

  var vorhanden = laden();
  if (vorhanden) profilAnzeigen(vorhanden); else formular(null);
})();
