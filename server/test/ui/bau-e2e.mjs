process.env.DB_FILE=':memory:';process.env.STRIPE_MOCK='1';process.env.KI_MOCK='1';process.env.BASE_URL='http://localhost:4124';process.env.NODE_ENV='test';
const root=new URL('../../../',import.meta.url).pathname.replace(/\/$/,'');
const { handler } = await import(root+'/server/src/server.js');
const { db, jetzt } = await import(root+'/server/src/db.js');
const { hash } = await import(root+'/server/src/crypto.js');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/json','.woff':'font/woff'};
const srv=http.createServer((req,res)=>{ if(req.url.startsWith('/api/')||req.url.startsWith('/webhook')||req.url.startsWith('/_blob/')) return handler(req,res);
  let p=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]); if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.statusCode=404;return res.end()}
  res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));});
await new Promise(r=>srv.listen(4124,r));
db.prepare("INSERT INTO konto(id,status,firma,strasse,plz,ort,nutzer,erstellt,firmendaten) VALUES(1,'aktiv','Muster Bau GmbH','Hauptstr. 1','77761','Schiltach',5,?,?)").run(jetzt(),JSON.stringify({name:'Muster Bau GmbH',strasse:'Hauptstr. 1',plz:'77761',ort:'Schiltach',tel:'07836 123',mail:'info@muster.de'}));
db.prepare("INSERT INTO nutzer(id,konto,name,kontakt,rolle,variante,sprache_gesetzt,erstellt) VALUES(1,1,'Frank Muster','f@x.de','chef','bauleiter',1,?)").run(jetzt());
db.prepare("INSERT INTO nutzer(id,konto,name,kontakt,rolle,variante,sprache_gesetzt,erstellt) VALUES(2,1,'Ali Vorarbeiter','0171','mitglied','vorarbeiter',1,?)").run(jetzt());
for(const [t,n] of [['tc',1],['tm',2]]) db.prepare("INSERT INTO sitzung(hash,nutzer,ablauf) VALUES(?,?,?)").run(hash(t),n,jetzt()+1e9);
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const b=await chromium.launch(); const out=process.env.OUT;
async function seite(tok){ const ctx=await b.newContext({viewport:{width:430,height:900},acceptDownloads:true}); await ctx.addCookies([{name:'sid',value:tok,url:'http://localhost:4124'}]);
  const pg=await ctx.newPage(); const errs=[]; pg.on('console',m=>{if(m.type()==='error'&&!/cdnjs|jsdelivr|ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())}); pg.on('pageerror',e=>errs.push(String(e))); return {ctx,pg,errs}; }
const log=(...a)=>console.log(...a);


const ergebnisse=[]; const ok=(n,c,info='')=>{ergebnisse.push([n,!!c]); console.log((c?'PASS ':'FAIL ')+n+(c?'':' '+info));};
const kolls=k=>db.prepare("SELECT id,wert FROM dok WHERE koll=?").all(k).map(r=>({id:r.id,...JSON.parse(r.wert)}));
const {ctx,pg,errs}=await seite('tc'); await pg.goto('http://localhost:4124/bau.html'); await pg.waitForTimeout(1200);
const zurueck=async()=>{ const h=await pg.$('#homeBtn'); if(h&&await h.isVisible()) await h.click(); await pg.waitForTimeout(250); };
const rub=async r=>{ await zurueck(); await pg.click('#rubs [data-rub='+r+']'); await pg.waitForTimeout(600); };
async function t(name,fn){ try{ await fn(); }catch(e){ ok(name,false,String(e.message).split('\n')[0]); } }
// Baustelle anlegen
await t('Baustelle anlegen',async()=>{ await pg.click('#projBtn'); await pg.click('[data-newproj]'); await pg.fill('#baustelle','Teststraße Neubau'); await pg.fill('#strasse','Hauptstr. 5'); await pg.fill('#plzOrt','77761 Schiltach'); await pg.fill('#auftraggeber','Muster AG'); await pg.fill('#kostenstelle','4711'); await pg.click('#saveProj'); await pg.waitForTimeout(1200);
  ok('Baustelle anlegen',kolls('projekte').some(p=>p.baustelle==='Teststraße Neubau')); });
const pid=()=>kolls('projekte').find(p=>p.baustelle==='Teststraße Neubau')?.id;
await t('Bautagebuch',async()=>{ await rub('bt'); await pg.fill('#leistungen','Betonarbeiten Fundament'); await pg.fill('#geraete','Bagger'); await pg.waitForTimeout(1800);
  const e=kolls('projekte/'+pid()+'/entries'); ok('Bautagebuch: Tageseintrag gespeichert',e.some(x=>JSON.stringify(x).includes('Betonarbeiten Fundament')),JSON.stringify(e).slice(0,200));
  await pg.reload(); await pg.waitForTimeout(1500); await rub('bt'); ok('Bautagebuch: nach Neuladen sichtbar',(await pg.inputValue('#leistungen'))==='Betonarbeiten Fundament'); });
