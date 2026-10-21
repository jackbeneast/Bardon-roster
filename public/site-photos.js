/* Bardon Clean website photos, from the hub (Tools › Website photos).
   Add once to every page of bardonclean.au, just before </body>:
     <script src="https://bardon-roster.netlify.app/site-photos.js" defer></script>
   It finds each set spot by the image it shows now (file name or alt text) and swaps in
   the photo Jack picked in the hub. Any spot without a pick keeps its current image, and
   if the hub can't be reached nothing changes. A spot can also be marked by hand:
     <img data-hub-photo="home-hero" ...>
*/
(function(){
  var HUB = 'https://bardon-roster.netlify.app';
  var SPOTS = {
    'home-hero':    { files: ['hero-kitchen-brisbane'] },
    'home-presale': { files: ['card-presale-kitchen-brisbane'], alts: ['Pre-sale cleaned kitchen island'] },
    'home-bond':    { files: ['card-bond-end-of-lease-kitchen'], alts: ['Spotless kitchen benchtop, cooktop'] },
    'home-deep':    { files: ['card-deep-clean-bathroom'], alts: ['Gleaming freestanding bath'] },
    'guide':        { files: ['guide/presale-living-hero'] },
    'presale-hero': { files: ['presale-hero-dining'] },
    'bond-hero':    { files: ['bond-page-hero'] },
    'deep-hero':    { files: ['deepclean-hero-vanity'] }
  };
  function label(p){
    var r = (p.room || '').replace(' & ', ' and '), s = (p.service || '').replace(/ clean$/i, '');
    return (r || 'Home') + ' after a Bardon Clean' + (s ? ' ' + s.toLowerCase() + ' clean' : '') + ', Brisbane';
  }
  function hits(id, spot){
    var out = [], all = document.querySelectorAll('img, [role="img"], [style*="background"]');
    for (var i = 0; i < all.length; i++){
      var el = all[i], src = el.getAttribute('src') || el.getAttribute('style') || '', alt = el.getAttribute('alt') || el.getAttribute('aria-label') || '';
      var mark = el.getAttribute('data-hub-photo');
      if (mark ? mark === id : (spot.files || []).some(function(f){ return src.indexOf(f) >= 0; }) || (spot.alts || []).some(function(a){ return alt.indexOf(a) === 0; })) out.push(el);
    }
    return out;
  }
  function swap(el, p){
    var src = HUB + p.url, pre = new Image();
    pre.onload = function(){ // only swap once the new photo has loaded, so nothing ever shows broken
      if (el.tagName === 'IMG'){
        var pic = el.parentNode && el.parentNode.tagName === 'PICTURE' ? el.parentNode : null;
        if (pic) Array.prototype.forEach.call(pic.querySelectorAll('source'), function(s){ s.parentNode.removeChild(s); });
        el.removeAttribute('srcset'); el.removeAttribute('sizes');
        el.src = src; el.alt = label(p);
      } else {
        el.style.backgroundImage = 'url("' + src + '")';
        if (el.getAttribute('role') === 'img') el.setAttribute('aria-label', label(p));
      }
    };
    pre.src = src;
  }
  function run(d){
    var slots = (d && d.slots) || {};
    Object.keys(SPOTS).forEach(function(id){ var p = slots[id]; if (p && p.url) hits(id, SPOTS[id]).forEach(function(el){ swap(el, p); }); });
  }
  try {
    fetch(HUB + '/api/demo').then(function(r){ return r.ok ? r.json() : {}; }).then(function(d){
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ run(d); }); else run(d);
    }).catch(function(){});
  } catch (e) {}
})();
