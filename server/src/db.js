import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cfg } from './config.js';

if (cfg.dbFile !== ':memory:') mkdirSync(dirname(cfg.dbFile), { recursive: true });
export const db = new DatabaseSync(cfg.dbFile);
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS konto(
  id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'angebot', -- angebot|aktiv|zahlung_offen|gekuendigt
  firma TEXT, strasse TEXT, plz TEXT, ort TEXT, ust_id TEXT, nutzer INTEGER NOT NULL,
  stripe_kunde TEXT, stripe_abo TEXT, item_erst TEXT, item_extra TEXT, erstellt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS nutzer(
  id INTEGER PRIMARY KEY, konto INTEGER NOT NULL REFERENCES konto(id) ON DELETE CASCADE,
  name TEXT NOT NULL, kontakt TEXT NOT NULL, rolle TEXT NOT NULL DEFAULT 'mitglied', -- chef|mitglied
  einladung_hash TEXT, eingeladen INTEGER, angenommen INTEGER, erstellt INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS nutzer_kontakt ON nutzer(konto, kontakt);
CREATE TABLE IF NOT EXISTS auftrag(
  id INTEGER PRIMARY KEY, konto INTEGER NOT NULL REFERENCES konto(id), version TEXT NOT NULL, nutzer INTEGER NOT NULL,
  html TEXT NOT NULL, angenommen INTEGER NOT NULL, ip TEXT, agent TEXT);
CREATE TABLE IF NOT EXISTS token(
  hash TEXT PRIMARY KEY, art TEXT NOT NULL, nutzer INTEGER NOT NULL, ablauf INTEGER NOT NULL, benutzt INTEGER);
CREATE TABLE IF NOT EXISTS sitzung(
  hash TEXT PRIMARY KEY, nutzer INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE, ablauf INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ereignis(id TEXT PRIMARY KEY, art TEXT, zeit INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS postausgang(id INTEGER PRIMARY KEY, an TEXT, betreff TEXT, text TEXT, zeit INTEGER NOT NULL, gesendet INTEGER, fehler TEXT);
`);
// spätere Erweiterungen (Varianten, KI-Zusatz, Profil, Firmendaten, Nutzdaten)
const spalte = (t, c, d) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`); };
spalte('nutzer', 'variante', "TEXT NOT NULL DEFAULT 'polier'");
spalte('nutzer', 'ki', 'INTEGER NOT NULL DEFAULT 0');
spalte('nutzer', 'profil', "TEXT NOT NULL DEFAULT '{}'");
spalte('nutzer', 'einstellungen', "TEXT NOT NULL DEFAULT '{}'");
spalte('konto', 'firmendaten', "TEXT NOT NULL DEFAULT '{}'");
spalte('konto', 'ki_gebucht', 'INTEGER NOT NULL DEFAULT 0');
spalte('konto', 'item_ki', 'TEXT');
db.exec(`CREATE TABLE IF NOT EXISTS daten(nutzer INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE, schluessel TEXT NOT NULL, wert TEXT NOT NULL, geaendert INTEGER NOT NULL, PRIMARY KEY(nutzer,schluessel));
CREATE TABLE IF NOT EXISTS ki_log(id INTEGER PRIMARY KEY, nutzer INTEGER NOT NULL, wunsch TEXT, ergebnis TEXT, zeit INTEGER NOT NULL);`);
export const jetzt = () => Date.now();
