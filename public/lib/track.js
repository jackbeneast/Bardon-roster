// Engagement tracking for the links clients open (quotes, invoices, receipts,
// job reports, agent portal). Records: when the visit starts, how long the page is
// actually on screen, how far they scroll, and which buttons/links they tap.
// Nothing they type is ever recorded. Jack's own visits (logged in to the hub) are skipped.
(function(){
  try{
    if(localStorage.getItem('roster_admin_key')) return;
    // Agents opening a client's quote or invoice from their portal aren't the client.
    if(/[?&]a=/.test(location.search) && /^\/(q|i|r)\//.test(location.pathname)) return;
  }catch(e){}
  var parts=location.pathname.split('/'), p=parts[1], t=parts[2]||'';
  if(['q','i','r','v','a'].indexOf(p)<0 || !/^[\w-]{16,80}$/.test(t)) return;

  var sid=(Date.now().toString(36)+Math.random().toString(36).slice(2,10)).slice(0,20);
  var w=Math.min(screen.width||0, screen.height||0)||window.innerWidth;
  var dev=w>=900?'desktop':w>=600?'tablet':'mobile';
  var shown=0, since=document.visibilityState==='visible'?Date.now():0, sc=0, acts=[], dirty=false;

  function active(){ return shown+(since?Date.now()-since:0); }
  function send(ev){
    var body=JSON.stringify({p:p,t:t,sid:sid,ev:ev,ms:active(),sc:sc,acts:acts,dev:dev});
    try{
      if(navigator.sendBeacon && navigator.sendBeacon('/api/engage', new Blob([body],{type:'text/plain'}))) { dirty=false; return; }
    }catch(e){}
    try{ fetch('/api/engage',{method:'POST',body:body,keepalive:true,headers:{'content-type':'text/plain'}}); dirty=false; }catch(e){}
  }

  // Scroll depth, as % of the page seen.
  function depth(){
    var h=Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), v=window.innerHeight;
    var d=h<=v?100:Math.round((window.scrollY+v)/h*100);
    if(d>sc){ sc=Math.min(100,d); dirty=true; }
  }
  window.addEventListener('scroll', depth, {passive:true});

  // Taps on buttons, links, photos and expanders: record their label.
  document.addEventListener('click', function(e){
    var el=e.target.closest && e.target.closest('a,button,summary,img,[role="button"]'); if(!el) return;
    var label='';
    if(el.tagName==='IMG') label='Viewed a photo';
    else if(el.tagName==='SUMMARY') label='Opened '+(el.textContent||'').trim();
    else label=(el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim();
    if(el.dataset && el.dataset.copy) label='Copied '+(el.dataset.label||'details');
    if(el.hasAttribute && el.hasAttribute('data-print')) label='Saved as PDF';
    if(!label || label.length<2) return;
    label=label.slice(0,60);
    var last=acts[acts.length-1];
    if(last && last.a===label && Date.now()-Date.parse(last.at)<3000) return;
    if(acts.length<30){ acts.push({a:label, at:new Date().toISOString()}); dirty=true; send('beat'); }
  }, true);
  document.addEventListener('submit', function(e){
    if(e.target && e.target.id==='acc' && acts.length<30){ acts.push({a:'Submitted acceptance', at:new Date().toISOString()}); send('beat'); }
  }, true);

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='hidden'){ if(since){ shown+=Date.now()-since; since=0; } send('beat'); }
    else if(!since){ since=Date.now(); }
  });
  window.addEventListener('pagehide', function(){ if(since){ shown+=Date.now()-since; since=0; } send('beat'); });

  // While they're reading, update every 20 seconds (in case the browser is closed abruptly).
  var lastSent=0;
  setInterval(function(){
    if(document.visibilityState!=='visible') return;
    if(active()-lastSent>=20000 || dirty){ lastSent=active(); send('beat'); }
  }, 20000);

  // Start the visit once the page has loaded its content.
  setTimeout(function(){ depth(); send('open'); }, 1200);
})();
