/* Handy-Vorschau im Hero: Sprache wechseln, ERLEDIGT antippen. Ohne Bibliotheken. */
(function () {
  var L = [
    { k: 'ro', n: 'Română', d: 'Rumänisch', t: 'Finalizați tăierile de beton în jurul bazinului' },
    { k: 'tr', n: 'Türkçe', d: 'Türkisch', t: 'Havuzun etrafındaki beton kesimlerini tamamlayın' },
    { k: 'pl', n: 'Polski', d: 'Polnisch', t: 'Dokończyć cięcia betonu wokół basenu' },
    { k: 'en', n: 'English', d: 'Englisch', t: 'Finish the concrete cuts around the pool' },
    { k: 'sq', n: 'Shqip', d: 'Albanisch', t: 'Përfundoni prerjet e betonit rreth pellgut' },
    { k: 'el', n: 'Ελληνικά', d: 'Griechisch', t: 'Ολοκληρώστε τις κοπές σκυροδέματος γύρω από την πισίνα' },
    { k: 'bg', n: 'Български', d: 'Bulgarisch', t: 'Завършете изрязването на бетона около басейна' }
  ];
  var screen = document.getElementById('screen'), chips = document.getElementById('chips');
  if (!screen || !chips) return;
  var box = document.getElementById('tr'), txt = document.getElementById('tr-text'),
      sp = document.getElementById('tr-sprache'), satz = document.getElementById('tr-satz'),
      btn = document.getElementById('erledigt'), chat = document.getElementById('view-chat'),
      task = document.getElementById('view-task'), again = document.getElementById('nochmal'), zeit = document.getElementById('zeit');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, timer = null, buttons = [];

  L.forEach(function (l, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = l.n; b.lang = l.k;
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () { stop(); show(i, true); });
    chips.appendChild(b); buttons.push(b);
  });

  function show(i, animate) {
    cur = i;
    buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    function set() { txt.lang = L[i].k; sp.textContent = L[i].d; satz.textContent = L[i].t; box.classList.remove('wechsel'); }
    if (animate && !reduce) { box.classList.add('wechsel'); setTimeout(set, 160); } else set();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Die eine Bewegung: einmal durch alle Sprachen, dann Ruhe. Nicht bei reduzierter Bewegung.
  if (!reduce) {
    var step = 0;
    setTimeout(function () {
      timer = setInterval(function () {
        step++;
        if (step >= L.length) { stop(); show(0, true); return; }
        show(step, true);
      }, 1400);
    }, 1200);
  }

  btn.addEventListener('click', function () {
    stop();
    screen.classList.add('tippt');
    setTimeout(function () {
      screen.classList.add('fertig');
      task.setAttribute('aria-hidden', 'true'); chat.removeAttribute('aria-hidden'); again.tabIndex = 0; again.focus({ preventScroll: true });
    }, reduce ? 0 : 280);
  });
  again.addEventListener('click', function () {
    screen.classList.remove('fertig', 'tippt');
    chat.setAttribute('aria-hidden', 'true'); task.removeAttribute('aria-hidden'); again.tabIndex = -1;
    show(0, false); btn.focus({ preventScroll: true });
  });
})();
