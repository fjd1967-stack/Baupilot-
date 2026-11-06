(function(){
  var KEY='firma-v1';
  var $=function(i){return document.getElementById(i)};
  var form=$('firma-form');if(!form)return;
  var IDS=['name','form','str','plz','ort','tel','mail','web','gf','ust','steuer','hr','iban','bic'];
  var logo='';
  function fehler(id,t){var e=$('e-f-'+id);if(e)e.textContent=t||'';var f=$('f-'+id);if(f){if(t)f.setAttribute('aria-invalid','true');else f.removeAttribute('aria-invalid')}}
  function ibanOk(s){
    s=s.replace(/\s+/g,'').toUpperCase();
    if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s))return false;
    var r=(s.slice(4)+s.slice(0,4)).replace(/[A-Z]/g,function(c){return c.charCodeAt(0)-55});
    var m=0;for(var i=0;i<r.length;i++)m=(m*10+(+r[i]))%97;
    return m===1;
  }
  function pruefen(d){
    var ok=true;function f(id,t){fehler(id,t);if(t)ok=false}
    IDS.forEach(function(i){fehler(i,'')});fehler('logo','');
    f('name',d.name.length<2?'Bitte gib den Firmennamen ein.':'');
    f('str',d.str.length<3?'Bitte gib Straße und Hausnummer ein.':'');
    f('plz',/^\d{5}$/.test(d.plz)?'':'Bitte gib eine PLZ mit 5 Ziffern ein.');
    f('ort',d.ort.length<2?'Bitte gib den Ort ein.':'');
    var z=d.tel.replace(/\D/g,'');
    f('tel',!d.tel?'Bitte gib die Telefonnummer ein.':(z.length<6||z.length>16?'Diese Telefonnummer sieht nicht richtig aus.':''));
    f('mail',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.mail)?'':'Bitte gib eine gültige E-Mail-Adresse ein.');
    if(d.web)f('web',/^(https?:\/\/)?[^\s\/]+\.[^\s\/]{2,}.*$/i.test(d.web)?'':'Diese Webadresse sieht nicht richtig aus.');
    if(d.ust)f('ust',/^[A-Z]{2}[A-Z0-9]{8,12}$/.test(d.ust.replace(/\s/g,'').toUpperCase())?'':'Zum Beispiel DE123456789.');
    if(d.iban)f('iban',ibanOk(d.iban)?'':'Diese IBAN ist nicht gültig. Bitte prüfe sie.');
    return ok;
  }
  function lesen(){var d={};IDS.forEach(function(i){d[i]=($('f-'+i).value||'').trim()});return d}
  function vorschau(){
    var v=$('logo-vorschau');v.textContent='';
    if(logo){var im=new Image();im.alt='Dein Firmenlogo';im.src=logo;v.appendChild(im)}else v.textContent='Kein Logo';
    $('logo-weg').hidden=!logo;
  }
  function laden(){
    var s=null;try{s=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
    if(!s)return;
    IDS.forEach(function(i){if(s[i]!=null)$('f-'+i).value=s[i]});
    logo=s.logo||'';vorschau();
  }
  $('f-logo').addEventListener('change',function(){
    var file=this.files[0];this.value='';if(!file)return;
    fehler('logo','');
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){fehler('logo','Bitte wähle eine PNG- oder JPG-Datei.');return}
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      var m=400,w=im.width,h=im.height,k=Math.min(1,m/Math.max(w,h));
      var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      logo=c.toDataURL('image/png');URL.revokeObjectURL(u);vorschau();
    };
    im.onerror=function(){URL.revokeObjectURL(u);fehler('logo','Das Bild konnte nicht gelesen werden.')};
    im.src=u;
  });
  $('logo-weg').addEventListener('click',function(){logo='';vorschau()});
  form.addEventListener('submit',function(e){
    e.preventDefault();$('f-meldung').textContent='';
    var d=lesen();
    if(!pruefen(d)){var x=form.querySelector('[aria-invalid=true]');if(x)x.focus();return}
    d.ust=d.ust.replace(/\s/g,'').toUpperCase();d.iban=d.iban.replace(/\s+/g,'').toUpperCase();
    d.logo=logo;
    try{localStorage.setItem(KEY,JSON.stringify(d));$('f-meldung').textContent='Gespeichert.'}
    catch(err){fehler('logo','Speichern nicht möglich. Das Logo ist eventuell zu groß.')}
  });
  laden();
})();
