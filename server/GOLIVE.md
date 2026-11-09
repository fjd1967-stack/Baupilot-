# Go-Live-Liste

Der Verkauf ist abgeschaltet (`shop: false` in `site.config.js`). Erst wenn alles unten erledigt ist, auf `true` stellen.

## Was schon gebaut und getestet ist
- Bestellung mit Auftrag (Annahme wird mit Zeit, IP und AGB-Fassung gespeichert)
- Stripe-Abo: 39,90 € erster Nutzer plus 9,90 € je weiterer Nutzer, SEPA-Lastschrift, Umsatzsteuer automatisch, monatliche Rechnung per E-Mail durch Stripe
- Zugang erst nach erfolgreicher Anmeldung der Zahlung (Webhook mit Signaturprüfung)
- Anmeldung ohne Passwort (Link per E-Mail, 15 Minuten, einmal nutzbar)
- Nutzer anlegen, einladen, Limit nach gebuchter Zahl, Nutzerzahl später ändern
- Zahlung scheitert: Konto gesperrt, nach Zahlung wieder frei. Kündigung: Konto beendet.
- Absicherung: Firewall, Schlüssel-Login, automatische Updates, Fail2ban, HTTPS, Sicherheitskopfzeilen, Rate-Limits, verschlüsselte tägliche Backups an zweiten Ort
- Drei Varianten (Vorarbeiter, Polier, Bauleiter): Der Server erlaubt jedem Nutzer nur die Bereiche seiner Variante; der Chef legt Nutzer mit Variante an und ändert sie später (`/api/team/aendern`). Zuschnitt siehe `server/src/varianten.js`.
- Chef-Einblick: Der Chef liest Profil und Daten aller Mitarbeiter seines Kontos (`/api/team/einblick`), nur lesend.
- Firmendaten pro Konto (Chef schreibt, Mitarbeiter lesen) und persönliche Daten pro Nutzer (`/api/firma`, `/api/profil`): damit können mehrere Firmen die App nutzen. Die App gilt für alle Gewerke, nicht nur Abbruch.
- KI-Assistent als Zusatz pro Nutzer (Standard 14,90 € netto, **Preis noch von dir festzulegen**): im Auftrag, im Stripe-Abo und nachträglich buchbar (`/api/abo/ki`). Der Assistent darf nur erlaubte persönliche Einstellungen setzen (Schriftgröße, Kontrast, Startseite, Ausblenden, Übersetzungssprachen, Standardtext), kein Programm ändern. Braucht `ANTHROPIC_API_KEY` (eigene Kosten pro Anfrage; Rate-Limit 30 pro Stunde und Nutzer).
- 20 automatische Server-Tests (`cd server && npm test`)

## Baustellen-App (bau.html) – Stand 09.11.2026
- Die Original-App (Artifact) läuft jetzt auf dem eigenen Server: `tools/portiere.py` macht aus `tools/artifact-quelle.html` die Datei `bau.html`; `claude-shim.js` verbindet Datenbank, Dateien, Mail und KI mit dem Server (je Firma getrennt, je Variante begrenzt). Bei jeder neuen Artifact-Version neu portieren.
- Automatisch geprüft (`server/test/ui/bau-e2e.mjs`, 18 Prüfungen mit echtem Browser): Baustelle anlegen, Bautagebuch (speichern, nach Neuladen sichtbar), Aufgaben, Übersetzung, Information, Bestellungen, To-do-Liste, Arbeitseinteilung, Besprechungsprotokoll, Protokoll intern, Beleg, Anfrage, Schriftverkehr, Dokumente, Mail, Dateispeicher.
- **Noch NICHT geprüft (in der Testumgebung gesperrt oder braucht echte Konten):** PDF-/Excel-Erzeugung, Leistungsverzeichnis einlesen (Texterkennung), echte Übersetzung und Belegerkennung (braucht `ANTHROPIC_API_KEY`), echter Mailversand mit Anhang (braucht SMTP), Zusammenarbeit mehrerer Nutzer in Echtzeit.
- **Vor dem Start:** `tools/vendor.sh` auf dem Server ausführen und danach `python3 tools/portiere.py tools/artifact-quelle.html bau.html --lokal` (Bibliotheken vom eigenen Server statt von CDNs, Datenschutz). Dann PDF-Funktionen von Hand durchspielen.
- **Noch AWR-spezifisch (für andere Firmen anpassen):** Belegesammlung (AWR-Excel-Vorlage, Kontenschlüssel), Nachtrags-Sonderformat Uhlandquartier (greift nur bei Baustellen mit „Uhland“ im Namen). Firmenname, Adresse, Fußzeilen und Rückfrage-Text kommen aus den Firmendaten des Kontos.

