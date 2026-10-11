/* FAA General — service worker (offline support) */
var VER='b5c0b1aa';
var CORE='faa-general-core-'+VER, PAGES='faa-general-pages', IMGS='faa-general-img';
var PRECACHE=['./','index.html','progress.html','acs_practice.html','mock_exam.html','flashcards.html','offline.html','app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/favicon-32.png'];
var IMG_MAX=800;

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CORE).then(function(c){return c.addAll(PRECACHE);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){
    if(k.indexOf('faa-general-core-')===0&&k!==CORE) return caches.delete(k);
  }));}).then(function(){return self.clients.claim();}));
});
function trim(name,max){caches.open(name).then(function(c){c.keys().then(function(ks){if(ks.length>max){var n=ks.length-max;for(var i=0;i<n;i++)c.delete(ks[i]);}});});}
function putIn(name,req,res){if(res&&(res.ok||res.type==='opaque')){var cp=res.clone();caches.open(name).then(function(c){c.put(req,cp);});}return res;}

self.addEventListener('fetch',function(e){
  var r=e.request; if(r.method!=='GET') return;
  var u=new URL(r.url);
  var same=u.origin===location.origin;
  // HTML pages: network first (always fresh), fall back to cache, then offline page
  if(r.mode==='navigate'||(same&&/\.html?$|\/$/.test(u.pathname))){
    e.respondWith(fetch(r).then(function(res){return putIn(PAGES,r,res);}).catch(function(){
      return caches.match(r,{ignoreSearch:true}).then(function(m){return m||caches.match('offline.html');});
    }));
    return;
  }
  // images: cache first
  if(r.destination==='image'||/\.(jpe?g|png|webp|gif|svg)$/i.test(u.pathname)){
    e.respondWith(caches.match(r).then(function(m){return m||fetch(r).then(function(res){putIn(IMGS,r,res);trim(IMGS,IMG_MAX);return res;});}).catch(function(){return new Response('',{status:504});}));
    return;
  }
  // everything else (js, json, fonts): stale-while-revalidate
  e.respondWith(caches.match(r).then(function(m){
    var f=fetch(r).then(function(res){return putIn(same?CORE:PAGES,r,res);}).catch(function(){return m;});
    return m||f;
  }));
});

/* "save for offline" requests from progress.html */
self.addEventListener('message',function(e){
  var d=e.data||{}; if(d.type!=='cacheList') return;
  var list=d.urls||[], done=0, fail=0, port=e.ports&&e.ports[0];
  caches.open(d.images?IMGS:PAGES).then(function(c){
    var i=0, fin=0;
    if(!list.length&&port){port.postMessage({done:true,ok:0,fail:0});return;}
    function one(){
      if(i>=list.length) return;
      var url=list[i++];
      fetch(url).then(function(res){ if(res.ok){return c.put(url,res).then(function(){done++;});} fail++; })
        .catch(function(){fail++;}).then(function(){
          fin++;
          if(port){ if(fin>=list.length) port.postMessage({done:true,ok:done,fail:fail}); else if(fin%5===0) port.postMessage({progress:fin,total:list.length}); }
          one();
        });
    }
    for(var k=0;k<4;k++) one();
  });
});
