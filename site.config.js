/* Einzige Stelle zum Anpassen von Name, Preis und Bezahllink. */
window.SITE = {
  name: 'BauPilot',
  // PayPal-Zahlungslink (nach dem Bezahlen zurück auf danke.html leiten). Leer = "Verkauf startet in Kürze".
  paypalLink: '',
  // Preise in Euro pro Monat, zzgl. MwSt.: erster Nutzer (Chef-Konto) und jeder weitere Nutzer.
  priceFirst: 39.90,
  priceExtra: 9.90,
  maxUsers: 200,
  // false = Verkauf noch nicht online (Kaufknopf zeigt "startet in Kürze"). Erst auf true setzen, wenn alles in GOLIVE.md erledigt ist.
  shop: false
};
