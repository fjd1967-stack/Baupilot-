import { cfg } from './config.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = c => (c / 100).toFixed(2).replace('.', ',') + ' €';
export const preis = n => cfg.priceFirstCent + Math.max(0, n - 1) * cfg.priceExtraCent;

// Der Auftrag, den der Kunde annimmt. Die Annahme (Zeit, IP, Version) wird gespeichert.
// WICHTIG: Text vor dem Start vom Anwalt prüfen lassen (AGB, Widerruf, Datenschutz, Auftragsverarbeitung).
export function auftragHtml({ k, nutzer, datum }) {
  return `<!doctype html><html lang="de"><meta charset="utf-8"><title>Auftrag ${esc(cfg.appName)}</title>
<body style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#0f2238">
<h1>Auftrag ${esc(cfg.appName)}</h1>
<p>Datum: ${esc(datum)} · Fassung: ${esc(cfg.agbVersion)}</p>
<h2>Auftraggeber</h2>
<p>${esc(k.firma)}<br>${esc(k.strasse)}<br>${esc(k.plz)} ${esc(k.ort)}${k.ust_id ? '<br>USt-IdNr.: ' + esc(k.ust_id) : ''}</p>
<h2>Leistung</h2>
<p>Nutzung der App ${esc(cfg.appName)} als Abonnement, monatlich kündbar, für <b>${nutzer}</b> ${nutzer === 1 ? 'Nutzer' : 'Nutzer'}.</p>
<table style="border-collapse:collapse;width:100%">
<tr><td>1. Nutzer</td><td style="text-align:right">${eur(cfg.priceFirstCent)}</td></tr>
${nutzer > 1 ? `<tr><td>${nutzer - 1} weitere Nutzer je ${eur(cfg.priceExtraCent)}</td><td style="text-align:right">${eur((nutzer - 1) * cfg.priceExtraCent)}</td></tr>` : ''}
<tr><td><b>Summe pro Monat, netto</b></td><td style="text-align:right"><b>${eur(preis(nutzer))}</b></td></tr></table>
<p>Zuzüglich gesetzlicher Umsatzsteuer. Abrechnung monatlich im Voraus per SEPA-Lastschrift. Das Lastschriftmandat erteilt der Auftraggeber im nächsten Schritt direkt beim Zahlungsdienstleister. Die Rechnung kommt jeden Monat automatisch per E-Mail.</p>
<p>Es gelten die Allgemeinen Geschäftsbedingungen in der oben genannten Fassung.</p></body></html>`;
}
