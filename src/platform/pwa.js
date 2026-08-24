// ================= 휴대폰 앱(PWA) =================
// 서비스 워커를 등록해 두면 홈 화면에 설치할 수 있고, 인터넷이 없어도 실행된다.
// file:// 로 열었을 때는 등록이 불가능하므로 조용히 건너뛴다.
async function waitForServiceWorker(registration,timeoutMs){
  if(registration.active?.state==='activated') return registration;
  const worker=registration.installing||registration.waiting||registration.active;
  if(!worker) throw new Error('Service worker registration has no worker.');
  if(worker.state==='activated') return registration;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Service worker activation timed out.')),timeoutMs);
    const changed=()=>{
      if(worker.state==='activated'){ clearTimeout(timer); resolve(); }
      else if(worker.state==='redundant'){ clearTimeout(timer); reject(new Error('Service worker became redundant.')); }
    };
    worker.addEventListener('statechange',changed);
  });
  return registration;
}
async function registerServiceWorker(){
  const delays=[0,1500,4000]; let lastError=null;
  globalThis.WA_SW_DIAGNOSTIC={status:'registering',attempt:0};
  for(let i=0;i<delays.length;i++){
    if(delays[i]) await new Promise(done=>setTimeout(done,delays[i]));
    try{
      globalThis.WA_SW_DIAGNOSTIC={status:'registering',attempt:i+1};
      const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      await waitForServiceWorker(registration,20000);
      globalThis.WA_SW_DIAGNOSTIC={status:'ready',attempt:i+1};
      return registration;
    }catch(error){
      lastError=error;
      const failed=await navigator.serviceWorker.getRegistration().catch(()=>null);
      if(failed&&!failed.active) await failed.unregister().catch(()=>{});
    }
  }
  globalThis.WA_SW_DIAGNOSTIC={status:'failed',attempt:delays.length,message:lastError?.message||'unknown'};
  console.warn('[Wave Arena] service worker install failed after retries',lastError);
  return null;
}
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',registerServiceWorker,{once:true});
}

// ---- 앱 설치 ----
// 아이폰(사파리)은 자동 설치 이벤트가 아예 없다. 그래서 버튼을 이벤트에 기대지 않고
// 항상 띄워 두고, 누르면 그 기기에 맞는 방법을 화면에 직접 알려 준다.
let deferredInstall=null;
const installBtn=document.getElementById('installBtn');
const howto=document.getElementById('howto');
const standalone = window.matchMedia('(display-mode: standalone)').matches
                || window.matchMedia('(display-mode: fullscreen)').matches
                || navigator.standalone===true;
if(standalone) installBtn.remove();                       // 이미 앱으로 실행 중

window.addEventListener('beforeinstallprompt', ev=>{
  ev.preventDefault(); deferredInstall=ev;
  if(!standalone) installBtn.textContent='📲 앱 설치';
});
window.addEventListener('appinstalled', ()=>{
  deferredInstall=null; howto.style.display='none';
  if(installBtn) installBtn.remove();
});

const UA=navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const isSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|Whale|NAVER|KAKAOTALK|Line|FBAN|FBAV|Instagram/i.test(UA);
const inApp = /KAKAOTALK|NAVER|Line|FBAN|FBAV|Instagram|DaumApps/i.test(UA);

function installSteps(){
  if(inApp) return ['지금 <b>카카오톡·네이버 같은 앱 안의 브라우저</b>로 열려 있습니다. 여기서는 설치가 안 됩니다.',
                    '오른쪽 아래(또는 위) <b>⋯ 메뉴 → "다른 브라우저로 열기"</b> 를 누르세요.',
                    '<b>크롬</b>(안드로이드) 또는 <b>사파리</b>(아이폰)로 연 다음 다시 이 버튼을 누르세요.'];
  if(isIOS && !isSafari) return ['아이폰에서는 <b>사파리</b>로 열어야 설치할 수 있습니다.',
                    '주소를 복사해 <b>사파리</b>에서 연 다음 다시 시도하세요.'];
  if(isIOS) return ['화면 <b>아래쪽 가운데 공유 버튼 <span style="color:#8ad3ff">⬆️</span></b> 를 누르세요.',
                    '메뉴를 <b>아래로 넘겨</b> <b>"홈 화면에 추가"</b> 를 찾아 누르세요.',
                    '오른쪽 위 <b>"추가"</b> 를 누르면 끝입니다.'];
  return ['브라우저 <b>오른쪽 위 ⋮ (점 세 개)</b> 를 누르세요.',
          '<b>"앱 설치"</b> 또는 <b>"홈 화면에 추가"</b> 를 누르세요.',
          '<b>"설치"</b> 를 누르면 끝입니다.'];
}
async function showDiag(){
  const yes=t=>'<span class="ok">✅ '+t+'</span>', no=t=>'<span class="no">❌ '+t+'</span>';
  const rows=[];
  rows.push('주소 : <b>'+location.protocol+'//'+location.host+'</b> '
    +(location.protocol==='https:'?yes('https 맞음'):no('https 가 아니면 설치 불가')));
  let sw=false; try{ sw=!!(await navigator.serviceWorker.getRegistration()); }catch(e){}
  rows.push('오프라인 준비 : '+(sw?yes('됨'):no('안 됨 — 새로고침 한 번 해보세요')));
  let mf=false; try{ mf=(await fetch('manifest.webmanifest')).ok; }catch(e){}
  rows.push('앱 정보 파일 : '+(mf?yes('읽힘'):no('못 읽음')));
  rows.push('자동 설치 버튼 : '+(deferredInstall?yes('사용 가능'):'⏳ 없음 (아이폰은 원래 없음 — 아래 방법으로)'));
  document.getElementById('howtoDiag').innerHTML=rows.join('<br>');
}
if(installBtn) installBtn.onclick=async()=>{
  if(deferredInstall){                                    // 안드로이드·크롬 : 바로 설치창
    deferredInstall.prompt();
    const r=await deferredInstall.userChoice;
    deferredInstall=null;
    if(r && r.outcome==='accepted'){ installBtn.remove(); return; }
  }
  document.getElementById('howtoSteps').innerHTML=installSteps().map(t=>'<li>'+t+'</li>').join('');
  await showDiag();
  howto.style.display='grid';
};
document.getElementById('howtoClose').onclick=()=>{ howto.style.display='none'; };

// 게임 중에는 화면이 꺼지지 않게 (지원하는 기기에서만)
let wakeLock=null;
async function keepAwake(){
  try{ if('wakeLock' in navigator && !wakeLock) wakeLock=await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible'){ wakeLock=null; if(G.phase==='running') keepAwake(); }
});
window.addEventListener('wavearena:start',keepAwake);

// 손가락 두 번 톡톡 쳐서 화면이 확대되는 것 방지 (게임판이 흔들려 조작이 어긋난다)
let lastTouch=0;
document.addEventListener('touchend', ev=>{
  const now=Date.now();
  if(now-lastTouch<320) ev.preventDefault();
  lastTouch=now;
}, {passive:false});
document.addEventListener('gesturestart', ev=>ev.preventDefault());
// 화면 밖으로 당겨 새로고침되는 것 방지 (게임이 처음부터 다시 시작돼 버린다)
document.body.addEventListener('touchmove', ev=>{
  if(ev.target.closest('#shop,#over,#bossLog')) return;   // 상점 등은 스크롤돼야 한다
  ev.preventDefault();
}, {passive:false});
// 화면을 돌리면 카메라를 다시 맞춘다
window.addEventListener('orientationchange', ()=>setTimeout(resize,250));
