// Client texts from the hub go out through Mobile Message (business number),
// not Jack's own phone. Falls back to opening Messages if Mobile Message isn't set up.
// BCSms.check(key) -> Promise<{ready, from}>
// BCSms.go(el, to, message, key, opts) — call from a click handler on an <a>.
(function(){
  var state=null;
  function key(k){ if(k) return k; try{ return localStorage.getItem('roster_admin_key')||sessionStorage.getItem('roster_admin_key')||''; }catch(e){ return ''; } }
  function call(method,body,k){
    return fetch('/api/sms',{method:method,headers:{'content-type':'application/json','x-admin-key':key(k)},body:body?JSON.stringify(body):undefined,cache:'no-store'})
      .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){ if(!r.ok) throw new Error(d.error||'Text didn\'t send'); return d; }); });
  }
  function check(k){ if(state) return Promise.resolve(state); return call('GET',null,k).then(function(d){ state=d; return d; }).catch(function(){ return {ready:false}; }); }
  function plain(p){ return String(p||'').replace(/[^0-9+]/g,''); }
  function toast(m){ var t=document.createElement('div'); t.className='toast'; t.textContent=m; t.setAttribute('role','status'); document.body.appendChild(t); setTimeout(function(){ t.remove(); },2600); }
  // opts: {ref, done(), toast(msg)}
  function go(el, to, message, k, opts){
    opts=opts||{}; var say=opts.toast||toast;
    if(!(state&&state.ready)){ el.href='sms:'+plain(to)+'?&body='+encodeURIComponent(message); return false; }
    if(!plain(to)){ el.href='#'; say('Add the client\'s mobile first'); return true; }
    el.href='#';
    if(el.dataset.busy) return true;
    if(!window.confirm('Send this text to '+to+' from '+state.from+'?')) return true;
    el.dataset.busy='1'; el.style.opacity='.5';
    call('POST',{to:to,message:message,ref:opts.ref||''},k).then(function(){ say('Text sent from '+state.from); if(opts.done) opts.done(); })
      .catch(function(e){ say(e.message); })
      .then(function(){ delete el.dataset.busy; el.style.opacity=''; });
    return true;
  }
  window.BCSms={check:check, go:go, get ready(){ return !!(state&&state.ready); }, get from(){ return state&&state.from||''; }};
})();
