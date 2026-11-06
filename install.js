/*!
 * App-Installationsknopf (iPhone + Android), ohne Abhängigkeiten.
 * Einbinden:  <script src="install.js" defer></script>
 * Knopf:      <button data-install>App installieren</button>   (beliebig viele)
 * Optionen:   <script src="install.js" data-app-name="BauPilot" data-color="#c2410c" defer></script>
 *
 * Verhalten:
 *  - Android/Chrome/Edge: echter Installationsdialog per Knopfdruck.
 *  - iPhone/iPad: Schritt-für-Schritt-Anleitung (Apple erlaubt keinen Direktbefehl).
 *  - In-App-Browser (WhatsApp, Claude, Facebook ...): Hinweis „In Safari/Chrome öffnen“ + Link kopieren.
 *  - Schon installiert: Knöpfe werden ausgeblendet.
 */
(function () {
  'use strict';
  var script = document.currentScript || {};
  var cfg = {
    name: (script.getAttribute && script.getAttribute('data-app-name')) || document.title || 'App',
    color: (script.getAttribute && script.getAttribute('data-color')) || '#c2410c'
  };

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  // iOS-Webviews (Claude-App, WhatsApp, Mail ...) haben kein "Safari/" im User-Agent
  var inApp = (isIOS && !/Safari\//.test(ua)) ||
    /FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|; wv\)|GSA\//i.test(ua);
  var deferred = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var shareIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

  function css() {
    if (document.getElementById('inst-css')) return;
    var s = document.createElement('style'); s.id = 'inst-css';
    s.textContent =
      '.inst-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:flex-end;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
      '.inst-sh{background:#fff;color:#111;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:20px 20px calc(24px + env(safe-area-inset-bottom,0px));box-sizing:border-box;max-height:92vh;overflow:auto}' +
      '.inst-sh h2{margin:0 0 4px;font-size:20px}.inst-sh p{margin:0 0 14px;color:#555;font-size:15px;line-height:1.4}' +
      '.inst-st{display:flex;gap:12px;align-items:center;padding:12px;border-radius:12px;background:#f4f4f5;margin-bottom:10px;font-size:17px;line-height:1.3}' +
      '.inst-n{flex:none;width:30px;height:30px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}' +
      '.inst-ic{display:inline-flex;vertical-align:middle;padding:2px 6px;border:1px solid #bbb;border-radius:6px;background:#fff}' +
      '.inst-bt{display:block;width:100%;border:0;border-radius:12px;padding:15px;font-size:17px;font-weight:600;color:#fff;margin-top:8px;cursor:pointer}' +
      '.inst-bt.sec{background:#e5e5e7;color:#111}' +
      '.inst-ar{text-align:center;font-size:34px;line-height:1;margin:8px 0 0;animation:inst-b 1s infinite}' +
      '@keyframes inst-b{50%{transform:translateY(8px)}}' +
      '@media (prefers-reduced-motion:reduce){.inst-ar{animation:none}}' +
      '@media (prefers-color-scheme:dark){.inst-sh{background:#1c1c1e;color:#f2f2f2}.inst-sh p{color:#aaa}.inst-st{background:#2c2c2e}.inst-ic{background:#1c1c1e;border-color:#555}.inst-bt.sec{background:#3a3a3c;color:#f2f2f2}}';
    document.head.appendChild(s);
  }

  function sheet(title, lead, stepsHtml, extra) {
    css();
    var ov = document.createElement('div'); ov.className = 'inst-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="inst-sh"><h2>' + title + '</h2><p>' + lead + '</p>' + stepsHtml + (extra || '') +
      '<button class="inst-bt sec" data-x>Schließen</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-x')) ov.remove(); });
    document.body.appendChild(ov);
    return ov;
  }
  function step(n, html) { return '<div class="inst-st"><span class="inst-n" style="background:' + cfg.color + '">' + n + '</span><span>' + html + '</span></div>'; }

  function copyLink(btn) {
    var url = location.href.split('#')[0];
    var done = function () { btn.textContent = 'Link kopiert ✓'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Link kopieren:', url); });
    else window.prompt('Link kopieren:', url);
  }

  function showInApp() {
    var browser = isIOS ? 'Safari' : 'Chrome';
    var ov = sheet('Zuerst im Browser öffnen',
      'Du bist gerade in einer App (z. B. WhatsApp oder Claude). Dort geht die Installation nicht.',
      step(1, 'Tippe unten auf <b>Link kopieren</b>.') +
      step(2, 'Öffne <b>' + browser + '</b> und füge den Link in die Adresszeile ein.') +
      step(3, 'Tippe dort auf <b>App installieren</b>.'),
      '<button class="inst-bt" style="background:' + cfg.color + '" data-copy>Link kopieren</button>');
    ov.querySelector('[data-copy]').addEventListener('click', function (e) { copyLink(e.target); });
  }

  function showIOS() {
    sheet(esc(cfg.name) + ' auf dem iPhone installieren', 'Das dauert 10 Sekunden. Apple verlangt diese drei Schritte.',
      step(1, 'Tippe unten in Safari auf das Teilen-Symbol <span class="inst-ic">' + shareIcon + '</span>') +
      step(2, 'Wische im Menü nach oben und wähle <b>Zum Home-Bildschirm</b>.') +
      step(3, 'Tippe oben rechts auf <b>Hinzufügen</b>.'),
      '<div class="inst-ar" aria-hidden="true">⬇</div>');
  }

  function showAndroidManual() {
    sheet(esc(cfg.name) + ' auf Android installieren', 'Mit Chrome geht es so:',
      step(1, 'Tippe oben rechts auf das Menü <b>⋮</b>.') +
      step(2, 'Wähle <b>App installieren</b> (oder <b>Zum Startbildschirm hinzufügen</b>).') +
      step(3, 'Bestätige mit <b>Installieren</b>.'));
  }

  function onClick(ev) {
    if (ev) ev.preventDefault();
    if (inApp) return showInApp();
    if (deferred) {
      var d = deferred; deferred = null;
      d.prompt();
      return d.userChoice.then(function () { refresh(); });
    }
    if (isIOS) return showIOS();
    if (isAndroid) return showAndroidManual();
    sheet(esc(cfg.name) + ' installieren', 'Öffne diese Seite auf deinem Handy, oder nutze in Chrome/Edge das Installieren-Symbol in der Adresszeile.', '');
  }

  var buttons = [];
  function refresh() {
    buttons.forEach(function (b) { b.hidden = standalone; });
  }
  function bind(root) {
    var list = (root || document).querySelectorAll('[data-install]');
    for (var i = 0; i < list.length; i++) {
      if (list[i].__inst) continue; list[i].__inst = true;
      list[i].addEventListener('click', onClick); buttons.push(list[i]);
    }
    refresh();
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { standalone = true; deferred = null; refresh(); });

  window.AppInstall = { open: onClick, bind: bind, isStandalone: function () { return standalone; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { bind(); });
  else bind();
})();
