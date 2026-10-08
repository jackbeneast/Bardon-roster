// Booking confirmation text + email, shared by the hub and the quotes page.
// BCConfirm.build({job, doc, deposit, origin, phone}) -> {sms, subject, email}
(function(){
  var MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function parse(s){ var p=s.split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
  function longDay(s){ var d=parse(s); return DAY[d.getDay()]+' '+d.getDate()+' '+MON[d.getMonth()]; }
  function shortDay(s){ var d=parse(s); return DAY[d.getDay()].slice(0,3)+' '+d.getDate()+' '+MON[d.getMonth()].slice(0,3); }
  function time(t){ if(!t) return ''; var h=+t.slice(0,2), m=t.slice(3,5); return (h%12||12)+(m==='00'?'':':'+m)+(h>=12?'pm':'am'); }
  function money(v){ return '$'+(+v||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function first(n){ return String(n||'').trim().split(/\s+/)[0]||'there'; }

  function build(o){
    var j=o.job, d=o.doc||null, dep=o.deposit||null, origin=o.origin||location.origin, phone=o.phone||'0406 216 212', text=o.sms||'0468 193 772';
    var who=first(d&&(d.client.contact||d.client.name)||j.client);
    var place=[j.address,j.suburb].filter(Boolean).join(', ');
    var size=d&&(d.beds||d.baths)?' ('+[d.beds?d.beds+' bed':'',d.baths?d.baths+' bath':''].filter(Boolean).join(', ')+')':'';
    var live=j.share?origin+'/v/'+j.share:'';
    var depLine='', depSms='';
    if(dep){
      var paid=dep.state==='paid';
      depLine=paid?'Deposit of '+money(dep.totals.paid)+' received. Thank you, your booking is locked in.'
        :'Deposit of '+money(dep.totals.due)+' is due now. Your booking is tentative until it\'s paid:\n'+origin+'/i/'+dep.token;
      depSms=paid?'Deposit received, you\'re locked in.':'Deposit '+money(dep.totals.due)+' due now to lock it in: '+origin+'/i/'+dep.token;
    }
    var balance='';
    if(d&&d.totals){ var bal=d.totals.total-(dep?dep.totals.total:0); if(bal>0.005) balance='Balance of '+money(bal)+' (incl. GST) is due on completion.'; }

    var days=(j.days&&j.days.length>1)?j.days:null;
    var whenSms=days?days.map(function(x){ return shortDay(x.date)+', '+time(x.start)+(x.end?' to '+time(x.end):''); }).join('\n'):shortDay(j.date)+', team arrives '+time(j.start);
    var locked=!dep||dep.state==='paid';
    var sms='Hi '+who+', '+(locked?'your Bardon Clean booking is confirmed.':'here are your Bardon Clean booking details.')+'\n\n'+
      j.service+size+(days?' over '+days.length+' days':'')+'\n'+whenSms+'\n'+(place?place+'\n':'')+
      (depSms?'\n'+depSms+'\n':'')+
      (live?'\nFollow your clean live, with before and after photos:\n'+live+'\n':'')+
      '\nAny questions, text me on '+text+'.\nJack';

    var subject=(locked?'Booking confirmed: ':'Your booking: ')+j.service+', '+shortDay(j.date)+(days?' to '+shortDay(days[days.length-1].date):'')+(place?' · '+(j.address||j.suburb):'');
    var L=[];
    L.push('Hi '+who+',','',locked?'Thanks for booking Bardon Clean. Your clean is confirmed. Here are the details.':'Thanks for booking Bardon Clean. Here are the details. Your booking is tentative until the deposit is paid.','');
    if(days){ L.push('WHEN ('+days.length+' DAYS)'); days.forEach(function(x){ L.push(longDay(x.date)+': team arrives '+time(x.start)+(x.end?', finishing around '+time(x.end):'')); }); L.push(''); }
    else L.push('WHEN',longDay(j.date),'Team arrives '+time(j.start)+(j.end?', finishing around '+time(j.end):''),'');
    if(place) L.push('WHERE',place,'');
    L.push('SERVICE',j.service+size,'');
    if(j.readyBy) L.push('READY FOR',j.readyBy,'');
    if(depLine||balance){ L.push('PAYMENT'); if(depLine) L.push(depLine); if(balance) L.push(balance); L.push(''); }
    if(live) L.push('FOLLOW YOUR CLEAN LIVE',live,'Open this on the day to see when the team arrives, each room as it\'s finished, and before and after photos.','');
    L.push('BEFORE WE ARRIVE',
      '- Let us know how we\'ll get in (keys, lockbox or someone home), if we haven\'t sorted it already.',
      '- Please have the power and water on.',
      '- Tell us about any pets, alarms or hazards at the property.','');
    L.push('Need to change anything? Text me on '+text+' or call '+phone+'. Please give us at least 24 hours\' notice for any changes.','','Thanks,','Jack East','Bardon Clean · bardonclean.au');
    return {sms:sms, subject:subject, email:L.join('\n')};
  }
  // A multi-day booking is several roster jobs sharing a group id. Give the first day a list of all days.
  function withDays(j, all){
    if(!j||!j.group) return j;
    var g=(all||[]).filter(function(x){return x.group===j.group;}).sort(function(a,b){return (a.date+(a.start||'')).localeCompare(b.date+(b.start||''));});
    if(g.length<2) return j;
    var o={}; for(var k in g[0]) o[k]=g[0][k];
    o.days=g.map(function(x){return {date:x.date,start:x.start,end:x.end};});
    return o;
  }
  window.BCConfirm={build:build, withDays:withDays};
})();
