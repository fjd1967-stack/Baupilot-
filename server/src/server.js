import http from 'node:http';
import { db, jetzt } from './db.js';
import { cfg } from './config.js';
import { zufall, hash } from './crypto.js';
import { sende } from './mail.js';
import { api, checkoutDaten, webhookPruefen } from './stripe.js';
import { auftragHtml, preis } from './auftrag.js';

const TAG = 864e5, MIN = 6e4;
const q = (sql, ...a) => db.prepare(sql).get(...a);
const alle = (sql, ...a) => db.prepare(sql).all(...a);
const lauf = (sql, ...a) => db.prepare(sql).run(...a);
const mailOk = s => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s);
const telOk = s => /^[+\d\s\/()-]+$/.test(s) && s.replace(/\D/g, '').length >= 7 && s.replace(/\D/g, '').length <= 15;
const norm = s => String(s || '').trim();
const kontakt = s => { s = norm(s); return s.includes('@') ? s.toLowerCase() : s.replace(/[^\d+]/g, ''); };

class Fehler extends Error { constructor(code, msg) { super(msg); this.code = code; } }

// einfache Begrenzung pro IP, schützt Login und Bestellung vor Missbrauch
const zaehler = new Map();
export function begrenze(schluessel, max, fenster) {
  const t = jetzt(), e = (zaehler.get(schluessel) || []).filter(x => t - x < fenster);
  if (e.length >= max) throw new Fehler(429, 'Zu viele Versuche. Bitte warte kurz.');
  e.push(t); zaehler.set(schluessel, e);
}
setInterval(() => { const t = jetzt(); for (const [k, v] of zaehler) if (!v.some(x => t - x < 15 * MIN)) zaehler.delete(k); }, 5 * MIN).unref();

const cookie = (n, v, sek) => `${n}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sek}${cfg.secureCookie ? '; Secure' : ''}`;
function sitzungNeu(nutzerId) {
  const t = zufall(); lauf('INSERT INTO sitzung(hash,nutzer,ablauf) VALUES(?,?,?)', hash(t), nutzerId, jetzt() + 30 * TAG); return t;
}
function wer(req) {
  const t = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '')?.[1]; if (!t) return null;
  const s = q('SELECT nutzer FROM sitzung WHERE hash=? AND ablauf>?', hash(t), jetzt()); if (!s) return null;
  return q('SELECT n.*, k.status, k.nutzer AS gebucht, k.firma FROM nutzer n JOIN konto k ON k.id=n.konto WHERE n.id=?', s.nutzer);
}
const braucheAnmeldung = req => { const u = wer(req); if (!u) throw new Fehler(401, 'Bitte anmelden.'); return u; };
const braucheChef = req => { const u = braucheAnmeldung(req); if (u.rolle !== 'chef') throw new Fehler(403, 'Nur der Chef darf das.'); return u; };
const braucheAktiv = u => { if (u.status !== 'aktiv') throw new Fehler(402, 'Das Abo ist nicht aktiv.'); };

function linkMail(nutzerId, art, minuten) {
  const t = zufall(); lauf('INSERT INTO token(hash,art,nutzer,ablauf) VALUES(?,?,?,?)', hash(t), art, nutzerId, jetzt() + minuten * MIN); return t;
}
function nimmToken(t, art) {
  const r = q('SELECT * FROM token WHERE hash=? AND art=? AND ablauf>? AND benutzt IS NULL', hash(t || ''), art, jetzt());
  if (!r) throw new Fehler(400, 'Der Link ist abgelaufen oder wurde schon benutzt.');
  lauf('UPDATE token SET benutzt=? WHERE hash=?', jetzt(), r.hash); return r;
}

async function loginMail(nutzerRow) {
  if (!nutzerRow.kontakt.includes('@')) return;
  const t = linkMail(nutzerRow.id, 'login', 15);
  await sende(nutzerRow.kontakt, `Anmeldung ${cfg.appName}`, `Hallo ${nutzerRow.name},\n\nmit diesem Link meldest du dich an (15 Minuten gültig, nur einmal nutzbar):\n${cfg.baseUrl}/api/login/verify?t=${t}\n\nWenn du das nicht warst, ignoriere diese Mail.`);
}
export async function einladen(konto, n) {
  const t = zufall();
  lauf('UPDATE nutzer SET einladung_hash=?, eingeladen=? WHERE id=?', hash(t), jetzt(), n.id);
  const chef = q("SELECT name FROM nutzer WHERE konto=? AND rolle='chef'", konto.id);
  const text = `Hallo ${n.name.split(' ')[0]},\n\n${chef.name} (${konto.firma}) hat dich zu ${cfg.appName} eingeladen.\nInstalliere die App hier auf deinem Handy:\n${cfg.baseUrl}/install.html?einladung=${t}\n`;
  if (n.kontakt.includes('@')) await sende(n.kontakt, `Einladung zu ${cfg.appName}`, text);
  return { link: `${cfg.baseUrl}/install.html?einladung=${t}`, text };
}

