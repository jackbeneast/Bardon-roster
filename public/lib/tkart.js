// Built-in step drawings for the Toolkit's Premium touches. A guide step's
// picture can be "art:<key>" (one of these) or a photo Jack uploads.
// Colours come from the team app's CSS variables, so they match the app.
(function(){
  var W='var(--white)', D='var(--dark)', F='var(--cd)', A='var(--tcd)', G='var(--gold)';
  function svg(body, label){
    return '<svg viewBox="0 0 240 160" role="img" aria-label="'+label+'" xmlns="http://www.w3.org/2000/svg">'+
      '<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="'+A+'"/></marker></defs>'+body+'</svg>';
  }
  function arrow(d){ return '<path d="'+d+'" fill="none" stroke="'+A+'" stroke-width="2.5" stroke-linecap="round" marker-end="url(#ah)"/>'; }
  function poly(pts, fill, dash){ return '<polygon points="'+pts+'" fill="'+fill+'" stroke="'+D+'" stroke-width="2" stroke-linejoin="round"'+(dash?' stroke-dasharray="5 4"':'')+'/>'; }
  function line(x1,y1,x2,y2,dash,col){ return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(col||D)+'" stroke-width="2"'+(dash?' stroke-dasharray="5 4"':'')+' stroke-linecap="round"/>'; }
  function spark(x,y){ return '<path d="M'+x+' '+(y-9)+'L'+(x+2.5)+' '+(y-2.5)+'L'+(x+9)+' '+y+'L'+(x+2.5)+' '+(y+2.5)+'L'+x+' '+(y+9)+'L'+(x-2.5)+' '+(y+2.5)+'L'+(x-9)+' '+y+'L'+(x-2.5)+' '+(y-2.5)+'z" fill="'+G+'"/>'; }

  // Toilet roll on its holder, seen from the front, with the sheet hanging down.
  var roll = line(30,40,210,40) + '<rect x="56" y="18" width="128" height="44" rx="8" fill="'+W+'" stroke="'+D+'" stroke-width="2"/>' + line(66,22,66,58,false,F);
  var tail = '80,62 160,62 160,140 80,140';

  // Towel and tea towel laid flat (portrait), folded in thirds along the length.
  var flat = poly('70,10 170,10 170,150 70,150', W);

  var A_ = {
    tp1: svg(roll + poly(tail, W) + line(80,140,160,140,false,A) + '<text x="196" y="144" font-size="12" fill="'+A+'" text-anchor="end" font-family="sans-serif">clean edge</text>', 'Toilet roll with a neat sheet hanging down'),
    tp2: svg(roll + poly('80,62 160,62 160,140 120,140 80,100', W) + poly('80,100 120,140 120,100', F) + arrow('M70 132 Q80 108 108 106'), 'Left corner folded in to the centre'),
    tp3: svg(roll + poly('80,62 160,62 160,100 120,140 80,100', W) + poly('80,100 120,140 120,100', F) + poly('160,100 120,140 120,100', F) + arrow('M170 132 Q160 108 132 106'), 'Right corner folded in to make a point'),
    tp4: svg(roll + poly('80,62 160,62 160,100 120,140 80,100', W) + poly('80,100 120,140 120,100', F) + poly('160,100 120,140 120,100', F) + spark(120,150) + spark(192,86), 'Finished point, creases pressed flat'),

    tw1: svg(flat + line(103,10,103,150,true) + line(137,10,137,150,true), 'Towel flat, face down, marked in thirds along its length'),
    tw2: svg(poly('103,10 170,10 170,150 103,150', W) + poly('103,10 137,10 137,150 103,150', F) + arrow('M58 80 Q70 58 112 70'), 'One long side folded in a third'),
    tw3: svg(poly('103,10 137,10 137,150 103,150', F) + line(108,10,108,150,false,D) + arrow('M182 80 Q170 58 128 70'), 'Other long side folded over: a long, neat strip'),
    tw4: svg('<rect x="40" y="46" width="160" height="8" rx="4" fill="'+D+'"/>' + poly('102,52 138,52 138,148 102,148', W) + poly('102,52 138,52 138,60 102,60', F) + line(84,148,156,148,true,A) + '<text x="160" y="152" font-size="12" fill="'+A+'" font-family="sans-serif">level</text>' + spark(160,30), 'Strip hung over the rail, ends level'),

    tt1: svg(flat + line(103,10,103,150,true) + line(137,10,137,150,true), 'Tea towel flat, marked in thirds along its length'),
    tt2: svg(poly('103,10 137,10 137,150 103,150', F) + line(103,57,137,57,true) + line(103,103,137,103,true) + arrow('M60 80 L94 80') + arrow('M180 80 L146 80'), 'Folded into a long strip, then marked in thirds again'),
    tt3: svg(poly('103,57 137,57 137,150 103,150', F) + poly('103,57 137,57 137,103 103,103', W) + line(103,103,137,103,true) + arrow('M150 30 Q168 50 146 80'), 'Top third folded down'),
    tt4: svg('<rect x="96" y="62" width="48" height="50" rx="3" fill="rgba(0,0,0,.08)"/>' + poly('100,57 140,57 140,105 100,105', W) + line(100,81,140,81,false,F) + line(20,112,220,112) + spark(156,46), 'Bottom third folded up into a neat pad')
  };
  window.TKART = { get: function(k){ return A_[k] || ''; }, keys: Object.keys(A_) };
})();
