// Payslip maths and layout, shared by Team & pay (/team/) and the employee pay link (/pay/<token>).
// Same rules as the old Pay Run page:
//  - Cleaning Services Award 2020 casual rates from 1 July 2026 (Fair Work pay guide MA000022).
//    Your rate is used if it's higher than the award minimum for their level.
//  - Overtime past 7.6 hrs a day, 38 ordinary hrs a week, or any hours on a 6th day.
//    Mon–Sat 175% of base for the first 2 hrs then 225%, Sunday 225%, public holiday 275%
//    (or your normal rate for that day if higher).
//  - PAYG: ATO weekly withholding formula (Schedule 1) from 1 July 2026. No HELP.
//  - Super 12% of ordinary time earnings (overtime excluded).
(function(){
  var AWARD={1:[33.85,47.39,60.93,74.47],2:[34.96,48.95,62.93,76.92],3:[36.81,51.54,66.26,80.99]};
  var SC={
    1:[[188,.15,.15],[371,.2084,11.0185],[515,.179,.1066],[932,.3227,74.1674],[2246,.32,71.6508],[3303,.39,228.8816],[Infinity,.47,493.1893]],
    2:[[362,0,0],[538,.15,54.3462],[673,.25,108.2135],[721,.17,54.3473],[865,.179,60.8377],[1282,.3227,185.1935],[2596,.32,181.7319],[3653,.39,363.4627],[Infinity,.47,655.7704]],
    3:[[2596,.30,.30],[3653,.37,181.7308],[Infinity,.45,474.0385]]
  };
  var DEF={wk:37.5,el:37.91,sat:47.39,sun:60.93,ph:74.47};
  var LABEL={wk:'Ordinary hours, Mon–Fri',el:'Mon–Fri early/late shift',sat:'Saturday',sun:'Sunday',ph:'Public holiday'};
  var KIND={wk:'Weekday',el:'Weekday early/late',sat:'Saturday',sun:'Sunday',ph:'Public holiday'};
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function r2(v){ return Math.round(v*100)/100; }
  function dn(d){ return Math.round(Date.parse(d+'T00:00:00Z')/864e5); }
  function dow(d){ return new Date(d+'T00:00:00Z').getUTCDay(); }
  function money(v){ v=+v||0; return (v<0?'−':'')+'$'+Math.abs(v).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function hrs(v){ return (Math.round(v*100)/100)+''; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fdate(s){ if(!s) return '—'; var p=s.split('-'); return (+p[2])+' '+MON[+p[1]-1]+' '+p[0]; }
  function fshort(s){ var p=s.split('-'); return DOW[dow(s)]+', '+(+p[2])+' '+MON[+p[1]-1]; }

  function award(level){ var a=AWARD[level]||AWARD[1], base=a[0]/1.25; return {wk:a[0],el:r2(base*1.40),sat:a[1],sun:a[2],ph:a[3],ot1:r2(base*1.75),ot2:r2(base*2.25),otSun:r2(base*2.25),otPh:r2(base*2.75)}; }
  function rates(level, mine){ var A=award(level), m=Object.assign({},DEF,mine||{}), R={}; ['wk','el','sat','sun','ph'].forEach(function(k){ R[k]=Math.max(+m[k]||0,A[k]); }); return R; }
  function weeklyTax(gross,scale){ var x=Math.floor(gross)+0.99, row=(SC[scale]||SC[2]).filter(function(r){return x<r[0];})[0]; return Math.max(0,Math.round(row[1]*x-row[2])); }
  function tax(gross,scale,cycle){ return cycle===2?weeklyTax(gross/2,scale)*2:weeklyTax(gross,scale); }

  // shifts: [{date, hrs, kind}] inside the period. Returns {lines, gross, ordPay, hrs, otHrs, sup, taxAuto}
  function calc(o){
    var A=award(o.level), R=rates(o.level,o.rates), start=dn(o.periodStart), cycle=o.cycle===2?2:1;
    var map={}, order=[], reasons={day:0,week:0,sixth:0};
    function add(label,rate,h,ot){ if(h<=0.0001) return; var k=label+'|'+rate; if(!map[k]){ map[k]={label:label,rate:rate,hrs:0,ot:ot}; order.push(k); } map[k].hrs=r2(map[k].hrs+h); }
    var sh=(o.shifts||[]).filter(function(s){return s.hrs>0;}).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
    for(var w=0;w<cycle;w++){
      var wk=sh.filter(function(s){ return Math.floor((dn(s.date)-start)/7)===w; });
      var days=[]; wk.forEach(function(s){ if(days.indexOf(s.date)<0) days.push(s.date); });
      var weekOrd=0;
      days.forEach(function(d,di){
        var dayOrd=0, dayOT=0;
        wk.filter(function(s){return s.date===d;}).forEach(function(s){
          var ord=0, ot=0;
          if(di>=5){ ot=s.hrs; reasons.sixth+=s.hrs; }
          else { var dr=Math.max(0,7.6-dayOrd), wr=Math.max(0,38-weekOrd); ord=Math.min(s.hrs,dr,wr); ot=s.hrs-ord; var byDay=Math.min(ot,Math.max(0,s.hrs-dr)); reasons.day+=byDay; reasons.week+=ot-byDay; }
          dayOrd+=ord; weekOrd+=ord;
          var k=s.kind||'wk', rate=R[k];
          add(LABEL[k],rate,ord,false);
          if(ot>0){
            if(k==='ph') add('Overtime, public holiday',Math.max(A.otPh,rate),ot,true);
            else if(dow(s.date)===0) add('Overtime, Sunday',Math.max(A.otSun,rate),ot,true);
            else { var f=Math.min(ot,Math.max(0,2-dayOT)); add('Overtime, first 2 hrs',Math.max(A.ot1,rate),f,true); add('Overtime, after 2 hrs',Math.max(A.ot2,rate),ot-f,true); }
          }
          dayOT+=ot;
        });
      });
    }
    var lines=order.map(function(k){ var l=map[k]; l.rate=r2(l.rate); l.amt=r2(l.hrs*l.rate); return l; }).sort(function(a,b){ return (a.ot?1:0)-(b.ot?1:0); });
    var gross=0, ordPay=0, h=0, otH=0;
    lines.forEach(function(l){ gross+=l.amt; h+=l.hrs; if(l.ot) otH+=l.hrs; else ordPay+=l.amt; });
    gross=r2(gross); ordPay=r2(ordPay);
    return {lines:lines, gross:gross, ordPay:ordPay, hrs:r2(h), otHrs:r2(otH), sup:r2(ordPay*0.12), taxAuto:tax(gross,+o.tft||2,cycle), reasons:reasons};
  }

  function html(x, E){
    var td='padding:8px 10px;border-bottom:1px solid #EDE6DE;font-size:14px;color:#4A4A4A', tdr=td+';text-align:right;white-space:nowrap', th='font-weight:500;font-size:12px;color:#7A7A7A';
    var rows=x.lines.map(function(r){ return '<tr><td style="'+td+'">'+esc(r.label)+'</td><td style="'+tdr+'">'+hrs(r.hrs)+'</td><td style="'+tdr+'">'+money(r.rate)+'</td><td style="'+tdr+'">'+money(r.amt)+'</td></tr>'; }).join('');
    var otPay=r2(x.gross-x.ordPay);
    var shiftRows=(x.shifts||[]).map(function(s){ return '<tr><td style="'+td+';white-space:nowrap">'+esc(fshort(s.date))+'</td><td style="'+td+'">'+esc(KIND[s.kind]||'')+'</td><td style="'+tdr+'">'+hrs(s.hrs)+'</td></tr>'; }).join('');
    return '<div style="font-family:Inter,Arial,sans-serif;color:#1A1A1A;max-width:600px;margin:0 auto;background:#FFFFFF;padding:22px">'+
      '<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="vertical-align:top"><div style="font-family:\'Playfair Display\',Georgia,serif;font-size:24px;font-weight:700;color:#1A1A1A">Bardon Clean</div><div style="font-size:12px;color:#7A7A7A;line-height:1.5">'+esc(E.name)+'<br>ABN '+esc(E.abn)+'<br>'+esc(E.addr)+'</div></td>'+
      '<td style="vertical-align:top;text-align:right"><div style="font-family:\'Playfair Display\',Georgia,serif;font-size:20px;font-weight:700;color:#C06B3C">Payslip</div><div style="font-size:12px;color:#7A7A7A;line-height:1.5">'+esc(x.num)+'<br>Paid '+fdate(x.paidOn)+'</div></td></tr></table>'+
      '<table role="presentation" width="100%" style="border-collapse:collapse;margin:18px 0;background:#F5F0EB"><tr><td style="padding:12px;font-size:13px;color:#4A4A4A;line-height:1.6;vertical-align:top"><b style="color:#1A1A1A">'+esc(x.name)+'</b><br>Casual employee<br>Cleaning Services Award 2020, Level '+esc(x.level||'1')+'</td>'+
      '<td style="padding:12px;font-size:13px;color:#4A4A4A;line-height:1.6;text-align:right;vertical-align:top">'+(x.cycle===2?'Fortnightly':'Weekly')+' pay period<br><b style="color:#1A1A1A">'+fdate(x.periodStart)+' – '+fdate(x.periodEnd)+'</b></td></tr></table>'+
      '<table width="100%" style="border-collapse:collapse"><thead><tr><th style="'+td+';text-align:left;'+th+'">Earnings</th><th style="'+tdr+';'+th+'">Hours</th><th style="'+tdr+';'+th+'">Rate</th><th style="'+tdr+';'+th+'">Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<table width="100%" style="border-collapse:collapse;margin-top:12px"><tr><td style="'+td+'">Gross pay ('+hrs(x.hrs)+' hrs)</td><td style="'+tdr+'">'+money(x.gross)+'</td></tr><tr><td style="'+td+'">PAYG tax withheld</td><td style="'+tdr+'">−'+money(x.tax)+'</td></tr>'+
      '<tr><td style="padding:12px 10px;font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:#1A1A1A">Net pay</td><td style="padding:12px 10px;text-align:right;font-family:\'Playfair Display\',Georgia,serif;font-size:18px;font-weight:700;color:#1A1A1A">'+money(x.net)+'</td></tr></table>'+
      '<table width="100%" style="border-collapse:collapse;margin-top:8px;background:#F5F0EB"><tr><td style="padding:10px 12px;font-size:13px;color:#4A4A4A">Superannuation, paid by Bardon Clean on top of your pay<br><span style="color:#7A7A7A">12% of ordinary time earnings '+money(x.ordPay)+(otPay>0.004?' (overtime excluded)':'')+(x.superFund?' · '+esc(x.superFund):'')+(x.superNo?' · Member '+esc(x.superNo):'')+'</span></td><td style="padding:10px 12px;font-size:13px;color:#1A1A1A;text-align:right;white-space:nowrap;vertical-align:top">'+money(x.sup)+'</td></tr></table>'+
      (shiftRows?'<table width="100%" style="border-collapse:collapse;margin-top:18px"><thead><tr><th style="'+td+';text-align:left;'+th+'">Shifts worked</th><th style="'+td+';text-align:left;'+th+'">Type</th><th style="'+tdr+';'+th+'">Hours</th></tr></thead><tbody>'+shiftRows+'</tbody></table>':'')+
      '<p style="font-size:12px;color:#7A7A7A;line-height:1.6;margin:16px 0 0">Casual rates include the 25% casual loading. Questions about this payslip: Jack, '+esc(E.phone)+'.</p></div>';
  }
  function text(x, E){
    var L=['BARDON CLEAN PAYSLIP '+x.num, E.name+' · ABN '+E.abn, 'Employee: '+x.name+' (casual, Cleaning Services Award Level '+(x.level||'1')+')', 'Pay period: '+fdate(x.periodStart)+' – '+fdate(x.periodEnd)+' · Paid '+fdate(x.paidOn), ''];
    x.lines.forEach(function(r){ L.push(r.label+': '+hrs(r.hrs)+' hrs × '+money(r.rate)+' = '+money(r.amt)); });
    L.push('','Gross pay: '+money(x.gross),'PAYG tax withheld: '+money(x.tax),'Net pay: '+money(x.net),'Super (12% of '+money(x.ordPay)+'): '+money(x.sup)+(x.superFund?' to '+x.superFund:'')+(x.superNo?', member '+x.superNo:''));
    if((x.shifts||[]).length){ L.push('','Shifts:'); x.shifts.forEach(function(s){ L.push(fshort(s.date)+': '+hrs(s.hrs)+' hrs, '+(KIND[s.kind]||'')); }); }
    L.push('','Casual rates include the 25% casual loading. Questions: Jack, '+E.phone);
    return L.join('\n');
  }
  window.BCPay={calc:calc, tax:tax, award:award, rates:rates, html:html, text:text, money:money, hrs:hrs, esc:esc, fdate:fdate, fshort:fshort, KIND:KIND, DEF:DEF};
})();
