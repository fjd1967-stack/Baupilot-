(function(){
  var tabs=document.getElementById('tabs');
  var knoepfe=[].slice.call(tabs.querySelectorAll('[role=tab]'));
  function zeige(name){
    knoepfe.forEach(function(b){
      var an=b.dataset.tab===name;
      b.setAttribute('aria-selected',an);
      b.tabIndex=an?0:-1;
      document.getElementById('tab-'+b.dataset.tab).hidden=!an;
    });
    try{sessionStorage.setItem('tab',name)}catch(e){}
  }
  knoepfe.forEach(function(b,i){
    b.addEventListener('click',function(){zeige(b.dataset.tab)});
    b.addEventListener('keydown',function(e){
      var n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:null;
      if(n===null)return;
      n=(n+knoepfe.length)%knoepfe.length;knoepfe[n].focus();zeige(knoepfe[n].dataset.tab);
    });
  });
  function status(){
    var da=false;try{da=!!localStorage.getItem('profil-v1')}catch(e){}
    tabs.hidden=!da;
    if(!da)zeige('profil');
    else{var t='profil';try{t=sessionStorage.getItem('tab')||'profil'}catch(e){}zeige(t)}
  }
  document.addEventListener('profil-geaendert',status);
  status();
})();
