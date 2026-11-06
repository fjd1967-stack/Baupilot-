(function(){
  var $=function(i){return document.getElementById(i)};
  if(!$('b-liste'))return;
  var MAX=25*1024*1024, OK=/\.(pdf|docx?|xlsx?|png|jpe?g|heic)$/i, db;
  function oeffnen(){
    return new Promise(function(res,rej){
      var r=indexedDB.open('blaetter-v1',1);
      r.onupgradeneeded=function(){r.result.createObjectStore('dateien',{keyPath:'id'})};
      r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)};
    });
  }
  function tx(modus,fn){
    return new Promise(function(res,rej){
      var t=db.transaction('dateien',modus),s=t.objectStore('dateien'),out=fn(s);
      t.oncomplete=function(){res(out&&out.result)};t.onerror=function(){rej(t.error)};t.onabort=function(){rej(t.error)};
    });
  }
  function groesse(n){return n<1048576?Math.max(1,Math.round(n/1024))+' KB':(n/1048576).toFixed(1).replace('.',',')+' MB'}
  function fehler(t){$('b-fehler').textContent=t||''}
  function liste(){
    return tx('readonly',function(s){return s.getAll()}).then(function(a){
      var box=$('b-liste');box.textContent='';
      if(!a||!a.length){var p=document.createElement('p');p.className='hilfe';p.textContent='Noch keine Formblätter hochgeladen.';box.appendChild(p);return}
      var g={};a.sort(function(x,y){return y.datum-x.datum}).forEach(function(d){(g[d.kategorie]=g[d.kategorie]||[]).push(d)});
      Object.keys(g).sort().forEach(function(k){
        var sec=document.createElement('section');sec.className='b-gruppe';
        var h=document.createElement('h2');h.textContent=k;sec.appendChild(h);
        g[k].forEach(function(d){
          var z=document.createElement('div');z.className='b-eintrag';
          var n=document.createElement('div');n.className='name';n.textContent=d.name;
          var m=document.createElement('div');m.className='meta';
          m.textContent=groesse(d.size)+' · '+new Date(d.datum).toLocaleDateString('de-DE');
          z.appendChild(n);z.appendChild(m);
          function knopf(t,fn,cls){var b=document.createElement('button');b.type='button';b.className='btn klein '+(cls||'ghost');b.textContent=t;b.addEventListener('click',fn);z.appendChild(b)}
          knopf('Öffnen',function(){var u=URL.createObjectURL(d.blob);window.open(u,'_blank');setTimeout(function(){URL.revokeObjectURL(u)},60000)});
          knopf('Herunterladen',function(){var u=URL.createObjectURL(d.blob),a=document.createElement('a');a.href=u;a.download=d.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},5000)});
          knopf('Löschen',function(){if(confirm('„'+d.name+'“ wirklich löschen?'))tx('readwrite',function(s){s.delete(d.id)}).then(liste)});
          sec.appendChild(z);
        });
        box.appendChild(sec);
      });
    });
  }
  function platz(){
    var p=$('b-platz');
    if(!navigator.storage||!navigator.storage.estimate){p.textContent='';return}
    navigator.storage.estimate().then(function(e){p.textContent='Belegt auf diesem Gerät: '+groesse(e.usage||0)+'. Die Dateien bleiben vorerst nur hier gespeichert.'});
  }
  function hinzu(files){
    fehler('');var kat=$('b-kat').value,bad=[],jobs=[];
    [].slice.call(files).forEach(function(f){
      if(!OK.test(f.name)){bad.push(f.name+': Dateityp nicht erlaubt.');return}
      if(f.size>MAX){bad.push(f.name+': größer als 25 MB.');return}
      var id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      jobs.push(tx('readwrite',function(s){return s.put({id:id,name:f.name,type:f.type,size:f.size,kategorie:kat,datum:Date.now(),blob:f})}));
    });
    Promise.all(jobs).then(function(){
      if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
      if(bad.length)fehler(bad.join(' '));
      return liste()}).then(platz).catch(function(){fehler('Speichern nicht möglich. Eventuell ist der Speicher voll.')});
    if(!jobs.length&&bad.length)fehler(bad.join(' '));
  }
  $('b-datei').addEventListener('change',function(){var f=this.files;if(f&&f.length)hinzu(f);this.value=''});
  var ab=$('ablage');
  ['dragenter','dragover'].forEach(function(t){ab.addEventListener(t,function(e){e.preventDefault();ab.classList.add('zieh')})});
  ['dragleave','drop'].forEach(function(t){ab.addEventListener(t,function(e){e.preventDefault();ab.classList.remove('zieh')})});
  ab.addEventListener('drop',function(e){if(e.dataTransfer&&e.dataTransfer.files.length)hinzu(e.dataTransfer.files)});
  if(!window.indexedDB){fehler('Dein Browser kann hier keine Dateien speichern.');return}
  oeffnen().then(function(d){db=d;return liste()}).then(platz).catch(function(){fehler('Der Speicher ist nicht verfügbar. Im privaten Modus geht das Hochladen nicht.')});
})();