## Noch nicht gegen echte Dienste geprüft (geht erst mit Konten)
- Stripe live (nur mit Test-Schlüsseln und Testkarte bzw. Test-IBAN prüfen)
- Mailversand über das echte Postfach
- Docker-Aufbau und Caddy auf dem echten Server
- Wiederherstellung aus einem Backup (einmal komplett durchspielen!)

## Nur du kannst das (Konten und Rechtliches)
1. **Stripe-Konto** anlegen und Firma verifizieren. Dann in den Einstellungen: Firmenname, Anschrift, USt-IdNr./Steuernummer, Rechnungs-Präfix, "Rechnungen per E-Mail senden", **Stripe Tax** aktivieren (Herkunftsadresse eintragen). Webhook auf `https://DOMAIN/webhook/stripe` mit den Ereignissen `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
2. **Hetzner-Konto**, Server mit `deploy/cloud-init.yml` anlegen (SSH-Schlüssel eintragen), Backups aktivieren. Dazu eine Storage Box für das zweite Backup.
3. **Domain** kaufen und auf den Server zeigen lassen (A-Eintrag).
4. **Absender-Postfach** (z. B. noreply@Domain) mit SPF, DKIM, DMARC. SMTP-Daten in `.env`.
5. **Impressum** ausfüllen (Straße, Gesellschafter, Telefon, E-Mail, USt-ID).
6. **Anwalt:** AGB, Datenschutzerklärung, Auftragsverarbeitungsvertrag für Kunden, Verträge mit Hetzner und Stripe (AV-Verträge werden dort online abgeschlossen).
7. **Preis des KI-Assistenten** festlegen (`PRICE_KI_CENT` und `priceKi` in `site.config.js`) und **Anthropic-API-Schlüssel** besorgen. Datenschutz: KI-Anfragen gehen an Anthropic, im AV-Vertrag/Datenschutz nennen.
7b. **Markenprüfung** für den Namen (OrdoBau) vor dem Umbenennen.
8. **Steuerberater:** Umsatzsteuer, Rechnungsangaben, E-Rechnung (siehe unten).

## Rechnungen und Steuer
- Stripe erstellt jeden Monat automatisch die Rechnung mit Umsatzsteuer und mailt sie. Rechnungsnummern laufen fortlaufend.
- **E-Rechnung:** Die PDF-Rechnungen von Stripe sind keine strukturierten E-Rechnungen (XRechnung/ZUGFeRD). Nach meinem Stand gelten Übergangsfristen bis Ende 2027, danach ist die E-Rechnung bei Rechnungen an Unternehmen Pflicht. **Bitte vom Steuerberater bestätigen lassen** und rechtzeitig ein Rechnungsprogramm anbinden, das die Daten aus Stripe übernimmt.
- **Steuermeldungen:** Umsatzsteuer-Voranmeldung über den Steuerberater oder ELSTER. Stripe liefert Berichte und Exporte für die Buchhaltung.
- Kunden mit USt-IdNr. aus dem EU-Ausland bekommen Rechnungen ohne deutsche Umsatzsteuer (Reverse-Charge), das übernimmt Stripe Tax, sofern es eingerichtet ist.

## Start auf dem Server (macht später Claude, sobald Zugang da ist)
```
git clone <repo> /opt/bau && cd /opt/bau/server/deploy
cp .env.example .env   # ausfüllen
docker compose up -d --build
```
Danach: Testbestellung mit Stripe-Testmodus, Testbackup und Wiederherstellung, Testausfall (Server neu starten), erst dann `shop: true`.
