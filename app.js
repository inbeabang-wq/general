/* FAA General — shared app helper: offline (service worker), study-day log, install button */
(function(){
  var SITE='general';
  // 1) service worker
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
    try{ window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); }); }catch(e){}
  }
  // 2) study-day log (shared across the three subject sites on the same origin)
  try{
    var d=new Date(), k=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    var log=JSON.parse(localStorage.getItem('faa_days')||'{}');
    var day=log[k]||(log[k]={});
    day[SITE]=(day[SITE]||0)+1;
    var keys=Object.keys(log).sort(); while(keys.length>400){ delete log[keys.shift()]; }
    localStorage.setItem('faa_days',JSON.stringify(log));
    var last=JSON.parse(localStorage.getItem('faa_last')||'{}');
    last[SITE]={page:location.pathname.split('/').pop()||'index.html',title:document.title,ts:Date.now()};
    localStorage.setItem('faa_last',JSON.stringify(last));
  }catch(e){}
  // install widget style
  try{var st=document.createElement('style');st.textContent='[data-install]{margin:12px 0}.inst-btn{font:700 15px/1.3 "Noto Sans KR",sans-serif;background:rgba(52,211,153,.14);color:#34D399;border:1.5px solid rgba(52,211,153,.55);border-radius:10px;padding:11px 16px;cursor:pointer;width:100%;text-align:left}.inst-btn small,.inst-tip small{display:block;font-weight:400;font-size:11.5px;color:#8b9bbd;margin-top:2px}.inst-tip{font:14px/1.55 "Noto Sans KR",sans-serif;color:#CBD5E1;background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.25);border-radius:10px;padding:11px 14px}.inst-ok{font:13px "Noto Sans KR",sans-serif;color:#34D399}';(document.head||document.documentElement).appendChild(st);}catch(e){}
  // 3) install prompt (Android/desktop Chrome) + iOS hint — shown wherever [data-install] exists
  var deferred=null;
  window.addEventListener('beforeinstallprompt',function(e){ e.preventDefault(); deferred=e; paint(); });
  window.addEventListener('appinstalled',function(){ deferred=null; try{localStorage.setItem('faa_installed_'+SITE,'1');}catch(e){} paint(); });
  function standalone(){ return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true; }
  function ios(){ return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); }
  function paint(){
    var els=document.querySelectorAll('[data-install]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(standalone()){ el.innerHTML='<span class="inst-ok">✅ 앱으로 실행 중입니다 · Running as an app</span>'; continue; }
      if(deferred){
        el.innerHTML='<button type="button" class="inst-btn">📲 휴대폰·PC에 앱으로 설치 <small>Install app</small></button>';
        el.querySelector('button').onclick=function(){ deferred.prompt(); deferred.userChoice.then(function(){ deferred=null; paint(); }); };
      } else if(ios()){
        el.innerHTML='<div class="inst-tip">📲 <b>아이폰·아이패드 설치:</b> Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>「홈 화면에 추가」</b>를 누르세요.<small>iPhone/iPad: Share → Add to Home Screen (Safari)</small></div>';
      } else {
        el.innerHTML='<div class="inst-tip">📲 <b>앱 설치:</b> 크롬 주소창 오른쪽의 설치 아이콘이나 메뉴(⋮) → <b>「앱 설치」</b> 또는 <b>「홈 화면에 추가」</b>를 누르세요.<small>Chrome menu → Install app / Add to Home screen</small></div>';
      }
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',paint); else paint();
  window.FAAApp={paint:paint,site:SITE};
})();
