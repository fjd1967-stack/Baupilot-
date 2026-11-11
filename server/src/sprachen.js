// Sprachen der App. Neue Sprache = eine Zeile hier + eine Zeile in /sprachen.js (und optional Wörter in /woerter.js).
// nativ = Name in der Sprache selbst, de = Name auf Deutsch, en = Name englisch (für die KI), sr = Sprachcode für Spracheingabe
export const SPRACHEN = {
  de: { nativ: 'Deutsch', de: 'Deutsch', en: 'German', sr: 'de-DE' },
  sq: { nativ: 'Shqip', de: 'Albanisch', en: 'Albanian', sr: 'sq-AL' },
  ro: { nativ: 'Română', de: 'Rumänisch', en: 'Romanian', sr: 'ro-RO' },
  tr: { nativ: 'Türkçe', de: 'Türkisch', en: 'Turkish', sr: 'tr-TR' },
  pl: { nativ: 'Polski', de: 'Polnisch', en: 'Polish', sr: 'pl-PL' },
  en: { nativ: 'English', de: 'Englisch', en: 'English', sr: 'en-GB' },
  el: { nativ: 'Ελληνικά', de: 'Griechisch', en: 'Greek', sr: 'el-GR' },
  bg: { nativ: 'Български', de: 'Bulgarisch', en: 'Bulgarian', sr: 'bg-BG' },
  es: { nativ: 'Español', de: 'Spanisch', en: 'Spanish', sr: 'es-ES' }
};
export const sprache = s => (SPRACHEN[s] ? s : 'de');
