(function(){
  var KEY='team-v1',$=function(i){return document.getElementById(i)};
  var form=$('team-form');if(!form)return;
  function plan(){try{return Math.max(1,(JSON.parse(localStorage.getItem('plan-v1'))||{}).n||1)}catch(e){return 1}}
  function laden(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}}
  function sichern(a){localStorage.setItem(KEY,JSON.stringify(a))}
  function fehler(id,t){$('e-t-'+id).textContent=t||'';var f=$(id==='name'?'t-name':'t-kontakt');if(t)f.setAttribute('aria-invalid','true');else f.removeAttribute('aria-invalid')}
  var istMail=function(s){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)};
  var istTel=function(s){var d=s.replace(/\D/g,'');return /^[+\d\s\/()-]+$/.test(s)&&d.length>=7&&d.length<=15};
  function link(){return location.origin+location.pathname.replace(/[^\/]*$/,'')+'install.html'}
  function text(u){
    var firma='';try{firma=(JSON.parse(localStorage.getItem('firma-v1'))||{}).name||''}catch(e){}
    var absender='';try{absender=(JSON.parse(localStorage.getItem('profil-v1'))||{}).vorname||''}catch(e){}
    var n=(window.SITE&&SITE.name)||'BauPilot';
    return 'Hallo '+u.name.split(' ')[0]+', '+(absender?absender+' ':'')+(firma?'('+firma+') ':'')+'hat dich zu '+n+' eingeladen. Installiere die App hier auf deinem Handy: '+link();
  }
  function whatsapp(u){var d=u.kontakt.replace(/[^\d+]/g,'');if(d[0]==='0')d='49'+d.slice(1);d=d.replace('+','');return 'https://wa.me/'+d+'?text='+encodeURIComponent(text(u))}
  function mail(u){return 'mailto:'+encodeURIComponent(u.kontakt)+'?subject='+encodeURIComponent('Einladung zur App')+'&body='+encodeURIComponent(text(u))}
  function zeige(){
    var a=laden(),max=plan();
    $('t-plan').textContent='Gebucht: '+max+(max===1?' Nutzer':' Nutzer')+' · angelegt: '+a.length+' · frei: '+Math.max(0,max-a.length);
    var box=$('t-liste');box.textContent='';
    if(!a.length){var p=document.createElement('p');p.className='hilfe';p.textContent='Noch keine Nutzer angelegt.';box.appendChild(p);return}
    a.forEach(function(u,i){
      var z=document.createElement('div');z.className='t-eintrag';
      var n=document.createElement('div');n.className='name';n.textContent=u.name;
      var m=document.createElement('div');m.className='meta';m.textContent=u.kontakt+' · '+(u.eingeladen?'Eingeladen am '+new Date(u.eingeladen).toLocaleDateString('de-DE'):'Noch nicht eingeladen');
      var r=document.createElement('div');r.className='zeile2';
      function k(t,fn){var b=document.createElement(typeof fn==='string'?'a':'button');b.className='btn klein ghost';b.textContent=t;if(typeof fn==='string'){b.href=fn;b.target='_blank';b.rel='noopener';b.addEventListener('click',function(){var l=laden();l[i].eingeladen=Date.now();sichern(l);setTimeout(zeige,300)})}else{b.type='button';b.addEventListener('click',fn)}r.appendChild(b)}
      if(istMail(u.kontakt))k('Per E-Mail einladen',mail(u));else k('Per WhatsApp einladen',whatsapp(u));
      if(navigator.share)k('Teilen',function(){navigator.share({title:'Einladung',text:text(u)}).then(function(){var l=laden();l[i].eingeladen=Date.now();sichern(l);zeige()}).catch(function(){})});
      k('Entfernen',function(){if(confirm(u.name+' wirklich entfernen?')){var l=laden();l.splice(i,1);sichern(l);zeige()}});
      z.appendChild(n);z.appendChild(m);z.appendChild(r);box.appendChild(z);
    });
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var name=$('t-name').value.trim(),kon=$('t-kontakt').value.trim(),ok=true,a=laden();
    fehler('name',name.length<2?'Bitte gib den Namen ein.':'');if(name.length<2)ok=false;
    var kok=istMail(kon)||istTel(kon);fehler('kontakt',kok?'':'Bitte gib eine Handynummer oder E-Mail-Adresse ein.');if(!kok)ok=false;
    if(ok&&a.length>=plan()){fehler('kontakt','Alle gebuchten Nutzer sind angelegt. Du kannst weitere Nutzer buchen.');ok=false}
    if(!ok){var x=form.querySelector('[aria-invalid=true]');if(x)x.focus();return}
    a.push({name:name,kontakt:kon,angelegt:Date.now()});sichern(a);form.reset();zeige();
  });
  document.addEventListener('plan-geaendert',zeige);
  zeige();
})();
