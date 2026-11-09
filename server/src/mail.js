import { db, jetzt } from './db.js';
import { cfg } from './config.js';
import { smtpSenden } from './smtp.js';

// Jede Mail wird zuerst im Postausgang gespeichert. Ohne SMTP-Zugang bleibt sie dort (nützlich für Tests und Vorabnahme).
export async function sende(an, betreff, text) {
  const id = db.prepare('INSERT INTO postausgang(an,betreff,text,zeit) VALUES(?,?,?,?)').run(an, betreff, text, jetzt()).lastInsertRowid;
  if (!cfg.smtp.host) return false;
  try { await smtpSenden({ an, betreff, text }); db.prepare('UPDATE postausgang SET gesendet=? WHERE id=?').run(jetzt(), id); return true; }
  catch (e) { db.prepare('UPDATE postausgang SET fehler=? WHERE id=?').run(String(e.message), id); return false; }
}

// Mail mit Anhängen und Antwortadresse (für die App-Funktionen). Ohne SMTP bleibt sie im Postausgang.
export async function sendeMail({ an, cc = [], betreff, text, html = '', antwort = '', name = '', anh = [] }) {
  const id = db.prepare('INSERT INTO postausgang(an,betreff,text,zeit) VALUES(?,?,?,?)').run(an.join(','), betreff, text + (anh.length ? `\n[${anh.length} Anhang/Anhänge: ${anh.map(a => a.name).join(', ')}]` : ''), jetzt()).lastInsertRowid;
  if (!cfg.smtp.host) return true; // Vorabnahme: gespeichert, nicht versendet
  try { await smtpSenden({ an: an.join(','), cc, betreff, text, html, antwort, name, anh }); db.prepare('UPDATE postausgang SET gesendet=? WHERE id=?').run(jetzt(), id); return true; }
  catch (e) { db.prepare('UPDATE postausgang SET fehler=? WHERE id=?').run(String(e.message), id); return false; }
}