const routen = [];
const route = (m, p, f) => routen.push([m, p, f]);

route('GET', '/api/health', () => ({ ok: true, db: !!q('SELECT 1 AS x') }));

route('POST', '/api/auftrag', async (req, b, ip) => {
  begrenze('auftrag:' + ip, 5, 15 * MIN);
  const f = { firma: norm(b.firma), strasse: norm(b.strasse), plz: norm(b.plz), ort: norm(b.ort), ust: norm(b.ust).replace(/\s/g, '').toUpperCase(), name: norm(b.name), email: norm(b.email).toLowerCase() };
  const n = Math.floor(+b.nutzer);
  if (f.firma.length < 2 || f.strasse.length < 3 || !/^\d{5}$/.test(f.plz) || f.ort.length < 2 || f.name.length < 2) throw new Fehler(400, 'Bitte alle Pflichtfelder ausfüllen.');
  if (!mailOk(f.email)) throw new Fehler(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
  if (f.ust && !/^[A-Z]{2}[A-Z0-9]{8,12}$/.test(f.ust)) throw new Fehler(400, 'Die USt-IdNr. sieht nicht richtig aus.');
  if (!(n >= 1 && n <= cfg.maxUsers)) throw new Fehler(400, 'Ungültige Nutzerzahl.');
  if (b.agb !== true) throw new Fehler(400, 'Bitte den Auftrag und die AGB annehmen.');
  if (q("SELECT 1 FROM nutzer n JOIN konto k ON k.id=n.konto WHERE n.kontakt=? AND n.rolle='chef' AND k.status!='angebot'", f.email)) throw new Fehler(409, 'Für diese E-Mail gibt es schon ein Konto. Bitte melde dich an.');
  // alte, nie bezahlte Anfragen mit derselben Mail entfernen
  lauf("DELETE FROM konto WHERE status='angebot' AND id IN (SELECT konto FROM nutzer WHERE kontakt=? AND rolle='chef')", f.email);
  const kid = lauf('INSERT INTO konto(firma,strasse,plz,ort,ust_id,nutzer,erstellt) VALUES(?,?,?,?,?,?,?)', f.firma, f.strasse, f.plz, f.ort, f.ust || null, n, jetzt()).lastInsertRowid;
  lauf("INSERT INTO nutzer(konto,name,kontakt,rolle,erstellt) VALUES(?,?,?,'chef',?)", kid, f.name, f.email, jetzt());
  const k = q('SELECT * FROM konto WHERE id=?', kid);
  const datum = new Date().toLocaleDateString('de-DE');
  lauf('INSERT INTO auftrag(konto,version,nutzer,html,angenommen,ip,agent) VALUES(?,?,?,?,?,?,?)', kid, cfg.agbVersion, n, auftragHtml({ k, nutzer: n, datum }), jetzt(), ip, String(req.headers['user-agent'] || '').slice(0, 200));
  const s = await api('POST', '/v1/checkout/sessions', checkoutDaten({ konto: k, email: f.email }), 'checkout-' + kid + '-' + n);
  return { url: s.url, monatlichNetto: preis(n) };
});

route('POST', '/api/login', async (req, b, ip) => {
  begrenze('login:' + ip, 10, 15 * MIN);
  const e = norm(b.email).toLowerCase();
  if (mailOk(e)) { begrenze('loginmail:' + e, 3, 15 * MIN); const n = q("SELECT n.* FROM nutzer n JOIN konto k ON k.id=n.konto WHERE n.kontakt=? AND k.status!='angebot'", e); if (n) await loginMail(n); }
  return { ok: true }; // immer gleiche Antwort: verrät nicht, ob es das Konto gibt
});

route('GET', '/api/login/verify', (req, b, ip, url, res) => {
  const t = nimmToken(url.searchParams.get('t'), 'login');
  const s = sitzungNeu(t.nutzer);
  res.setHeader('Set-Cookie', cookie('sid', s, 30 * TAG / 1000));
  return { redirect: '/app.html' };
});

route('POST', '/api/logout', (req, b, ip, url, res) => {
  const t = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '')?.[1]; if (t) lauf('DELETE FROM sitzung WHERE hash=?', hash(t));
  res.setHeader('Set-Cookie', cookie('sid', '', 0)); return { ok: true };
});

