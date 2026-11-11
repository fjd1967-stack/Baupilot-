import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
process.env.DB_FILE = ':memory:'; process.env.STRIPE_MOCK = '1'; process.env.BASE_URL = 'http://t'; process.env.KI_MOCK = '1';
const { handler } = await import('../src/server.js');
const { db, jetzt } = await import('../src/db.js');
const { hash } = await import('../src/crypto.js');
const srv = http.createServer(handler); await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
async function call(m, p, body, cookie) {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j };
}
db.prepare("INSERT INTO konto(id,status,firma,nutzer,erstellt) VALUES(1,'aktiv','Test Bau',3,?)").run(jetzt());
db.prepare("INSERT INTO nutzer(id,konto,name,kontakt,rolle,erstellt) VALUES(1,1,'Chef','c@x.de','chef',?)").run(jetzt());
db.prepare("INSERT INTO nutzer(id,konto,name,kontakt,rolle,erstellt) VALUES(2,1,'Arben','0171',?,?)").run('mitglied', jetzt());
for (const [t, n] of [['tc', 1], ['tm', 2]]) db.prepare('INSERT INTO sitzung(hash,nutzer,ablauf) VALUES(?,?,?)').run(hash(t), n, jetzt() + 1e9);
const C = 'sid=tc', M = 'sid=tm';

test('Neue Nutzer sprechen Deutsch, Sprache noch nicht bestätigt', async () => {
  const me = (await call('GET', '/api/me', null, M)).j;
  assert.equal(me.sprache, 'de'); assert.equal(me.spracheGesetzt, false); assert.equal(me.sprachen.sq, 'Shqip');
});
test('Nutzer wählt seine Sprache; ungültige Sprache wird abgelehnt', async () => {
  assert.equal((await call('POST', '/api/sprache', { sprache: 'klingonisch' }, M)).s, 400);
  assert.equal((await call('POST', '/api/sprache', { sprache: 'sq' }, M)).s, 200);
  const me = (await call('GET', '/api/me', null, M)).j; assert.equal(me.sprache, 'sq'); assert.equal(me.spracheGesetzt, true);
  assert.equal((await call('POST', '/api/sprache', { sprache: 'de' })).s, 401);
});
test('Chef legt Mitarbeiter mit Sprache an und ändert sie', async () => {
  const r = await call('POST', '/api/team', { name: 'Marek Nowak', kontakt: '0172 9912345', sprache: 'pl' }, C); assert.equal(r.s, 200);
  const t = (await call('GET', '/api/team', null, C)).j.nutzer; assert.equal(t.find(x => x.name === 'Marek Nowak').sprache, 'pl');
  assert.equal((await call('POST', '/api/team/aendern', { id: r.j.id, sprache: 'ro' }, C)).j.sprache, 'ro');
  assert.equal((await call('POST', '/api/team/aendern', { id: r.j.id, sprache: 'es' }, C)).j.sprache, 'es');
  assert.equal((await call('POST', '/api/team/aendern', { id: r.j.id, sprache: 'xx' }, C)).s, 400);
});
test('Übersetzen: Liste, Zählung, Zwischenspeicher, Grenzen', async () => {
  const a = await call('POST', '/api/uebersetzen', { texte: ['Zeitplan prüfen', '12', 'Zeitplan prüfen'], nach: 'sq' }, M);
  assert.equal(a.s, 200); assert.deepEqual(a.j.texte, ['[sq] Zeitplan prüfen', '12', '[sq] Zeitplan prüfen']);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM uebersetzung').get().c, 1, 'ein Text einmal gespeichert');
  assert.equal((await call('POST', '/api/uebersetzen', { texte: ['x'], nach: 'xx' }, M)).s, 400);
  assert.equal((await call('POST', '/api/uebersetzen', { texte: [], nach: 'de' }, M)).s, 400);
  assert.equal((await call('POST', '/api/uebersetzen', { texte: Array(41).fill('a'), nach: 'de' }, M)).s, 400);
  assert.equal((await call('POST', '/api/uebersetzen', { texte: ['Hallo'], nach: 'de' })).s, 401);
  const d = await call('POST', '/api/uebersetzen', { texte: ['Pune e mbaruar'], nach: 'de' }, M); assert.deepEqual(d.j.texte, ['[de] Pune e mbaruar']);
});
test('Gesperrtes Abo darf nicht übersetzen', async () => {
  db.prepare("UPDATE konto SET status='zahlung_offen'").run();
  assert.equal((await call('POST', '/api/uebersetzen', { texte: ['Hallo'], nach: 'sq' }, M)).s, 402);
  db.prepare("UPDATE konto SET status='aktiv'").run();
});
test.after(() => srv.close());
