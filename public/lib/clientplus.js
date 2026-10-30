/* Client link extras (server side: lib/plus.mjs). Draws extra sections into the
   client's link and handles their taps. The host page (agent/index.html) calls:
     BCPlus.init({ redraw, post, cred, viewer, demo })
     BCPlus.html(where, job, phase, data)   where = glance | booked | done | end
     BCPlus.busy()                          true while the client is typing in one of these forms
   Nothing here sends a message to anyone except Jack (as an alert), and only from a tap. */
(function(){
  var C={}, dirty=false, saving={}, ins=null, deferredInstall=null, reveal=null;
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pad(n){ return (n<10?'0':'')+n; }
  var DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DOWL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function parse(s){ var p=String(s).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function fmtDay(s){ var d=parse(s); return DOW[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]; }
  function longDay(s){ var d=parse(s); return DOWL[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]; }
  function clock(s){ if(!s) return ''; var d=new Date(s), h=d.getHours(); return (h%12||12)+':'+pad(d.getMinutes())+(h>=12?'pm':'am'); }
  function hm(t){ if(!t) return ''; var h=+t.slice(0,2), m=t.slice(3,5); return (h%12||12)+(m==='00'?'':':'+m)+(h>=12?'pm':'am'); }
  function money(v){ v=+v||0; var c=Math.abs(v%1)>0.004; return '$'+v.toLocaleString('en-AU',{minimumFractionDigits:c?2:0,maximumFractionDigits:c?2:0}); }
  function today(){ var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function daysTo(s){ return Math.round((parse(s)-parse(today()))/864e5); }
  function ic(k,n){ return window.BCART?'<span class="h2i" aria-hidden="true">'+BCART.icon(k,n||18)+'</span>':''; }
  function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  function photo(j,id,thumb){ return '/api/photo?j='+encodeURIComponent(j)+'&p='+encodeURIComponent(id)+(thumb?'&s=t':''); }
  function toast(m){ var t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(function(){t.remove();},2600); }
  function share(url,title,text){
    var full=location.origin+url;
    if(navigator.share){ navigator.share({title:title,text:text,url:full}).catch(function(){}); return; }
    try{ navigator.clipboard.writeText(full).then(function(){ toast('Link copied'); },function(){ prompt('Copy this link',full); }); }catch(e){ prompt('Copy this link',full); }
  }

  var CSS=
  '.xp-steps{list-style:none;margin:0;padding:0;display:grid;gap:0}'+
  '.xp-steps li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;padding:8px 0;position:relative}'+
  '.xp-steps li:not(:last-child)::after{content:"";position:absolute;left:12px;top:32px;bottom:-6px;width:2px;background:var(--cream-dark)}'+
  '.xp-steps .d{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);background:var(--white);display:grid;place-items:center;font:700 13px/1 var(--sans);color:var(--white)}'+
  '.xp-steps li.ok .d{background:var(--ok);border-color:var(--ok)}.xp-steps li.ok:not(:last-child)::after{background:var(--ok)}'+
  '.xp-steps li.now .d{border-color:var(--terracotta);box-shadow:0 0 0 4px var(--live)}'+
  '.xp-steps b{display:block;color:var(--dark);font-weight:600}.xp-steps span{font-size:13px;color:var(--meta)}'+
  '.xp-count{display:flex;align-items:baseline;gap:10px;margin:0 0 10px}.xp-count b{font:700 40px/1 var(--serif);color:var(--dark);font-variant-numeric:tabular-nums}.xp-count span{color:var(--meta);font-size:14px}'+
  '.xp-prep{list-style:none;margin:0;padding:0}.xp-prep li{border-bottom:1px solid var(--cream-dark)}.xp-prep li:last-child{border:0}'+
  '.xp-prep label{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;padding:11px 0;cursor:pointer;min-height:48px}'+
  '.xp-prep input{width:22px;height:22px;margin:1px 0 0;accent-color:var(--ok)}.xp-prep b{display:block;color:var(--dark);font-weight:500}.xp-prep small{display:block;color:var(--meta);font-size:13px}'+
  '.xp-prep input:checked+span b{text-decoration:line-through;text-decoration-color:var(--meta);color:var(--meta)}'+
  '.xp-meter{height:6px;background:var(--cream-dark);border-radius:3px;overflow:hidden;margin:2px 0 6px}.xp-meter i{display:block;height:100%;background:var(--ok);transition:width .4s}'+
  '.xp-feed{list-style:none;margin:0;padding:0}.xp-feed li{display:grid;grid-template-columns:62px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--cream-dark)}.xp-feed li:last-child{border:0}'+
  '.xp-feed time{font:600 12.5px/1.2 var(--sans);color:var(--meta);font-variant-numeric:tabular-nums}.xp-feed b{color:var(--dark);font-weight:500;display:block}.xp-feed small{color:var(--meta);font-size:12.5px}'+
  '.xp-feed img{width:52px;height:52px;object-fit:cover;border-radius:6px;display:block}.xp-feed li.new{animation:xpin .6s ease}.xp-feed li.k-ready b{color:var(--ok);font-weight:600}'+
  '@keyframes xpin{from{background:var(--live)}to{background:transparent}}@media (prefers-reduced-motion:reduce){.xp-feed li.new{animation:none}}'+
  '.xp-fin{display:flex;gap:12px;align-items:center;background:var(--tint);border-radius:8px;padding:12px 14px;margin:0 0 10px}.xp-fin b{display:block;color:var(--dark);font:700 18px/1.25 var(--serif)}.xp-fin span{font-size:12.5px;color:var(--meta)}'+
  '.xp-addon{border:2px solid var(--terracotta);border-radius:8px;padding:14px;background:var(--white);margin-top:10px}.xp-addon h3{font:600 16px/1.3 var(--sans);color:var(--dark);margin:0}.xp-addon .pr{font:700 22px/1 var(--serif);color:var(--dark);margin:8px 0}'+
  '.xp-addon .row{display:flex;gap:8px;margin-top:10px}.xp-addon .row .btn{flex:1}.xp-addon.done{border:1px solid var(--line)}'+
  '.xp-row{display:flex;gap:8px;flex-wrap:wrap}.xp-row .btn{flex:1;min-width:140px}'+
  '.xp-file{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--cream-dark)}.xp-file a{color:var(--btn);font-weight:600;text-decoration:none;overflow-wrap:anywhere}.xp-file button{background:none;border:0;color:var(--meta);font-size:13px;min-height:40px}'+
  '.xp-hist{list-style:none;margin:0;padding:0}.xp-hist li{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--cream-dark)}.xp-hist li:last-child{border:0}.xp-hist a{color:var(--btn);font-weight:600;text-decoration:none}'+
  '.xp-ok{display:flex;gap:10px;align-items:center;color:var(--ok);font-weight:600}.xp-ok i{width:28px;height:28px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;font-style:normal}'+
  '.xp-pay{display:flex;justify-content:space-between;align-items:center;gap:12px}.xp-pay b{font:700 24px/1 var(--serif);color:var(--dark)}'+
  '.xp-home{display:flex;gap:12px;align-items:flex-start}.xp-home img{width:46px;height:46px;border-radius:10px;flex:none}.xp-home p{margin:0;font-size:14px}.xp-home .x{margin-left:auto;background:none;border:0;color:var(--meta);font-size:22px;line-height:1;min-width:40px;min-height:40px}'+
  '.xp-rv{position:fixed;inset:0;z-index:60;background:#14110F;color:#fff;display:flex;flex-direction:column}'+
  '.xp-rv .stage{flex:1;position:relative;overflow:hidden}.xp-rv .sl{position:absolute;inset:0;opacity:0;transition:opacity .9s ease}.xp-rv .sl.on{opacity:1}'+
  '.xp-rv .sl img{width:100%;height:100%;object-fit:cover;transform:scale(1.08);transition:transform 4.5s ease-out}.xp-rv .sl.on img{transform:scale(1)}'+
  '.xp-rv .cap{position:absolute;left:0;right:0;bottom:0;padding:60px 20px 26px;background:linear-gradient(transparent,rgba(0,0,0,.7))}.xp-rv .cap small{font:600 11px/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;opacity:.8}.xp-rv .cap b{display:block;font:700 30px/1.15 var(--serif);margin-top:6px}'+
  '.xp-rv .end{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;opacity:0;transition:opacity .9s;pointer-events:none}.xp-rv .end.on{opacity:1;pointer-events:auto}.xp-rv .end h2{color:#fff;font:700 32px/1.2 var(--serif)}.xp-rv .end p{opacity:.8;margin:10px 0 22px}'+
  '.xp-rv .top{display:flex;justify-content:space-between;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 8px;gap:10px}.xp-rv .dots{display:flex;gap:4px;flex:1}.xp-rv .dots i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3)}.xp-rv .dots i.on{background:#fff}'+
  '.xp-rv .close{background:none;border:0;color:#fff;font-size:28px;min-width:44px;min-height:44px}'+
  '.xp-rv .btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.xp-rv .btns .btn{min-width:150px}.xp-rv .btn.ghost{background:transparent;border:2px solid rgba(255,255,255,.6);color:#fff}'+
  '@media (prefers-reduced-motion:reduce){.xp-rv .sl img{transition:none;transform:none}}';

  function sec(id,icon,title,inner,sub){ return '<section class="blk xplus" id="'+id+'"><h2>'+ic(icon)+'<span>'+title+'</span></h2>'+(sub?'<p class="sub sec-sub">'+sub+'</p>':'')+inner+'</section>'; }

  // ---------- before the clean ----------
  function steps(j,data){
    var P=j.plus, c=data.client||{}, b=j.billing, n=daysTo(P.firstDay), out=[];
    out.push({ok:true,t:'Booked',s:'Your booking is in.'});
    var dep=b&&b.items.filter(function(x){return x.deposit;})[0];
    if(dep) out.push({ok:dep.state==='paid',t:'Deposit',s:dep.state==='paid'?'Paid. Your date is locked in.':'Paying the deposit locks in your date.',href:dep.state!=='paid'&&dep.href?dep.href:''});
    out.push({ok:!!c.access,t:'How we get in',s:c.access?'Saved. The team has your details.':'Add keys, parking and pets below.'});
    out.push({ok:j.team.length>0,t:'Your team',s:j.team.length?j.team.map(function(t){return t.name;}).join(' and ')+(j.team.length>1?' are':' is')+' looking after your home.':'Jack confirms your team closer to the day.'});
    out.push({ok:false,t:'Clean day',s:longDay(P.firstDay)+(j.days&&j.days.length>1?' · '+j.days.length+' days':'')});
    var now=out.findIndex(function(x){return !x.ok;});
    var h='<div class="panel">';
    if(n>0) h+='<div class="xp-count"><b>'+n+'</b><span>day'+(n===1?'':'s')+' until your clean</span></div>';
    else if(n===0) h+='<div class="xp-count"><b>Today</b><span>The team will be there '+hm(j.start)+'</span></div>';
    h+='<ol class="xp-steps">'+out.map(function(x,i){ return '<li class="'+(x.ok?'ok':i===now?'now':'')+'"><span class="d">'+(x.ok?'✓':'')+'</span><div><b>'+esc(x.t)+'</b><span>'+esc(x.s)+'</span>'+(x.href?'<div style="margin-top:8px"><a class="btn primary" style="min-height:42px" href="'+esc(x.href)+'">Pay the deposit</a></div>':'')+'</div></li>'; }).join('')+'</ol></div>';
    return sec('xp-steps','calendar','Getting <em>ready</em>',h);
  }
  function prep(j){
    var P=j.plus, it=P.prep.items, tk=P.prep.ticks||{}, n=it.filter(function(x){return tk[x.id];}).length;
    var h='<div class="panel"><div class="xp-meter" aria-hidden="true"><i style="width:'+Math.round(n/it.length*100)+'%"></i></div><p class="sub" style="margin:0 0 4px">'+n+' of '+it.length+' done'+(n===it.length?'. You\'re all set.':'')+'</p><ul class="xp-prep">'+
      it.map(function(x){ return '<li><label><input type="checkbox" data-xprep="'+esc(x.id)+'"'+(tk[x.id]?' checked':'')+'><span><b>'+esc(x.t)+'</b>'+(x.d?'<small>'+esc(x.d)+'</small>':'')+'</span></label></li>'; }).join('')+'</ul></div>';
    return sec('xp-prep','clipboard','Before we <em>arrive</em>',h,'Tick these off as you go. It helps the team get straight into it.');
  }
  function keydate(j){
    var P=j.plus, k=P.keydate, last=P.lastDay, h='<div class="panel">';
    if(k && !C.kdEdit){
      var warn=k.date<last?'That\'s before we finish. Jack will be in touch about timing.':k.date===last?'That\'s the same day we finish. Jack will check timing with you.':'';
      h+='<div class="xp-ok"><i>✓</i><span>'+esc(k.what)+': '+esc(longDay(k.date))+'</span></div>'+(warn?'<p class="err" style="margin:8px 0 0">'+warn+'</p>':'<p class="sub" style="margin:8px 0 0">We\'ll be finished before then.</p>')+'<button type="button" class="btn outline" style="margin-top:12px;width:100%" data-xkdedit>Change</button>';
    } else {
      h+='<form class="cform" data-xform="kd" novalidate><label>What\'s happening<select name="what">'+P.keyOpts.map(function(o){ return '<option'+(k&&k.what===o?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select></label><label>Date<input type="date" name="date" value="'+esc(k?k.date:'')+'" min="'+today()+'"></label><div class="err" hidden></div><button class="btn primary" type="submit">Save</button></form>';
    }
    return sec('xp-kd','calendar',(P.kind==='presale'?'Your open home or <em>photo day</em>':P.kind==='bond'?'Your handover <em>date</em>':'Anything on <em>after?</em>'),h+'</div>',P.kind==='presale'?'So we can make sure the home is ready in time.':P.kind==='bond'?'So we finish well before the keys go back.':'If you have something on soon after, let us know.');
  }
  function alerts(j){
    var A=j.plus.alerts; if(!A) return '';
    var h='<div class="panel">';
    if(A.on) h+='<div class="xp-ok"><i>✓</i><span>We\'ll text '+esc(A.phone)+'</span></div><p class="sub" style="margin:8px 0 0">One text when the team arrives and one when it\'s finished. Nothing else.</p><button type="button" class="btn outline" style="margin-top:12px;width:100%" data-xalertsoff>Stop the texts</button>';
    else h+='<form class="cform" data-xform="alerts" novalidate><p class="note">Get one text when the team arrives and one when it\'s finished. Nothing else.</p><label>Your mobile<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx"></label><div class="err" hidden></div><button class="btn primary" type="submit">Text me those two updates</button></form>';
    return sec('xp-alerts','phone','Text me <em>updates</em>',h+'</div>');
  }

  // ---------- on the day ----------
  function feed(j,ph){
    var P=j.plus, M=P.moments||[]; if(!M.length && ph!=='live') return '';
    var seen=C.seen||{}, h='';
    if(P.finish && ph==='live') h+='<div class="xp-fin">'+ic('timer',22)+'<div><b>'+(P.finish.set?'Finishing around '+hm(P.finish.set):'Likely finishing '+hm(P.finish.from)+' to '+hm(P.finish.to))+'</b><span>'+(P.finish.set?'Set by Jack.':'An estimate from the areas still to go. It updates as the team works.')+'</span></div></div>';
    if(!M.length) h+='<div class="panel sub">Updates appear here as the team works through each area.</div>';
    else {
      var list=!C.feedAll?M.slice(0,ph==='done'?6:5):M;
      h+='<div class="panel"><ul class="xp-feed" aria-live="polite">'+list.map(function(m){ var key=m.k+m.at; var isNew=C.seenInit&&!seen[key]; seen[key]=1;
        return '<li class="k-'+m.k+(isNew?' new':'')+'"><time>'+clock(m.at)+(new Date(m.at).toDateString()!==new Date().toDateString()?'<br><small>'+DOW[new Date(m.at).getDay()]+'</small>':'')+'</time><div><b>'+esc(m.t)+'</b>'+(m.sub?'<small>'+esc(m.sub)+'</small>':'')+'</div>'+(m.photo?'<img alt="'+esc(m.room||'')+' after" loading="lazy" src="'+photo(m.photo.j,m.photo.id,true)+'">':'<span></span>')+'</li>'; }).join('')+'</ul>'+
        (M.length>list.length?'<button type="button" class="btn outline" style="width:100%;margin-top:10px" data-xfeedall>Show the whole day ('+M.length+')</button>':'')+'</div>';
      C.seen=seen; C.seenInit=true;
    }
    return sec('xp-feed',ph==='live'?'clock':'clipboard',ph==='live'?'Happening <em>now</em>':'How the day <em>went</em>',h);
  }
  function addons(j){
    var A=(j.plus.addons||[]); if(!A.length) return '';
    var pend=A.filter(function(a){return a.state==='pending';}), done=A.filter(function(a){return a.state!=='pending';});
    var h=pend.map(function(a){ return '<div class="xp-addon"><span class="sub">The team found something worth doing</span><h3>'+esc(a.title)+'</h3><div class="pr">'+money(a.price)+' <span class="sub">inc GST</span></div>'+(a.note?'<p style="margin:0;font-size:14px">'+esc(a.note)+'</p>':'')+'<div class="row"><button type="button" class="btn primary" data-xaddon="'+esc(a.id)+'" data-yes="1">Yes, go ahead</button><button type="button" class="btn outline" data-xaddon="'+esc(a.id)+'">No thanks</button></div><p class="sub" style="margin:8px 0 0">If you say yes, it\'s added to your invoice.</p></div>'; }).join('');
    h+=done.map(function(a){ return '<div class="xp-addon done"><div class="xp-pay"><span><b style="font:600 15px var(--sans)">'+esc(a.title)+'</b><br><span class="sub">'+(a.state==='approved'?'Approved':'Declined')+' '+clock(a.decidedAt)+'</span></span><span>'+money(a.price)+'</span></div></div>'; }).join('');
    return sec('xp-addons','flag',pend.length?'Your <em>OK</em> needed':'Extras',h);
  }

  // ---------- after the clean ----------
  function signoff(j){
    var S=j.plus.signoff, h='<div class="panel">';
    if(S) h+='<div class="xp-ok"><i>✓</i><span>Signed off '+clock(S.at)+', '+fmtDay(S.at.slice(0,10))+(S.name?' by '+esc(S.name):'')+'</span></div><p class="sub" style="margin:8px 0 0">Thank you. Jack has been told.</p>';
    else h+='<p style="margin:0 0 12px">Had a look through? Tap below to sign off on the clean. If anything isn\'t right, use "Something\'s not right" instead and Jack will sort it out.</p><form class="cform" data-xform="signoff" novalidate><label>Your name <small>Optional</small><input name="name" autocomplete="name"></label><button class="btn primary" type="submit">I\'m happy with the clean</button></form>';
    return sec('xp-sign','check','Sign <em>off</em>',h+'</div>');
  }
  function pay(j){
    var b=j.billing; if(!b||!(b.owing>0.5)) return '';
    var inv=b.items.filter(function(x){return x.kind==='invoice'&&x.due>0&&x.href&&!x.deposit;})[0]||b.items.filter(function(x){return x.kind==='invoice'&&x.due>0&&x.href;})[0];
    if(!inv) return '';
    return sec('xp-pay','money','Your <em>balance</em>','<div class="panel"><div class="xp-pay"><span><span class="sub">Left to pay</span><br><b>'+money(inv.due)+'</b></span><a class="btn primary" href="'+esc(inv.href)+'">Pay now</a></div><p class="sub" style="margin:10px 0 0">Card or bank transfer. Invoice #'+esc(inv.num)+'.</p></div>');
  }
  function revealBtn(j){
    var n=revealList(j).length; if(n<2) return '';
    return '<div class="actions" style="margin-top:12px"><button type="button" class="btn dark" data-xreveal>▶ Watch the reveal</button></div>';
  }
  function revealList(j){
    var seen={}, out=[]; (j.live.photos||[]).forEach(function(p){ if(p.kind==='after'&&!seen[p.room]){ seen[p.room]=1; out.push(p); } });
    var order=j.rooms||[]; out.sort(function(a,b){ return order.indexOf(a.room)-order.indexOf(b.room); });
    return out;
  }
  function bond(j,ph){
    if(j.plus.kind!=='bond') return '';
    var E=j.plus.entry||[], h='<div class="panel">';
    h+='<p style="margin:0 0 10px">Upload the entry condition report from when you moved in (a PDF, or photos of each page). '+(ph==='done'?'Then download your evidence pack: our report laid out area by area, with the after photos, ready to give your property manager.':'Once the clean is done, you can download an evidence pack: our report laid out area by area with the after photos.')+'</p>';
    if(E.length) h+=E.map(function(f){ return '<div class="xp-file"><a href="/api/plus?entry='+esc(f.id)+'&v='+esc(C.cred)+'" target="_blank" rel="noopener">'+esc(f.name)+'</a><button type="button" data-xentrydel="'+esc(f.id)+'">Remove</button></div>'; }).join('');
    h+='<label class="btn outline" style="width:100%;margin-top:12px;cursor:pointer">'+(saving.entry?'Uploading…':E.length?'Add more pages':'Upload entry report')+'<input type="file" accept="application/pdf,image/*" multiple hidden data-xentry></label>';
    if(ph==='done') h+='<a class="btn primary" style="width:100%;margin-top:10px" href="/pack/'+esc(C.cred)+'" target="_blank" rel="noopener">Open your bond evidence pack</a>';
    return sec('xp-bond','clipboard','Your bond <em>evidence</em>',h+'</div>');
  }
  function referral(j,data){
    var fb=(data.client||{}).feedback, so=j.plus.signoff; if(!(fb&&fb.mood==='happy')&&!so) return '';
    var h='<div class="panel"><p style="margin:0 0 12px">Know someone selling, moving or after a proper deep clean? Send them your personal link. Jack will know they came from you.</p>';
    h+=j.plus.ref?'<div class="xp-row"><button type="button" class="btn primary" data-xrefshare>Share your link</button></div>':'<button type="button" class="btn primary" style="width:100%" data-xref>Get your personal link</button>';
    return sec('xp-ref','heart','Pass it <em>on</em>',h+'</div>');
  }

  // ---------- everywhere ----------
  function homeFile(j){
    var P=j.plus, H=P.history||[];
    var h='<div class="panel">';
    if(!C.viewer){
      h+='<form class="cform" data-xform="prefs" novalidate><label>Things we should always know about your home <small>Products to avoid, surfaces to be careful with, how you like things left</small><textarea name="prefs" rows="3">'+esc(P.prefs||'')+'</textarea></label><div class="err" hidden></div><button class="btn outline" type="submit">Save home notes</button></form>';
    }
    if(H.length) h+='<h3 style="font:600 14px var(--sans);color:var(--dark);margin:'+(C.viewer?'0':'16px')+' 0 4px">Cleans at this home</h3><ul class="xp-hist">'+H.map(function(x){ return '<li><span>'+esc(x.service)+'<br><span class="sub">'+esc(longDay(x.date))+'</span></span>'+(x.href?'<a href="'+esc(x.href)+'">Report ›</a>':'')+'</li>'; }).join('')+'</ul>';
    if(C.viewer&&!H.length) return '';
    return sec('xp-home','home','Your home <em>file</em>',h+'</div>');
  }
  function shareView(j){
    if(C.viewer) return '';
    return sec('xp-share','team','Share with <em>someone</em>','<div class="panel"><p style="margin:0 0 12px">Send a view-only copy to your partner, agent or landlord. They see the progress and photos. Prices, access details and the forms stay with you.</p><button type="button" class="btn outline" style="width:100%" data-xshare>Share a view-only link</button></div>');
  }
  function homeScreen(){
    if(C.demo) return '';
    var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
    if(standalone||ls('bc_a2hs_off')) return '';
    var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
    var how=deferredInstall?'<button type="button" class="btn primary" style="margin-top:10px" data-xinstall>Add to home screen</button>':ios?'<p>In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>.</p>':'<p>In your browser menu, tap <b>Add to Home screen</b>.</p>';
    return '<div class="panel" style="margin-top:24px"><div class="xp-home"><img src="/icons/brand-apple-touch-icon.png" alt=""><div><b style="color:var(--dark)">Keep your clean one tap away</b>'+how+'</div><button type="button" class="x" aria-label="Hide" data-xa2hsoff>×</button></div></div>';
  }

  function html(where,j,ph,data){
    if(!j||!j.plus) return '';
    var V=!C.viewer, h='';
    if(where==='glance'){
      if(ph==='booked'&&V) h+=steps(j,data);
      if(ph==='live') h+=feed(j,ph);
      if(V) h+=addons(j);
      if(ph==='done'){ if(V){ h+=revealBtn(j); h+=pay(j); } }
      if(ph==='done'&&!V) h+=revealBtn(j);
    } else if(where==='booked'){
      if(V){ h+=prep(j); h+=keydate(j); h+=alerts(j); h+=bond(j,ph); }
    } else if(where==='done'){
      if(V){ h+=signoff(j); h+=bond(j,ph); h+=referral(j,data); }
      h+=feed(j,ph);
    } else if(where==='end'){
      if(ph==='live'&&V) h+=keydate(j);
      h+=homeFile(j); h+=shareView(j); h+=homeScreen();
    }
    return h;
  }

  // ---------- reveal ----------
  function openReveal(j){
    var L=revealList(j); if(!L.length) return;
    var el=document.createElement('div'); el.className='xp-rv'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','The reveal');
    el.innerHTML='<div class="top"><div class="dots">'+L.map(function(){return '<i></i>';}).join('')+'<i></i></div><button class="close" aria-label="Close" data-xrvclose>×</button></div><div class="stage">'+
      L.map(function(p){ return '<div class="sl"><img alt="'+esc(p.room)+' after" src="'+photo(p.j,p.id)+'"><div class="cap"><small>After</small><b>'+esc(p.room)+'</b></div></div>'; }).join('')+
      '<div class="end"><div><h2>'+esc(j.readyBy?'Ready for '+j.readyBy:'Ready')+'</h2><p>'+esc(String(j.address||j.suburb||'').replace(/^Sample:\s*/,''))+' · '+L.length+' areas</p><div class="btns">'+(C.viewer?'':'<button type="button" class="btn primary" data-xrvshare>Share it</button>')+'<button type="button" class="btn ghost" data-xrvagain>Watch again</button><button type="button" class="btn ghost" data-xrvclose>Close</button></div></div></div></div>';
    document.body.appendChild(el); document.body.style.overflow='hidden';
    reveal={el:el,i:-1,timer:0,n:L.length};
    revealGo(0);
    try{ history.pushState({xrv:1},''); }catch(e){}
  }
  function revealGo(i){
    if(!reveal) return; clearTimeout(reveal.timer); reveal.i=i;
    var sl=reveal.el.querySelectorAll('.sl'), dots=reveal.el.querySelectorAll('.dots i'), end=reveal.el.querySelector('.end');
    for(var k=0;k<sl.length;k++) sl[k].classList.toggle('on',k===i);
    for(var d=0;d<dots.length;d++) dots[d].classList.toggle('on',d<=i);
    end.classList.toggle('on',i>=reveal.n);
    if(i<reveal.n) reveal.timer=setTimeout(function(){ revealGo(i+1); },3600);
  }
  function closeReveal(back){ if(!reveal) return; clearTimeout(reveal.timer); reveal.el.remove(); reveal=null; document.body.style.overflow=''; if(back){ try{ if(history.state&&history.state.xrv) history.back(); }catch(e){} } }
  window.addEventListener('popstate',function(){ if(reveal) closeReveal(false); });

  // ---------- taps and forms ----------
  function job(){ return C.job&&C.job(); }
  function post(body){ return C.post(body); }
  function after(p,ok){ p.then(function(d){ ok(d); dirty=false; C.redraw(); }).catch(function(e){ toast(e.message||'Something went wrong'); C.redraw(); }); }
  function demoNote(){ toast('Demo only. Nothing was saved.'); }

  document.addEventListener('change',function(e){
    var t=e.target, j=job(); if(!j||!j.plus) return;
    if(t.dataset&&t.dataset.xprep){ if(C.demo){ demoNote(); return; } var id=t.dataset.xprep, v=t.checked; j.plus.prep.ticks[id]=v?new Date().toISOString():undefined; if(!v) delete j.plus.prep.ticks[id];
      after(post({action:'x-prep',v:C.cred,id:id,value:v}),function(d){ j.plus.prep.ticks=d.ticks; }); return; }
    if(t.hasAttribute&&t.hasAttribute('data-xentry')){ if(C.demo){ demoNote(); return; } var files=[].slice.call(t.files||[]).slice(0,10); if(!files.length) return; saving.entry=true; C.redraw();
      var chain=Promise.resolve();
      files.forEach(function(f){ chain=chain.then(function(){ return readFile(f).then(function(data){ return post({action:'x-entry',v:C.cred,name:f.name,data:data}); }).then(function(d){ j.plus.entry=d.entry; }); }); });
      chain.then(function(){ toast('Uploaded'); }).catch(function(x){ toast(x.message||'Upload failed'); }).then(function(){ saving.entry=false; C.redraw(); }); }
  });
  function readFile(f){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onerror=function(){ rej(new Error('Couldn\'t read that file')); };
      r.onload=function(){
        if(f.type==='application/pdf') return res(r.result);
        var img=new Image(); img.onload=function(){ var s=Math.min(1,2000/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',0.82)); };
        img.onerror=function(){ res(r.result); }; img.src=r.result;
      };
      r.readAsDataURL(f);
    });
  }
  document.addEventListener('input',function(e){ if(e.target.closest&&e.target.closest('[data-xform]')) dirty=true; });
  document.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return; var j=job();
    if(b.hasAttribute('data-xrvclose')){ closeReveal(true); return; }
    if(b.hasAttribute('data-xrvagain')){ revealGo(0); return; }
    if(b.hasAttribute('data-xrvshare')){ shareLink(j,'Have a look at the clean'); return; }
    if(!j||!j.plus) return;
    if(b.hasAttribute('data-xreveal')){ openReveal(j); return; }
    if(b.hasAttribute('data-xkdedit')){ C.kdEdit=true; C.redraw(); return; }
    if(b.hasAttribute('data-xfeedall')){ C.feedAll=true; C.redraw(); return; }
    if(b.hasAttribute('data-xa2hsoff')){ ls('bc_a2hs_off','1'); C.redraw(); return; }
    if(b.hasAttribute('data-xinstall')&&deferredInstall){ deferredInstall.prompt(); deferredInstall=null; return; }
    if(b.hasAttribute('data-xshare')){ shareLink(j,'Follow the clean'); return; }
    if(C.demo&&(b.dataset.xaddon||b.hasAttribute('data-xalertsoff')||b.hasAttribute('data-xref')||b.hasAttribute('data-xrefshare')||b.dataset.xentrydel)){ demoNote(); return; }
    if(b.dataset.xaddon){ b.disabled=true; after(post({action:'x-addon',v:C.cred,id:b.dataset.xaddon,decision:b.dataset.yes?'yes':'no'}),function(d){ j.plus.addons=d.addons; toast(b.dataset.yes?'Thanks. The team will go ahead.':'No worries. Jack has been told.'); }); return; }
    if(b.hasAttribute('data-xalertsoff')){ after(post({action:'x-alerts',v:C.cred,on:false}),function(d){ j.plus.alerts=d.alerts; }); return; }
    if(b.hasAttribute('data-xref')){ after(post({action:'x-ref',v:C.cred}),function(d){ j.plus.ref=d.link; share(d.link,'Bardon Clean','I used Bardon Clean and they were great. Here\'s their quote form:'); }); return; }
    if(b.hasAttribute('data-xrefshare')){ share(j.plus.ref,'Bardon Clean','I used Bardon Clean and they were great. Here\'s their quote form:'); return; }
    if(b.dataset.xentrydel){ after(post({action:'x-entry-del',v:C.cred,id:b.dataset.xentrydel}),function(d){ j.plus.entry=d.entry; }); return; }
  });
  function shareLink(j,text){
    if(C.viewer){ share(location.pathname,'Bardon Clean',text); return; }
    if(C.demo){ share(location.pathname,'Bardon Clean',text); return; }
    if(j.plus.viewLink){ share(j.plus.viewLink,'Bardon Clean',text+':'); return; }
    post({action:'x-share',v:C.cred}).then(function(d){ j.plus.viewLink=d.link; share(d.link,'Bardon Clean',text+':'); }).catch(function(x){ toast(x.message); });
  }
  document.addEventListener('submit',function(e){
    var f=e.target, k=f.dataset&&f.dataset.xform; if(!k) return; e.preventDefault();
    var j=job(); if(!j||!j.plus) return; var er=f.querySelector('.err'), bt=f.querySelector('[type=submit]');
    function fail(x){ if(er){ er.textContent=x.message; er.hidden=false; } if(bt) bt.disabled=false; }
    if(C.demo){ demoNote(); dirty=false; if(k==='kd'){ j.plus.keydate={date:f.elements.date.value,what:f.elements.what.value}; C.kdEdit=false; } if(k==='signoff') j.plus.signoff={at:new Date().toISOString(),name:f.elements.name.value}; C.redraw(); return; }
    if(bt) bt.disabled=true;
    var body;
    if(k==='kd') body={action:'x-keydate',v:C.cred,date:f.elements.date.value,what:f.elements.what.value};
    else if(k==='alerts') body={action:'x-alerts',v:C.cred,on:true,phone:f.elements.phone.value};
    else if(k==='signoff') body={action:'x-signoff',v:C.cred,name:f.elements.name.value};
    else if(k==='prefs') body={action:'x-prefs',v:C.cred,prefs:f.elements.prefs.value};
    else return;
    post(body).then(function(d){
      if(k==='kd'){ j.plus.keydate=d.keydate; C.kdEdit=false; toast('Saved. Jack can see it.'); }
      if(k==='alerts') j.plus.alerts=d.alerts;
      if(k==='signoff'){ j.plus.signoff=d.signoff; toast('Thank you'); }
      if(k==='prefs'){ j.plus.prefs=d.prefs; toast('Saved to your home file'); }
      dirty=false; C.redraw();
    }).catch(fail);
  });
  window.addEventListener('beforeinstallprompt',function(e){ e.preventDefault(); deferredInstall=e; if(C.redraw) C.redraw(); });

  window.BCPlus={
    init:function(o){ C=Object.assign(C,o||{});
      if(!document.getElementById('xp-css')){ var st=document.createElement('style'); st.id='xp-css'; st.textContent=CSS; document.head.appendChild(st); }
      // A home-screen icon that opens straight to this clean.
      if(!C.viewer&&!C.demo&&C.cred&&!document.querySelector('link[rel=manifest]')){ var l=document.createElement('link'); l.rel='manifest'; l.href='/api/plus?manifest='+encodeURIComponent(C.cred); document.head.appendChild(l); }
    },
    html:html,
    busy:function(){ var a=document.activeElement; return dirty||!!reveal||!!(a&&a.closest&&a.closest('[data-xform]')); }
  };
})();
