process.env.DB_FILE=':memory:';process.env.STRIPE_MOCK='1';process.env.KI_MOCK='1';process.env.BASE_URL='http://localhost:4125';process.env.NODE_ENV='test';
const root=new URL('../../../',import.meta.url).pathname.replace(/\/$/,'');
const { handler } = await import(root+'/server/src/server.js');
const { db, jetzt } = await import(root+'/server/src/db.js');
const { hash } = await import(root+'/server/src/crypto.js');
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/json','.woff':'font/woff'};
const srv=http.createServer((req,res)=>{ if(req.url.startsWith('/api/')||req.url.startsWith('/webhook')||req.url.startsWith('/_blob/')) return handler(req,res);
  let p=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]); if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.statusCode=404;return res.end()}
  res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));});
await new Promise(r=>srv.listen(4125,r));
db.prepare("INSERT INTO konto(id,status,firma,strasse,plz,ort,nutzer,erstellt,firmendaten) VALUES(1,'aktiv','Muster Bau GmbH','Hauptstr. 1','77761','Schiltach',5,?,?)").run(jetzt(),JSON.stringify({name:'Muster Bau GmbH',strasse:'Hauptstr. 1',plz:'77761',ort:'Schiltach',tel:'07836 123',mail:'info@muster.de'}));
db.prepare("INSERT INTO nutzer(id,konto,name,kontakt,rolle,variante,sprache,sprache_gesetzt,erstellt) VALUES(1,1,'Frank Muster','f@x.de','chef','bauleiter','pl',1,?)").run(jetzt());
db.prepare("INSERT INTO nutzer(id,konto,name,kontakt,rolle,variante,sprache,sprache_gesetzt,erstellt) VALUES(2,1,'Ali Vorarbeiter','0171','mitglied','vorarbeiter','sq',0,?)").run(jetzt());
for(const [t,n] of [['tc',1],['tm',2]]) db.prepare("INSERT INTO sitzung(hash,nutzer,ablauf) VALUES(?,?,?)").run(hash(t),n,jetzt()+1e9);
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const b=await chromium.launch(); const out=process.env.OUT;
async function seite(tok){ const ctx=await b.newContext({viewport:{width:430,height:900},acceptDownloads:true}); await ctx.addCookies([{name:'sid',value:tok,url:'http://localhost:4125'}]);
  const pg=await ctx.newPage(); const errs=[]; pg.on('console',m=>{if(m.type()==='error'&&!/cdnjs|jsdelivr|ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())}); pg.on('pageerror',e=>errs.push(String(e))); return {ctx,pg,errs}; }
const log=(...a)=>console.log(...a);



const ergebnisse=[]; const ok=(n,c,info='')=>{ergebnisse.push([n,!!c]); console.log((c?'PASS ':'FAIL ')+n+(c?'':' '+info));};
async function t(name,fn){ try{ await fn(); }catch(e){ ok(name,false,String(e.message).split('\n').slice(0,6).join(' ')); } }
// Chef (Polnisch)
{ const {pg,errs}=await seite('tc'); await pg.goto('http://localhost:4125/bau.html'); await pg.waitForTimeout(1500);
  await t('Oberfläche polnisch (Wörterbuch)',async()=>{ const tx=await pg.$$eval('#rubs [data-rub]',b=>b.map(x=>x.textContent.trim())); ok('Reiter polnisch', tx.includes('Dziennik budowy')&&tx.includes('Zadania'), JSON.stringify(tx)); });
  await t('Unbekannter Text über Server',async()=>{ const x=await pg.$$eval('body *',els=>els.filter(e=>e.children.length===0&&/^\[pl\]/.test((e.textContent||'').trim())).length); ok('Server-Übersetzung (Mock) erscheint', x>0, String(x)); });
  await t('Baustelle + Schreiben polnisch',async()=>{
    await pg.click('#projBtn'); await pg.click('[data-newproj]'); await pg.fill('#baustelle','Teststraße Neubau'); await pg.fill('#strasse','Hauptstr. 5'); await pg.fill('#plzOrt','77761 Schiltach'); await pg.fill('#auftraggeber','Muster AG'); await pg.fill('#kostenstelle','4711'); await pg.click('#saveProj'); await pg.waitForTimeout(1200);
    { const h=await pg.$('#homeBtn'); if(h&&await h.isVisible()) await h.click(); await pg.waitForTimeout(300); } await pg.click('#rubs [data-rub=bt]'); await pg.waitForTimeout(800);
    const ta=await pg.$('#leistungen'); if(!ta) throw new Error('kein Feld #leistungen');
    await ta.fill('Prace betonowe na czwartym piętrze'); await pg.click('#geraete'); await pg.waitForTimeout(800);
    const v=await pg.$eval('#leistungen',e=>e.value); ok('Feld wurde ins Deutsche übersetzt (Mock [de])', v.startsWith('[de] Prace'), v);
    const h=await pg.$eval('#leistungen',e=>e.nextElementSibling&&e.nextElementSibling.className+'|'+e.nextElementSibling.textContent); ok('Originaltext bleibt sichtbar', /i18n-orig\|🌐 Polski: Prace betonowe/.test(h||''), h);
  });
  ok('keine Konsolenfehler (Chef)', errs.length===0, errs.join(' | ')); }
