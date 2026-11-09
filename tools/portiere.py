#!/usr/bin/env python3
"""Macht aus der gespeicherten Artifact-Fassung der Baustellen-App die Web-App bau.html.
Aufruf: python3 tools/portiere.py <artifact.html> <bau.html>
Wiederholbar: bei jeder neuen Artifact-Version erneut ausführen (die Ersetzungen sind fest hinterlegt)."""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
LOKAL = '--lokal' in sys.argv
s = open(src, encoding='utf-8').read()
n = {}
def ers(a, b, name, regex=False, soll=None):
    global s
    if regex: s2, c = re.subn(a, b, s)
    else: c = s.count(a); s2 = s.replace(a, b)
    n[name] = c
    if soll is not None and c < soll: print('WARNUNG: %s nur %d mal gefunden (erwartet %d)' % (name, c, soll))
    s = s2
# Schriften nicht von Google laden (Datenschutz); Systemschrift als Rückfall
ers('<link rel="preconnect" href="https://fonts.googleapis.com">\n', '', 'font1')
ers('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n', '', 'font2')
ers(re.escape('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap">')+'\n', '<link rel="stylesheet" href="schriften.css">\n', 'font3', True, 1)
# Brücke zur Laufzeit zuerst laden
ers('<body>', '<body>\n<script src="claude-shim.js"></script>', 'shim', soll=1)
# App-Adresse
ers("const APP_URL = 'https://claude.ai/artifact/DnKQtsFhyThiPab2mngM5q';", "const APP_URL = location.origin + '/bau.html';", 'appurl', soll=1)
# Firmendaten aus dem Konto statt fest verdrahtet
ers("const FI={name:'AWR Abbruch GmbH',strasse:'Am guten Mann 1',ort:'56218 Mülheim-Kärlich',tel:'0 26 30 / 96 26-0'};", "const FI={name:__F.name,strasse:__F.strasse,ort:(__F.plz+' '+__F.ort).trim(),tel:__F.tel};", 'FI', soll=1)
ers("name:'AWR Abbruch GmbH', strasse:'Am guten Mann 1', ort:'56218 Mülheim-Kärlich',\n  tel:'0 26 30 / 96 26-0', fax:'0 26 30 / 96 26 26'", "name:__F.name, strasse:__F.strasse, ort:(__F.plz+' '+__F.ort).trim(),\n  tel:__F.tel, fax:__F.fax", 'FIRMA', soll=1)
ers("'Rückfragen und Rückantwort bitte an Frank Dieterle, T: 01719908821, E-Mail: frankdieterle@awr-abbruch.de.'", '__RUECK', 'rueck', soll=2)
ers("Rückfragen und Rückantwort bitte an Frank Dieterle, T: 01719908821, E-Mail: frankdieterle@awr-abbruch.de.", "' + __RUECK + '", 'rueck2', soll=1)
ers('/Dieterle/.test(x.schluss||\'\')', "x.schluss.indexOf(__ME.name)>=0", 'dieterle', soll=1)
ers("'Frank Dieterle'", '__ME.name', 'name', soll=3)
ers("'AWR ABBRUCH GmbH'", '__F.name', 'kopf', soll=4)
ers("'www.awr-abbruch.de'", "(__F.web||'')", 'web', soll=3)
ers("'AWR ABBRUCH GMBH  •  Am Guten Mann 1  •  56218 Mülheim-Kärlich'", '__FUSS1', 'fuss1a')
ers("'AWR ABBRUCH GMBH  •  Rudolf-Diesel-Str. 25  •  56220 Urmitz'", '__FUSS1', 'fuss1b')
ers("'Tel. +49 26 30 / 96 26-0  •  Fax +49 26 30 / 96 26-26  •  info@awr-abbruch.de'", '__FUSS2', 'fuss2', soll=2)
ers("firma:'AWR Abbruch GmbH'", 'firma:__F.name', 'firma', soll=1)
ers("BauPilot – Bautagebuch und Baustellen-App von AWR", "BauPilot – Baustellen-App von ' + __F.name + '", 'share')
ers("if(!loadedEntries || !loadedProjects || !canWrite || !activeId) return;\n  const t = todayKey();", "if(!loadedEntries || !loadedProjects || !canWrite || !activeId || !(__ME.rolle==='chef'||__ME.funktionen.indexOf('bautagebuch')>=0)) return;\n  const t = todayKey();", 'ensure', soll=1)
# Funktionen je Variante: nicht freigeschaltete Rubriken ausblenden (der Server sperrt die Daten zusätzlich)
gate = """<script>(function(){var M={bt:'bautagebuch',bespr:'dokumente',intern:'dokumente',todo:'aufgaben',info:'information',ae:'arbeitseinteilung',order:'anfragen',bl:'aufgaben',doku:'dokumente',schrift:'dokumente',anfr:'anfragen',belege:'belege'};
function gate(){var f=(window.__ME&&__ME.funktionen)||[];document.querySelectorAll('#rubs [data-rub]').forEach(function(b){var k=M[b.dataset.rub];if(k&&f.indexOf(k)<0)b.style.display='none'})}
gate();new MutationObserver(gate).observe(document.getElementById('rubs')||document.body,{childList:true,subtree:true});
var h=document.querySelector('.brand');if(h&&window.__ME){var s=document.createElement('small');s.textContent=__ME.firma+' · '+__ME.name;h.appendChild(s)}})();</script>
"""
ers('<main class="wrap" id="main"></main>', gate + '<main class="wrap" id="main"></main>', 'gate', soll=1)
if LOKAL:  # Bibliotheken vom eigenen Server statt von CDNs (nach tools/vendor.sh)
    for a, b in [('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/', '/lib/pdfjs/'), ('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js', '/lib/tesseract/tesseract.min.js'),
                 ('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', '/lib/qrcode.min.js'), ('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', '/lib/pdf-lib.min.js'),
                 ('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', '/lib/jszip.min.js'), ('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', '/lib/jspdf.umd.min.js'),
                 ('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/worker.min.js', '/lib/tesseract/worker.min.js'), ('https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0', '/lib/tesseract/core'),
                 ('https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu/4.0.0_best_int', '/lib/tesseract/deu')]:
        s = s.replace(a, b)
open(dst, 'w', encoding='utf-8').write(s)
print({k: v for k, v in n.items()})
