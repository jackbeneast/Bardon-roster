/* Hub navigation, shared by the hub and every owner page.
   1. Back: remembers the screens you visited in this tab, so every Back
      button (marked data-hb) returns to the screen you were actually on,
      not the hub's home screen. With nothing to go back to, it goes to the
      link's own href (its sensible parent).
   2. Tab bar: on owner pages (script tag has data-tabs="tools" or
      "messages"), the hub's bottom tab bar is shown so Today, Roster, Add,
      Messages, Pipeline and Tools are always one tap away.
   Load it in <head>, before the page's own scripts. */
(function(){
  if(window.HubNav) return;
  var S=document.currentScript, TABS=S&&S.getAttribute('data-tabs');
  var K='hubnav_stack', MAX=40;
  var rs=history.replaceState, ps=history.pushState;

  function cur(){ return location.pathname+location.search+location.hash; }
  function norm(u){ u=String(u||''); try{ var a=new URL(u,location.href); u=a.pathname+a.search+a.hash; }catch(e){} return u.replace(/index\.html/,'').replace(/#\/?$/,''); }
  function same(a,b){ return norm(a)===norm(b); }
  function get(){ try{ return JSON.parse(sessionStorage.getItem(K))||[]; }catch(e){ return []; } }
  function put(a){ try{ sessionStorage.setItem(K,JSON.stringify(a.slice(-MAX))); }catch(e){} }
  function st(){ try{ return history.state; }catch(e){ return null; } }
  function merge(s,prev){ if(s!==null && typeof s!=='object') return s; var o={}; if(s) for(var k in s) o[k]=s[k]; if(prev) o.hnPrev=prev; return o; }

  // Record where we are. Arriving at the screen before this one = we went back.
  function track(){
    var u=cur(), a=get(), n=a.length;
    if(n && same(a[n-1],u)) return;
    if(n>1 && same(a[n-2],u)){ a.pop(); put(a); return; }
    var prev=n?a[n-1]:'';
    a.push(u); put(a);
    // Note on this browser history entry which screen it came from,
    // so Back can use the browser's own back (instant, keeps scroll) when it matches.
    try{ rs.call(history, merge(st(),prev), ''); }catch(e){}
  }
  // Pages swap their URL in place (tabs, tidy-ups): keep the latest screen accurate.
  history.replaceState=function(s,t,u){
    var keep=(st()||{}).hnPrev, r=rs.call(history, merge(s,keep), t, u);
    if(u!=null){ var a=get(); if(a.length){ a[a.length-1]=cur(); put(a); } }
    return r;
  };
  history.pushState=function(s,t,u){ var r=ps.apply(history,arguments); track(); return r; };

  function canBack(){ return get().length>1; }
  function go(url){
    if(HubNav.local && HubNav.local(url)) return;
    var a=document.createElement('a'); a.href=url;
    if(a.pathname===location.pathname && a.search===location.search && a.hash){ location.hash=a.hash; return; }
    location.href=url;
  }
  function back(fallback){
    var a=get(), n=a.length;
    if(n>1){
      var prev=a[n-2], s=st();
      if(s && s.hnPrev && same(s.hnPrev,prev)){ history.back(); return; }
      a.pop(); put(a); go(prev); return;
    }
    put([]); go(fallback||'/?v=more');
  }

  window.HubNav={track:track, back:back, canBack:canBack, local:null};
  track();
  window.addEventListener('hashchange',track);
  window.addEventListener('popstate',track);
  window.addEventListener('pageshow',function(e){ if(e.persisted) track(); });

  // Any Back button: <a data-hb href="parent"> or <button data-hb="parent">
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-hb]'); if(!b) return;
    if(e.metaKey||e.ctrlKey||e.shiftKey) return;
    e.preventDefault(); e.stopPropagation();
    back(b.getAttribute('data-hb')||b.getAttribute('href'));
  },true);

  // ---------- Tab bar on owner pages ----------
  if(!TABS) return;
  function admin(){ try{ return !!(localStorage.getItem('roster_admin_key')||sessionStorage.getItem('roster_admin_key')); }catch(e){ return false; } }
  var I={
    today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
    roster:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    funnel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5h17l-6.5 8v5.5l-4 1.5v-7z"/></svg>',
    grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>'
  };
  var H='calc(65px + env(safe-area-inset-bottom,0px))';
  var css=
    '.hnav{position:fixed;left:0;right:0;bottom:0;z-index:16;background:#fff;border-top:1px solid #DDD3C8;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));font-family:Inter,system-ui,-apple-system,sans-serif}'+
    '.hnav .in{max-width:680px;margin:0 auto;display:grid;grid-template-columns:repeat(6,1fr);align-items:end}'+
    '.hnav a{text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:3px;font:500 11px/1 Inter,system-ui,sans-serif;color:#7A7A7A;padding:6px 2px;min-height:52px;-webkit-tap-highlight-color:transparent}'+
    '.hnav a svg{width:24px;height:24px}'+
    '.hnav a[aria-current="page"]{color:#A55830}'+
    '.hnav .add{color:#1A1A1A}'+
    '.hnav .add span{width:50px;height:50px;border-radius:50%;background:#C06B3C;color:#fff;display:grid;place-items:center;margin-top:-22px;box-shadow:0 4px 14px rgba(192,107,60,.35)}'+
    '.hnav .add span svg{width:26px;height:26px}'+
    'body.hn{padding-bottom:'+H+'}'+
    'body.hn:not(.hn-kb) .bar{bottom:'+H+';padding-bottom:10px}'+
    'body.hn:not(.hn-kb) .toast,body.hn:not(.hn-kb) .fab{margin-bottom:65px}'+
    'body.hn:not(.hn-kb) .conv{bottom:'+H+'}'+
    'body.hn-kb .hnav{display:none}'+
    '@media print{.hnav{display:none}}';
  function tab(href,label,icon,on,cls){ return '<a href="'+href+'"'+(cls?' class="'+cls+'"':'')+(on?' aria-current="page"':'')+'>'+(cls==='add'?'<span>'+icon+'</span>':icon)+label+'</a>'; }
  function mount(){
    if(!admin() || document.querySelector('.hnav')) return;
    var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
    var n=document.createElement('nav'); n.className='hnav'; n.setAttribute('aria-label','Main');
    n.innerHTML='<div class="in">'+
      tab('/?v=today','Today',I.today)+
      tab('/?v=roster','Roster',I.roster)+
      tab('/?v=today&add=1','Add job',I.plus,false,'add')+
      tab('/messages/','Messages',I.chat,TABS==='messages')+
      tab('/?v=pipeline','Pipeline',I.funnel)+
      tab('/?v=more','Tools',I.grid,TABS==='tools')+'</div>';
    document.body.appendChild(n); document.body.classList.add('hn');
    // Make way for the keyboard while typing.
    // The bar only comes back once the keyboard has actually gone (iPhone
    // otherwise strands it a keyboard-height up the screen), and is re-laid
    // out so iOS pins it back to the bottom.
    var t=null, VV=window.visualViewport;
    function typing(el){ return el && (el.tagName==='TEXTAREA' || el.isContentEditable || el.tagName==='SELECT' || (el.tagName==='INPUT' && !/^(checkbox|radio|button|submit|range|color|file|reset|image)$/i.test(el.type))); }
    function kbUp(){ return !!VV && (window.innerHeight - VV.height) > 120; }
    function settle(){
      clearTimeout(t);
      if(typing(document.activeElement) || kbUp()){ document.body.classList.add('hn-kb'); return; }
      if(!document.body.classList.contains('hn-kb')) return;
      document.body.classList.remove('hn-kb');
      n.style.display='none'; void n.offsetHeight; n.style.display='';
    }
    document.addEventListener('focusin',function(e){ clearTimeout(t); if(typing(e.target)) document.body.classList.add('hn-kb'); });
    document.addEventListener('focusout',function(){ clearTimeout(t); t=setTimeout(settle,150); });
    if(VV) VV.addEventListener('resize',function(){ clearTimeout(t); t=setTimeout(settle,80); });
    window.addEventListener('pageshow',function(){ setTimeout(settle,50); });
  }
  if(document.body) mount(); else document.addEventListener('DOMContentLoaded',mount);
})();
