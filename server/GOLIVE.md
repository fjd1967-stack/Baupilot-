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
- 13 automatische Tests (`cd server && npm test`)

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
7. **Markenprüfung** für den Namen (OrdoBau) vor dem Umbenennen.
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
