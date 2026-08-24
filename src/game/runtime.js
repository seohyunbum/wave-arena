const BUILD_ID=globalThis.WA_BUILD_META.buildId;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d',{alpha:false,desynchronized:true});
const REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const MOBILE_GPU = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
const DENSE_DPR_CAP=1.25;
let W=0, H=0, DPR=Math.min(MOBILE_GPU?1.5:2, window.devicePixelRatio||1), RENDER_DENSE=false;
console.info('[Wave Arena]',BUILD_ID,'canvas2d',MOBILE_GPU?'mobile':'desktop');

// ---- CC0 효과음(Kenney) ----
const SFX_FILES={
  click:'assets/audio/ui-click.ogg', confirm:'assets/audio/ui-confirm.ogg',
  warning:'assets/audio/ui-warning.ogg', reward:'assets/audio/ui-reward.ogg',
  hit:'assets/audio/impact-light.ogg', heavy:'assets/audio/impact-heavy.ogg'
};
const SFX_PROTO={};
for(const k in SFX_FILES){ const a=new Audio(SFX_FILES[k]); a.preload='auto'; SFX_PROTO[k]=a; }
let AUDIO_MUTED=false;
try{ AUDIO_MUTED=localStorage.getItem('wavearena_muted_v1')==='1'; }catch(e){}
const SFX_LAST={};
function playSfx(name,volume,minGap){
  if(AUDIO_MUTED||document.visibilityState==='hidden'||!SFX_PROTO[name]) return;
  const now=performance.now(), gap=minGap||0;
  if(now-(SFX_LAST[name]||0)<gap) return;
  SFX_LAST[name]=now;
  const a=SFX_PROTO[name].cloneNode(); a.volume=Math.max(0,Math.min(1,volume==null ? .3 : volume));
  const p=a.play(); if(p&&p.catch) p.catch(()=>{});
}
const audioBtn=document.getElementById('audioBtn');
function updateAudioButton(){
  audioBtn.textContent=AUDIO_MUTED?'🔇':'🔊';
  audioBtn.setAttribute('aria-label',AUDIO_MUTED?'효과음 켜기':'효과음 끄기');
  audioBtn.title=AUDIO_MUTED?'효과음 켜기':'효과음 끄기';
}
audioBtn.addEventListener('click',()=>{
  AUDIO_MUTED=!AUDIO_MUTED;
  try{ localStorage.setItem('wavearena_muted_v1',AUDIO_MUTED?'1':'0'); }catch(e){}
  updateAudioButton(); if(!AUDIO_MUTED) playSfx('confirm',.34);
});
document.addEventListener('click',ev=>{
  const b=ev.target.closest&&ev.target.closest('button');
  if(b&&!b.disabled&&b!==audioBtn) playSfx('click',.16,55);
});
updateAudioButton();