route('GET', '/api/me', req => {
  const u = braucheAnmeldung(req);
  return { name: u.name, rolle: u.rolle, firma: u.firma, status: u.status, gebucht: u.gebucht, angelegt: q('SELECT COUNT(*) c FROM nutzer WHERE konto=?', u.konto).c };
});

route('GET', '/api/team', req => {
  const u = braucheChef(req);
  return { gebucht: u.gebucht, nutzer: alle('SELECT id,name,kontakt,rolle,eingeladen,angenommen FROM nutzer WHERE konto=? ORDER BY id', u.konto) };
});

route('POST', '/api/team', async (req, b) => {
  const u = braucheChef(req); braucheAktiv(u);
  const name = norm(b.name), kon = kontakt(b.kontakt);
  if (name.length < 2) throw new Fehler(400, 'Bitte den Namen angeben.');
  if (!(mailOk(kon) || telOk(kon))) throw new Fehler(400, 'Bitte Handynummer oder E-Mail angeben.');
  if (q('SELECT COUNT(*) c FROM nutzer WHERE konto=?', u.konto).c >= u.gebucht) throw new Fehler(409, 'Alle gebuchten Nutzer sind angelegt. Bitte buche weitere Nutzer.');
  if (q('SELECT 1 FROM nutzer WHERE konto=? AND kontakt=?', u.konto, kon)) throw new Fehler(409, 'Diesen Nutzer gibt es schon.');
  const id = lauf("INSERT INTO nutzer(konto,name,kontakt,rolle,erstellt) VALUES(?,?,?,'mitglied',?)", u.konto, name, kon, jetzt()).lastInsertRowid;
  const e = await einladen(q('SELECT * FROM konto WHERE id=?', u.konto), q('SELECT * FROM nutzer WHERE id=?', id));
  return { id, einladung: e };
});

route('POST', '/api/team/einladen', async (req, b) => {
  const u = braucheChef(req); braucheAktiv(u);
  const n = q("SELECT * FROM nutzer WHERE id=? AND konto=? AND rolle='mitglied'", +b.id, u.konto); if (!n) throw new Fehler(404, 'Nutzer nicht gefunden.');
  begrenze('einl:' + n.id, 5, 60 * MIN);
  return { einladung: await einladen(q('SELECT * FROM konto WHERE id=?', u.konto), n) };
});

route('DELETE', '/api/team', (req, b) => {
  const u = braucheChef(req);
  const r = lauf("DELETE FROM nutzer WHERE id=? AND konto=? AND rolle='mitglied'", +b.id, u.konto); if (!r.changes) throw new Fehler(404, 'Nutzer nicht gefunden.');
  return { ok: true };
});

route('GET', '/api/einladung', (req, b, ip, url, res) => {
  begrenze('einladung:' + ip, 20, 15 * MIN);
  const h = hash(url.searchParams.get('t') || '');
  const n = q('SELECT n.id, k.status FROM nutzer n JOIN konto k ON k.id=n.konto WHERE n.einladung_hash=? AND n.eingeladen>?', h, jetzt() - 14 * TAG);
  if (!n || n.status !== 'aktiv') throw new Fehler(400, 'Die Einladung ist abgelaufen oder ungültig.');
  lauf('UPDATE nutzer SET angenommen=COALESCE(angenommen,?) WHERE id=?', jetzt(), n.id);
  res.setHeader('Set-Cookie', cookie('sid', sitzungNeu(n.id), 30 * TAG / 1000));
  return { redirect: '/app.html' };
});

route('POST', '/api/abo/nutzer', async (req, b) => {
  const u = braucheChef(req); braucheAktiv(u);
  const n = Math.floor(+b.nutzer), k = q('SELECT * FROM konto WHERE id=?', u.konto);
  if (!(n >= 1 && n <= cfg.maxUsers)) throw new Fehler(400, 'Ungültige Nutzerzahl.');
  if (n < q('SELECT COUNT(*) c FROM nutzer WHERE konto=?', u.konto).c) throw new Fehler(409, 'Es sind mehr Nutzer angelegt. Bitte entferne zuerst Nutzer.');
  if (n > 1 && !k.item_extra) await api('POST', '/v1/subscription_items', { subscription: k.stripe_abo, quantity: n - 1, proration_behavior: 'create_prorations',
    price_data: { currency: 'eur', unit_amount: cfg.priceExtraCent, tax_behavior: 'exclusive', recurring: { interval: 'month' }, product_data: { name: `${cfg.appName}, weiterer Nutzer` } } }).then(i => lauf('UPDATE konto SET item_extra=? WHERE id=?', i.id, k.id));
  else if (k.item_extra) await api('POST', '/v1/subscription_items/' + k.item_extra, { quantity: n - 1, proration_behavior: 'create_prorations' });
  lauf('UPDATE konto SET nutzer=? WHERE id=?', n, k.id);
  return { gebucht: n, monatlichNetto: preis(n) };
});

