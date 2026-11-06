#!/usr/bin/env bash
# Tägliches Backup: konsistente Kopie der Datenbank, verschlüsselt, an einen zweiten Ort.
# Aufruf per Cron: 17 3 * * * /opt/bau/server/deploy/backup.sh >> /var/log/bau-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
: "${BACKUP_ZIEL:?z. B. u123456@u123456.your-storagebox.de:bau-backups}"
: "${BACKUP_PASSPHRASE_DATEI:?Datei mit Passwort, nur root lesbar}"
tag=$(date +%F_%H%M)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
docker compose exec -T app node --disable-warning=ExperimentalWarning -e "
const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/data/app.db');d.exec(\"VACUUM INTO '/tmp/backup.db'\")"
docker compose cp app:/tmp/backup.db "$tmp/app.db"
sqlite_ok=$(python3 - "$tmp/app.db" <<'PY'
import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute("pragma integrity_check").fetchone()[0])
PY
)
[ "$sqlite_ok" = "ok" ] || { echo "Backup defekt: $sqlite_ok"; exit 1; }
openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:"$BACKUP_PASSPHRASE_DATEI" -in "$tmp/app.db" -out "$tmp/app-$tag.db.enc"
scp -q -P 23 "$tmp/app-$tag.db.enc" "$BACKUP_ZIEL/"
# Alte Backups (älter als 30 Tage) auf dem Ziel löschen:
ssh -p 23 "${BACKUP_ZIEL%%:*}" "find ${BACKUP_ZIEL#*:} -name 'app-*.enc' -mtime +30 -delete" || true
echo "Backup ok: $tag"
