// Aufruf: node server/src/firma-setzen.js <Konto-ID oder Firmenname> <Feld> <Wert>
// Beispiel: node server/src/firma-setzen.js "AWR" belegvorlage awr   (Wert leer = Feld entfernen)
import { db } from './db.js';
const [suche, feld, wert = ''] = process.argv.slice(2);
if (!suche || !feld) { console.error('Aufruf: node firma-setzen.js <Konto-ID|Firmenname> <Feld> [Wert]'); process.exit(1); }
const erlaubt = ['belegvorlage'];
if (!erlaubt.includes(feld)) { console.error('Feld nicht erlaubt: ' + feld + ' (erlaubt: ' + erlaubt.join(', ') + ')'); process.exit(1); }
const k = /^\d+$/.test(suche) ? db.prepare('SELECT id,firma,firmendaten FROM konto WHERE id=?').all(+suche) : db.prepare('SELECT id,firma,firmendaten FROM konto WHERE firma LIKE ?').all('%' + suche + '%');
if (k.length !== 1) { console.error(k.length ? 'Mehrere Treffer: ' + k.map(x => x.id + ' ' + x.firma).join('; ') : 'Kein Konto gefunden.'); process.exit(1); }
const f = JSON.parse(k[0].firmendaten || '{}'); if (wert) f[feld] = wert; else delete f[feld];
db.prepare('UPDATE konto SET firmendaten=? WHERE id=?').run(JSON.stringify(f), k[0].id);
console.log('Konto ' + k[0].id + ' (' + k[0].firma + '): ' + feld + ' = ' + (wert || '(entfernt)'));