route('GET', '/api/auftrag/dokument', req => {
  const u = braucheChef(req);
  const a = q('SELECT html FROM auftrag WHERE konto=? ORDER BY id DESC LIMIT 1', u.konto);
  return { html: a?.html || '' };
});

// ---- Stripe Webhook (rohe Daten werden für die Signaturprüfung gebraucht)
export async function webhook(roh, kopf) {
  if (!webhookPruefen(roh, kopf)) throw new Fehler(400, 'Signatur ungültig.');
  const ev = JSON.parse(roh);
  if (lauf('INSERT OR IGNORE INTO ereignis(id,art,zeit) VALUES(?,?,?)', ev.id, ev.type, jetzt()).changes === 0) return { ok: true, doppelt: true };
  const o = ev.data.object;
  try {
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') {
      const k = q('SELECT * FROM konto WHERE id=?', +o.client_reference_id); if (!k) throw new Error('Konto unbekannt');
      let erst = null, extra = null;
      try { const s = await api('GET', '/v1/subscriptions/' + o.subscription); for (const i of s.items.data) (i.price.unit_amount === cfg.priceFirstCent && !erst ? (erst = i.id) : (extra = i.id)); } catch {}
      lauf("UPDATE konto SET status='aktiv', stripe_kunde=?, stripe_abo=?, item_erst=?, item_extra=? WHERE id=?", o.customer, o.subscription, erst, extra, k.id);
      await loginMail(q("SELECT * FROM nutzer WHERE konto=? AND rolle='chef'", k.id));
    } else if (ev.type === 'invoice.payment_failed') lauf("UPDATE konto SET status='zahlung_offen' WHERE stripe_abo=? AND status='aktiv'", o.subscription);
    else if (ev.type === 'invoice.paid') lauf("UPDATE konto SET status='aktiv' WHERE stripe_abo=? AND status='zahlung_offen'", o.subscription);
    else if (ev.type === 'customer.subscription.deleted') lauf("UPDATE konto SET status='gekuendigt' WHERE stripe_abo=?", o.id);
  } catch (e) { lauf('DELETE FROM ereignis WHERE id=?', ev.id); throw e; } // Stripe versucht es später erneut
  return { ok: true };
}

const kopfZeilen = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' };
const lesen = (req, max = 65536) => new Promise((ok, fail) => { let d = '', n = 0; req.on('data', c => { n += c.length; if (n > max) { fail(new Fehler(413, 'Zu groß')); req.destroy(); } else d += c; }); req.on('end', () => ok(d)); req.on('error', fail); });

export const handler = async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const url = new URL(req.url, 'http://x');
  for (const [k, v] of Object.entries(kopfZeilen)) res.setHeader(k, v);
  const senden = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'POST' && url.pathname === '/webhook/stripe') return senden(200, await webhook(await lesen(req, 1e6), req.headers['stripe-signature']));
    const r = routen.find(([m, p]) => m === req.method && p === url.pathname);
    if (!r) throw new Fehler(404, 'Nicht gefunden.');
    let b = {};
    if (req.method !== 'GET') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Fehler(415, 'JSON erwartet.');
      const o = req.headers.origin; if (o && o !== cfg.baseUrl) throw new Fehler(403, 'Fremde Herkunft.');
      try { b = JSON.parse((await lesen(req)) || '{}'); } catch { throw new Fehler(400, 'Ungültige Daten.'); }
    }
    const out = await r[2](req, b, ip, url, res);
    if (out?.redirect) { res.statusCode = 303; res.setHeader('Location', out.redirect); return res.end(); }
    senden(200, out);
  } catch (e) {
    if (e instanceof Fehler) return senden(e.code, { fehler: e.message });
    console.error(new Date().toISOString(), e); senden(500, { fehler: 'Interner Fehler. Bitte versuche es später noch einmal.' });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  http.createServer(handler).listen(cfg.port, process.env.BIND || '127.0.0.1', () => console.log('Server läuft auf Port', cfg.port));
}