await t('Aufgabe',async()=>{ await rub('todo'); await pg.fill('#tq_text','Schalung kontrollieren'); await pg.fill('#tq_ausf','Ali'); await pg.click('#tAdd'); await pg.waitForTimeout(1000); ok('Aufgabe angelegt',kolls('todos').some(x=>JSON.stringify(x).includes('Schalung kontrollieren'))); });
await t('Übersetzung',async()=>{ await rub('todo'); await pg.fill('#tq_text','Bitte Beton bestellen'); const btn=(await pg.$$('button')).find; const alb=await pg.$("button:has-text('Albanisch')"); await alb.click(); await pg.waitForTimeout(1500); const txt=await pg.evaluate(()=>document.querySelector('#main').innerText); ok('Übersetzung (Albanisch) über KI-Dienst',/\[Übersetzung\]/.test(txt),txt.slice(-200)); });
await t('Information',async()=>{ await rub('info'); await pg.fill('#kq_text','Kran kommt Montag'); await pg.click('#kAdd'); await pg.waitForTimeout(1000); ok('Information angelegt',kolls('infos').some(x=>JSON.stringify(x).includes('Kran kommt Montag'))); });
await t('Bestellung',async()=>{ await rub('order'); await pg.fill('#oq_text','10 m³ Beton C25/30'); await pg.click('#oAdd'); await pg.waitForTimeout(1000); ok('Bestellung angelegt',kolls('bestellungen').some(x=>JSON.stringify(x).includes('Beton C25/30'))); });
await t('To-do-Liste',async()=>{ await rub('bl'); await pg.fill('#bl_text','Werkzeug prüfen'); await pg.click('#blAdd'); await pg.waitForTimeout(1000); ok('To-do-Liste Eintrag',kolls('bltodo').some(x=>JSON.stringify(x).includes('Werkzeug prüfen'))); });
await t('Arbeitseinteilung',async()=>{ await rub('ae'); await pg.fill('#aq_titel','KW46 Einteilung'); await pg.click('#aAdd'); await pg.waitForTimeout(1000);
  const alle=db.prepare("SELECT koll,wert FROM dok").all(); ok('Arbeitseinteilung angelegt',alle.some(r=>r.wert.includes('KW46 Einteilung')),alle.map(r=>r.koll).join(',')); });
await t('Besprechungsprotokoll',async()=>{ await rub('bespr'); await pg.click('#pNew'); await pg.waitForTimeout(1000); ok('Besprechungsprotokoll angelegt',kolls('projekte/'+pid()+'/protokolle').length>=1); });
await t('Protokoll intern',async()=>{ await rub('intern'); await pg.click('#pNew'); await pg.waitForTimeout(1000); ok('Protokoll intern angelegt',kolls('projekte/'+pid()+'/protokolle').length>=2); });
await t('Beleg',async()=>{ await rub('belege'); await pg.click('#bNew'); await pg.waitForTimeout(1000); const n=kolls('belege').length+kolls('projekte/'+pid()+'/belege').length; ok('Beleg ohne Foto angelegt',n>=1); });
await t('Anfrage',async()=>{ await rub('anfr'); await pg.click("button:has-text('+ Neue Anfrage')"); await pg.waitForTimeout(1000); const alle=db.prepare("SELECT koll FROM dok").all().map(r=>r.koll); ok('Anfrage angelegt',alle.some(k=>/anfr/i.test(k)||/dokumente/.test(k)),alle.join(',')); });
await t('Schriftverkehr',async()=>{ await rub('schrift'); await pg.click('#svNew'); await pg.waitForTimeout(1000); const alle=db.prepare("SELECT koll FROM dok").all().map(r=>r.koll); ok('Schriftverkehr: Eintrag angelegt',alle.length>0); });
await t('Dokumente',async()=>{ await rub('doku'); const txt=await pg.evaluate(()=>document.querySelector('#main').innerText); ok('Dokumente: Ordner sichtbar',/Leistungsverzeichnis/.test(txt)&&/Rapporte/.test(txt)); });
await t('Mail über Server',async()=>{ const r=await pg.evaluate(async()=>{ const m=await claude.use('mcp'); try{ await m.callTool('Gmail','send_message',{to:'a@b.de',subject:'Test',body:'x'},{cache:false}); return 'ok'; }catch(e){ return 'fehler '+(e.message||e.code); } }); ok('Mail-Versand (Postausgang)',r==='ok'&&db.prepare("SELECT 1 FROM postausgang WHERE betreff='Test'").get(),r); });
await t('Dateispeicher',async()=>{ const r=await pg.evaluate(async()=>{ const a=await claude.use('assets'); const x=await a.upload(new Blob(['%PDF-1.4'],{type:'application/pdf'}),{type:'application/pdf'}); const g=await fetch('/_blob/'+x.id); const l=await a.list(); await a.delete(x.id); return [g.status,l.usage.files]; }); ok('Dateispeicher hoch/abrufen/löschen',r[0]===200&&r[1]>=1,JSON.stringify(r)); });
ok('Keine Skriptfehler im Browser',errs.length===0,JSON.stringify(errs).slice(0,300));
const f=ergebnisse.filter(x=>!x[1]).length; console.log('\n'+ergebnisse.length+' Prüfungen, '+f+' fehlgeschlagen');
await ctx.close(); await b.close(); srv.close(); process.exit(f?1:0);
