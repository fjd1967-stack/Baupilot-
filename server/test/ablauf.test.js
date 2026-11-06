import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
process.env.DB_FILE = ':memory:'; process.env.STRIPE_MOCK = '1'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'; process.env.BASE_URL = 'http://t';
const { handler } = await import('../src/server.js');
const { hmac } = await import('../src/crypto.js');
const { db } = await import('../src/db.js');
const { checkoutDaten, webhookPruefen, formular } = await import('../src/stripe.js');

const srv = http.createServer(handler); await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
async function call(m, p, body, cookie, extra = {}) {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j, h: r.headers, t };
}
function hook(ev, secret = 'whsec_test') {
  const roh = JSON.stringify(ev), t = Math.floor(Date.now() / 1000);
  return fetch(`http://127.0.0.1:${port}/webhook/stripe`, { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${hmac(secret, t + '.' + roh)}` }, body: roh });
}
const bestell = { firma: 'Dieterle Bau', strasse: 'Hauptstr. 1', plz: '77761', ort: 'Schiltach', name: 'Frank Dieterle', email: 'Chef@Bau.de', nutzer: 5, agb: true };
let cookie;

test('Preis und Stripe-Positionen: 39,90 + 4 x 9,90', () => {
  const d = checkoutDaten({ konto: { id: 1, nutzer: 5 }, email: 'a@b.de' });
  assert.equal(d.line_items.length, 2);
  assert.equal(d.line_items[0].price_data.unit_amount, 3990);
  assert.equal(d.line_items[1].price_data.unit_amount, 990); assert.equal(d.line_items[1].quantity, 4);
  assert.deepEqual(d.payment_method_types, ['sepa_debit']);
  assert.ok(formular(d).includes('line_items%5B1%5D%5Bquantity%5D=4'));
  assert.equal(checkoutDaten({ konto: { id: 1, nutzer: 1 }, email: 'a@b.de' }).line_items.length, 1);
});

test('Webhook-Signatur: falsch, alt und richtig', () => {
  const roh = '{}', t = 1000, s = hmac('geheim', t + '.' + roh);
  assert.equal(webhookPruefen(roh, `t=${t},v1=${s}`, 'geheim', 1000), true);
  assert.equal(webhookPruefen(roh, `t=${t},v1=${s}`, 'anders', 1000), false);
  assert.equal(webhookPruefen(roh, `t=${t},v1=${s}`, 'geheim', 2000), false);
  assert.equal(webhookPruefen(roh, null, 'geheim', 1000), false);
});

test('Bestellung braucht Annahme und gültige Daten', async () => {
  assert.equal((await call('POST', '/api/auftrag', { ...bestell, agb: false })).s, 400);
  assert.equal((await call('POST', '/api/auftrag', { ...bestell, plz: '12' })).s, 400);
  assert.equal((await call('POST', '/api/auftrag', { ...bestell, nutzer: 0 })).s, 400);
  assert.equal((await call('POST', '/api/auftrag', bestell, null, { 'Content-Type': 'text/plain' })).s, 415);
  assert.equal((await call('POST', '/api/auftrag', bestell, null, { Origin: 'http://boese.de' })).s, 403);
});

test('Bestellung legt Konto im Status "angebot" an, noch kein Zugang', async () => {
  const r = await call('POST', '/api/auftrag', bestell);
  assert.equal(r.s, 200); assert.ok(r.j.url.startsWith('https://checkout')); assert.equal(r.j.monatlichNetto, 7950);
  assert.equal(db.prepare('SELECT status FROM konto').get().status, 'angebot');
  assert.ok(db.prepare('SELECT html FROM auftrag').get().html.includes('79,50'));
  await call('POST', '/api/login', { email: 'chef@bau.de' });
  assert.equal(db.prepare('SELECT COUNT(*) c FROM postausgang').get().c, 0, 'ohne Zahlung keine Login-Mail');
});

test('Webhook mit falscher Signatur wird abgelehnt', async () => {
  assert.equal((await hook({ id: 'e0', type: 'x', data: { object: {} } }, 'falsch')).status, 400);
});

test('Zahlung abgeschlossen: Konto aktiv und Login-Mail', async () => {
  const ev = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { mode: 'subscription', client_reference_id: '1', customer: 'cus_1', subscription: 'sub_1' } } };
  assert.equal((await hook(ev)).status, 200);
  assert.equal(db.prepare('SELECT status FROM konto').get().status, 'aktiv');
  const doppelt = await (await hook(ev)).json(); assert.equal(doppelt.doppelt, true);
  const m = db.prepare('SELECT * FROM postausgang').get(); assert.equal(m.an, 'chef@bau.de');
  const link = /verify\?t=([\w-]+)/.exec(m.text)[1];
  const v = await call('GET', '/api/login/verify?t=' + link);
  assert.equal(v.s, 303); cookie = v.h.get('set-cookie').split(';')[0];
  assert.equal((await call('GET', '/api/login/verify?t=' + link)).s, 400, 'Link nur einmal nutzbar');
});

test('Chef sieht Team, Mitglied wird angelegt und eingeladen, Limit gilt', async () => {
  assert.equal((await call('GET', '/api/team')).s, 401);
  assert.equal((await call('GET', '/api/me', null, cookie)).j.gebucht, 5);
  for (const [n, k] of [['Ali Yilmaz', '0171 2345678'], ['Max Muster', 'max@bau.de'], ['Eva', 'eva@bau.de'], ['Tom Klein', 'tom@bau.de']]) {
    const r = await call('POST', '/api/team', { name: n, kontakt: k }, cookie); assert.equal(r.s, 200, n);
    assert.match(r.j.einladung.link, /install\.html\?einladung=/);
  }
  const zuviel = await call('POST', '/api/team', { name: 'Zu Viel', kontakt: 'x@bau.de' }, cookie); assert.equal(zuviel.s, 409);
  assert.equal((await call('POST', '/api/team', { name: 'Ali Y', kontakt: '01712345678' }, cookie)).s, 409);
});

test('Eingeladener kommt mit dem Link rein, ist aber kein Chef', async () => {
  const r = await call('POST', '/api/team/einladen', { id: 2 }, cookie);
  const t = /einladung=([\w-]+)/.exec(r.j.einladung.link)[1];
  const e = await call('GET', '/api/einladung?t=' + t); assert.equal(e.s, 303);
  const c2 = e.h.get('set-cookie').split(';')[0];
  assert.equal((await call('GET', '/api/me', null, c2)).j.rolle, 'mitglied');
  assert.equal((await call('GET', '/api/team', null, c2)).s, 403);
  assert.equal((await call('GET', '/api/einladung?t=quatsch')).s, 400);
});

test('Nutzerzahl ändern: nicht unter angelegte, sonst mit Stripe-Update', async () => {
  assert.equal((await call('POST', '/api/abo/nutzer', { nutzer: 3 }, cookie)).s, 409);
  const r = await call('POST', '/api/abo/nutzer', { nutzer: 8 }, cookie); assert.equal(r.s, 200); assert.equal(r.j.monatlichNetto, 3990 + 7 * 990);
  assert.equal((await call('GET', '/api/me', null, cookie)).j.gebucht, 8);
});

test('Zahlung scheitert: Konto gesperrt, nach Zahlung wieder frei', async () => {
  await hook({ id: 'evt_2', type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } });
  assert.equal(db.prepare('SELECT status FROM konto').get().status, 'zahlung_offen');
  assert.equal((await call('POST', '/api/team', { name: 'Neu Er', kontakt: 'neu@bau.de' }, cookie)).s, 402);
  await hook({ id: 'evt_3', type: 'invoice.paid', data: { object: { subscription: 'sub_1' } } });
  assert.equal(db.prepare('SELECT status FROM konto').get().status, 'aktiv');
  await hook({ id: 'evt_4', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } });
  assert.equal(db.prepare('SELECT status FROM konto').get().status, 'gekuendigt');
});

test('Login verrät nicht, ob es ein Konto gibt; Rate-Limit greift', async () => {
  const a = await call('POST', '/api/login', { email: 'gibtsnicht@x.de' }); assert.deepEqual(a.j, { ok: true });
  let s; for (let i = 0; i < 12; i++) s = (await call('POST', '/api/login', { email: 'x' + i + '@x.de' })).s;
  assert.equal(s, 429);
});

test('Abmelden macht Sitzung ungültig; Auftrag gehört nur dem Chef', async () => {
  assert.ok((await call('GET', '/api/auftrag/dokument', null, cookie)).j.html.includes('Auftrag'));
  await call('POST', '/api/logout', {}, cookie);
  assert.equal((await call('GET', '/api/me', null, cookie)).s, 401);
});

test('Sicherheitskopfzeilen gesetzt', async () => {
  const r = await call('GET', '/api/health'); assert.equal(r.h.get('x-content-type-options'), 'nosniff'); assert.equal(r.j.ok, true);
});
test.after(() => srv.close());
