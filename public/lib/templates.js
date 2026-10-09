// Client text templates, shared by Messages, Quotes & Invoices and the hub.
// BCTpl.load(key) -> Promise<{sections, vars, templates, reviewLink}>
// BCTpl.get(id) -> template or null (after load)
// BCTpl.fill(text, vars) -> {text, missing[]}   (mirrors fill() in lib/templates.mjs)
// BCTpl.varsFor({quote, invoice, job, jobs, name, phone, payment, reviewLink, origin}) -> vars
// BCTpl.lint(text) -> [warning strings]
(function(){
  var data=null, pending=null;
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function key(k){ if(k) return k; try{ return localStorage.getItem('roster_admin_key')||''; }catch(e){ return ''; } }
  function load(k, force){
    if(data&&!force) return Promise.resolve(data);
    if(pending&&!force) return pending;
    pending=fetch('/api/templates',{headers:{'x-admin-key':key(k)},cache:'no-store'}).then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||'Couldn\'t load templates'); data=d; pending=null; return d; }); })
      .catch(function(e){ pending=null; throw e; });
    return pending;
  }
  function set(d){ data=d; }
  function get(id){ if(!data) return null; for(var i=0;i<data.templates.length;i++) if(data.templates[i].id===id) return data.templates[i]; return null; }
  function has(v,k){ return v[k]!=null && String(v[k]).trim()!==''; }
  function linksOnOwnLine(t){
    return t.split('\n').map(function(line){ return line.replace(/(https?:\/\/[^\s]+?)([.,;:!?)\]]*)(\s+\S.*)?$/,function(m,url,p,rest){ return rest?url+'\n'+rest.trim():url; }); }).join('\n');
  }
  function fill(text, v){
    v=v||{}; var missing=[];
    var paras=String(text||'').split(/\n{2,}/).filter(function(p){ var re=/\{(\w+)\?\}/g, m, ok=true; while((m=re.exec(p))) if(!has(v,m[1])) ok=false; return ok; });
    var out=paras.join('\n\n').replace(/\{(\w+)\??\}/g,function(m,k){ if(has(v,k)) return String(v[k]); if(missing.indexOf(k)<0) missing.push(k); return '{'+k+'}'; });
    return {text:linksOnOwnLine(out).trim(), missing:missing};
  }
  function lint(text){
    var w=[], lines=String(text||'').split('\n');
    lines.forEach(function(l){
      var m=l.match(/\{(\w+_link)\??\}/); if(!m) return;
      if(l.replace(/\{\w+_link\??\}/,'').trim()) w.push('Put {'+m[1]+'} on its own line, with nothing before or after it, so it shows as a tappable link.');
    });
    var known=data?data.vars.map(function(x){return x[0];}):null, re=/\{(\w+)\??\}/g, m;
    while(known&&(m=re.exec(text))){ if(known.indexOf(m[1])<0&&['alt_date','minutes'].indexOf(m[1])<0) w.push('{'+m[1]+'} isn\'t filled in automatically. You\'ll type it each time.'); }
    if(/\bwithin\s+\d+\s*(min|minute|hour|hr)/i.test(text)) w.push('This promises a timed turnaround.');
    return w.filter(function(x,i){ return w.indexOf(x)===i; });
  }

  // ---- variables from real records ----
  function pd(s){ var p=String(s).split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function day(s){ if(!s) return ''; var d=pd(s); return DOW[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]; }
  function time(t){ if(!t) return ''; var h=+t.slice(0,2), m=t.slice(3,5); return (h%12||12)+(m==='00'?'':':'+m)+(h>=12?'pm':'am'); }
  function money(v){ return '$'+(+v||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function first(n){ return String(n||'').replace(/\(.*?\)/g,'').trim().split(/\s+/)[0]||''; }
  function hours(a,b){ if(!a||!b) return ''; var m=(+b.slice(0,2)*60+ +b.slice(3,5))-(+a.slice(0,2)*60+ +a.slice(3,5)); if(m<=0) return ''; var h=m/60; return (h%1?h.toFixed(1):h)+' hour'+(h===1?'':'s'); }
  function varsFor(o){
    o=o||{}; var v={}, origin=o.origin||location.origin, q=o.quote||null, inv=o.invoice||null, j=o.job||null, d=inv||q;
    var nm=o.name||(d&&d.client&&(d.client.contact||d.client.name))||(j&&j.client)||'';
    v.name=nm; v.first=first(nm);
    var svc=(d&&d.service)||(j&&j.service)||o.service||'';
    if(svc&&svc!=='Other') v.service=svc.charAt(0).toLowerCase()+svc.slice(1);
    var src=q||inv;
    var size=src&&(src.beds||src.baths)?' ('+[src.beds?src.beds+' bed':'',src.baths?src.baths+' bath':''].filter(Boolean).join(', ')+')':'';
    if(svc&&svc!=='Other') v.service_size=svc+size;
    var addr=(j&&j.address)||(d&&(d.site||d.client&&d.client.address))||'';
    var sub=(j&&j.suburb)||(d&&d.suburb)||o.suburb||'';
    v.address=addr&&sub&&addr.toLowerCase().indexOf(sub.toLowerCase())<0?addr+', '+sub:(addr||sub);
    v.suburb=sub;
    if(j){
      v.date=day(j.date); v.time=time(j.start); v.duration=hours(j.start,j.end);
      var days=(o.jobs||[]).filter(function(x){ return j.group&&x.group===j.group; }).sort(function(a,b){ return (a.date+(a.start||'')).localeCompare(b.date+(b.start||'')); });
      v.when=days.length>1?days.map(function(x){ return day(x.date)+', '+time(x.start)+(x.end?' to '+time(x.end):''); }).join('\n'):day(j.date)+', team arrives '+time(j.start);
      if(j.share){ v.job_link=origin+'/v/'+j.share; v.report_link=v.job_link; }
    } else if(src&&src.serviceDate){ v.date=day(src.serviceDate); }
    if(q){ v.quote_no=String(q.num); v.quote_link=origin+'/q/'+q.token; if(q.totals){ v.quote_total=money(q.totals.total); if(q.totals.deposit) v.deposit=money(q.totals.deposit); } if(q.validUntil) v.valid_until=day(q.validUntil); }
    if(inv){ v.invoice_no=String(inv.num); v.invoice_link=origin+'/i/'+inv.token; if(inv.totals) v.amount_due=money(inv.totals.due); if(inv.dueDate) v.due_date=day(inv.dueDate); if(inv.isDeposit&&inv.totals&&!v.deposit) v.deposit=money(inv.totals.total); }
    if(o.payment&&inv){ var P=inv.payments||[], i=P.map(function(x){return x.id;}).indexOf(o.payment.id), upTo=P.slice(0,i+1).reduce(function(a,x){return a+x.amt;},0);
      v.paid=money(o.payment.amt); v.balance=money(Math.max(0,(inv.totals?inv.totals.total:0)-upTo)); v.receipt_link=origin+'/r/'+inv.token+'?p='+o.payment.id; }
    v.quote_form_link=origin+'/quote';
    if(o.reviewLink||data&&data.reviewLink) v.review_link=o.reviewLink||data.reviewLink;
    return v;
  }
  window.BCTpl={load:load, set:set, get:get, fill:fill, lint:lint, varsFor:varsFor, get data(){ return data; }};
})();
