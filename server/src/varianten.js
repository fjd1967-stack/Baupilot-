import { SPRACHEN } from './sprachen.js';
// Funktionsumfang der drei Varianten. Wird vom Server durchgesetzt und der App über /api/me geliefert.
export const FUNKTIONEN = {
  aufgaben: 'Aufgaben verteilen, Rückmeldung „erledigt“ per WhatsApp',
  belege: 'Belegesammlung',
  information: 'Baustelleninformationen lesen',
  arbeitseinteilung: 'Arbeitseinteilung',
  fotos: 'Fotos',
  bautagebuch: 'Bautagebuch',
  rapporte: 'Rapporte (Tagelohn)',
  aufmass: 'Aufmaßblätter',
  dokumente: 'Dokumente und Pläne',
  lv: 'Leistungsverzeichnis',
  nachtraege: 'Nachträge erstellen',
  bauzeitenplan: 'Bauzeitenplan',
  anfragen: 'Anfragen und Angebotsvergleiche',
  sicherung: 'Datensicherung, Baustellen abschließen',
  teamuebersicht: 'Übersicht über die Baustellenteams'
};
const basis = ['aufgaben', 'belege', 'information', 'arbeitseinteilung', 'fotos'];
const polier = [...basis, 'bautagebuch', 'rapporte', 'aufmass', 'dokumente'];
const bauleiter = [...polier, 'lv', 'nachtraege', 'bauzeitenplan', 'anfragen', 'sicherung', 'teamuebersicht'];
export const VARIANTEN = {
  vorarbeiter: { name: 'Vorarbeiter', funktionen: basis },
  polier: { name: 'Polier', funktionen: polier },
  bauleiter: { name: 'Bauleiter', funktionen: bauleiter }
};
export const variante = v => (VARIANTEN[v] ? v : 'polier');
export const darf = (u, funktion) => u.rolle === 'chef' || VARIANTEN[variante(u.variante)].funktionen.includes(funktion);
export const funktionenVon = u => (u.rolle === 'chef' ? Object.keys(FUNKTIONEN) : VARIANTEN[variante(u.variante)].funktionen);

// Einstellungen, die der KI-Assistent für einen Nutzer ändern darf (Allowlist, keine Programmänderung).
export const EINSTELLUNGEN = {
  schriftgroesse: v => ['normal', 'gross', 'sehr-gross'].includes(v),
  kontrast: v => ['normal', 'hoch'].includes(v),
  startseite: v => typeof v === 'string' && Object.keys(FUNKTIONEN).includes(v),
  ausblenden: v => Array.isArray(v) && v.length <= 20 && v.every(x => Object.keys(FUNKTIONEN).includes(x)),
  uebersetzung: v => Array.isArray(v) && v.length <= 8 && v.every(x => x !== 'de' && Object.keys(SPRACHEN).includes(x)),
  sprache: v => Object.keys(SPRACHEN).includes(v),
  standardtext: v => typeof v === 'string' && v.length <= 500
};

// Welcher Datenbereich gehört zu welcher Funktion? (Pfad der Sammlung, Platzhalter * = beliebige Baustelle)
const BEREICHE = [
  [/^projekte\/[^/]+\/(entries|wetter|fotos)$/, 'bautagebuch'], [/^projekte\/[^/]+\/protokolle$/, 'dokumente'],
  [/^projekte\/[^/]+\/dokumente$/, 'dokumente'], [/^projekte\/[^/]+\/lv$/, 'lv'], [/^projekte\/[^/]+\/nt$/, 'nachtraege'],
  [/^projekte\/[^/]+\/belege$/, 'belege'], [/^belege$/, 'belege'], [/^config\/belege$/, 'belege'],
  [/^(todos|bltodo)$/, 'aufgaben'], [/^infos$/, 'information'], [/^bestellungen$/, 'anfragen'],
  [/^(sicherungen|archiv|papierkorb)$/, 'sicherung']
];
export function bereichFunktion(koll) { for (const [re, f] of BEREICHE) if (re.test(koll)) return f; return null; } // null = für alle angemeldeten Nutzer
