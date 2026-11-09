#!/bin/sh
# Lädt die Bibliotheken der Baustellen-App einmal vom Paketdienst und legt sie unter lib/ ab (läuft auf dem Server/Build, braucht Internet).
# Danach: python3 tools/portiere.py tools/artifact-quelle.html bau.html --lokal
set -e
cd "$(dirname "$0")/.."; T=$(mktemp -d); mkdir -p lib/pdfjs lib/tesseract/core lib/tesseract/deu
cd "$T"
for p in pdfjs-dist@3.11.174 jspdf@2.5.1 jszip@3.10.1 pdf-lib@1.17.1 qrcodejs@1.0.0 tesseract.js@5.0.5 tesseract.js-core@5.0.0 @tesseract.js-data/deu@4.0.0; do npm pack "$p" --silent >/dev/null; done
for f in *.tgz; do mkdir -p "x_${f%.tgz}" && tar xzf "$f" -C "x_${f%.tgz}"; done
R="$OLDPWD"; cd "$R"
cp "$T"/x_pdfjs-dist*/package/build/pdf.min.js "$T"/x_pdfjs-dist*/package/build/pdf.worker.min.js lib/pdfjs/
cp "$T"/x_jspdf*/package/dist/jspdf.umd.min.js "$T"/x_jszip*/package/dist/jszip.min.js "$T"/x_pdf-lib*/package/dist/pdf-lib.min.js lib/
cp "$T"/x_qrcodejs*/package/qrcode.min.js lib/ 2>/dev/null || cp "$T"/x_qrcodejs*/package/qrcode.js lib/qrcode.min.js
cp "$T"/x_tesseract.js-5*/package/dist/tesseract.min.js "$T"/x_tesseract.js-5*/package/dist/worker.min.js lib/tesseract/
cp "$T"/x_tesseract.js-core*/package/*.js "$T"/x_tesseract.js-core*/package/*.wasm lib/tesseract/core/ 2>/dev/null || true
cp "$T"/x_@tesseract*/package/4.0.0_best_int/deu.traineddata.gz lib/tesseract/deu/ 2>/dev/null || true
echo "Bibliotheken liegen unter lib/. Jetzt portiere.py mit --lokal ausführen."