// Mitarbeiter (Albanisch, Sprache noch nicht bestätigt)
{ const {pg,errs}=await seite('tm'); await pg.goto('http://localhost:4125/bau.html'); await pg.waitForTimeout(1500);
  await t('Sprachwahl erscheint beim ersten Start',async()=>{ ok('Dialog sichtbar', !!(await pg.$('.i18n-pick.dlg'))); });
  await t('Auswahl speichert die Sprache',async()=>{ await pg.click('.i18n-pick.dlg button:has-text("Română")'); await pg.waitForTimeout(1200);
    const sp=(await (await pg.request.get('http://localhost:4125/api/me')).json()); ok('Server kennt Rumänisch', sp.sprache==='ro'&&sp.spracheGesetzt===true, JSON.stringify([sp.sprache,sp.spracheGesetzt]));
    const tx=await pg.$$eval('#rubs [data-rub]',b=>b.filter(x=>x.offsetParent).map(x=>x.textContent.trim())); ok('Reiter rumänisch', tx.includes('Sarcini'), JSON.stringify(tx)); });
  ok('keine Konsolenfehler (Mitarbeiter)', errs.length===0, errs.join(' | ')); }

// Konto-Seite (Team mit Sprache je Mitarbeiter)
{ const {pg,errs}=await seite('tc'); await pg.goto('http://localhost:4125/app.html'); await pg.waitForTimeout(1500);
  await t('Team-Formular hat Sprachwahl',async()=>{ await pg.click('#t-team'); await pg.waitForTimeout(800);
    const n=await pg.$$eval('#k-spr option',o=>o.length); ok('Sprachliste im Team-Formular', n===8, String(n));
    const tabs=await pg.$$eval('#tabs button',b=>b.map(x=>x.textContent.trim())); ok('Reiter polnisch', tabs.includes('Zespół')||tabs.includes('Profil'), JSON.stringify(tabs)); });
  ok('keine Konsolenfehler (Konto)', errs.length===0, errs.join(' | ')); }
// Anmeldeseite ohne Konto: Sprachwahl per Knopf, Wörterbuch
{ const ctx=await b.newContext({viewport:{width:430,height:900}}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://localhost:4125/login.html'); await pg.waitForTimeout(600);
  await t('Login: Sprache wählen',async()=>{ await pg.click('.i18n-pick.pill'); await pg.click('.i18n-pick.dlg button:has-text("Türkçe")'); await pg.waitForTimeout(1000);
    const l=await pg.$eval('#los',e=>e.textContent.trim()); ok('Knopf türkisch', l==='Bağlantıyı gönder', l); });
  ok('keine Skriptfehler (Login)', errs.length===0, errs.join(' | ')); await ctx.close(); }
const f=ergebnisse.filter(x=>!x[1]).length; console.log(f?('FEHLER: '+f):'ALLES GRÜN'); await b.close(); srv.close(); process.exit(f?1:0);
