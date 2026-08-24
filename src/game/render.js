// ---- 월드(고정 좌표계) : 화면 크기와 무관하게 밸런스 일정 ----
const WORLD = {w:1280, h:720};

// ---- 길 종류 : 격자 위에 설계해 4개 모두 정확히 22칸(=1936)으로 길이가 같다 ----
const GCELL=88, GOX=68, GOY=52;
const MAPS = [
  {n:'굽이길', desc:'좌→우로 크게 꺾이는 기본 길', pts:[[0,1],[5,1],[5,3],[2,3],[2,6],[8,6],[8,4],[7,4]]},
  {n:'나선길', desc:'바깥에서 안으로 감겨드는 길', pts:[[13,6],[9,6],[9,2],[3,2],[3,5],[6,5],[6,4],[7,4]]},
  {n:'우회길', desc:'왼쪽 아래를 크게 도는 길',   pts:[[0,7],[0,3],[4,3],[4,6],[10,6],[10,4],[7,4]]},
  {n:'관통길', desc:'오른쪽 위에서 파고드는 길',   pts:[[13,0],[10,0],[10,3],[12,3],[12,6],[5,6],[5,4],[7,4]]},
  {n:'계단길', desc:'한 칸씩 층계처럼 내려오는 길',
   pts:[[0,7],[1,7],[1,6],[2,6],[2,5],[3,5],[3,4],[4,4],[4,3],[5,3],[5,2],[6,2],[6,1],[10,1],[10,4],[7,4]]},
  {n:'ㄹ자길', desc:'좌우로 왕복하는 뱀 모양 길', pts:[[12,1],[6,1],[6,3],[12,3],[12,5],[8,5],[8,4],[7,4]]},
  {n:'둘레길', desc:'아래쪽을 톱니처럼 훑는 길',   pts:[[0,5],[0,7],[4,7],[4,5],[8,5],[8,7],[10,7],[10,4],[7,4]]},
  {n:'협곡길', desc:'가운데를 좁게 파고드는 길',   pts:[[13,4],[11,4],[11,2],[9,2],[9,5],[6,5],[6,3],[3,3],[3,4],[7,4]]},
  {n:'번개길', desc:'번개처럼 꺾이며 내려오는 길', pts:[[2,7],[2,5],[6,5],[6,7],[11,7],[11,3],[8,3],[8,4],[7,4]]},
  {n:'가로지르기', desc:'긴 직선으로 맵을 가로지르는 길', pts:[[13,2],[2,2],[2,6],[6,6],[6,4],[7,4]]},
];
function pathLength(pts){                        // 칸 수(모든 맵이 같아야 함)
  let n=0; for(let i=0;i<pts.length-1;i++) n+=Math.abs(pts[i+1][0]-pts[i][0])+Math.abs(pts[i+1][1]-pts[i][1]);
  return n;
}
let WP = [];
function setPath(i){
  const m=MAPS[(i%MAPS.length+MAPS.length)%MAPS.length];
  WP = m.pts.map(([gx,gy])=>({x:GOX+gx*GCELL, y:GOY+gy*GCELL}));
}
setPath(0);
function baseNode(){ return WP[WP.length-1]; }

// ---- 포탑 자리 : 길을 따라 좌/우로 번갈아 배치 ----
// 가장 가까운 길 구간의 진행 방향 (레이저 빔을 길에 수직으로 놓기 위해)
function pathAngleAt(x,y){
  let best=1e9, ang=0;
  for(let i=0;i<WP.length-1;i++){
    const a=WP[i], b=WP[i+1], dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy||1;
    let u=((x-a.x)*dx+(y-a.y)*dy)/L2; u=Math.max(0,Math.min(1,u));
    const d=Math.hypot(x-(a.x+dx*u), y-(a.y+dy*u));
    if(d<best){ best=d; ang=Math.atan2(dy,dx); }
  }
  return ang+Math.PI/2;                                     // 길에 수직
}
function distToPath(x,y){
  let best=1e9;
  for(let i=0;i<WP.length-1;i++){
    const a=WP[i], b=WP[i+1], dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy||1;
    let u=((x-a.x)*dx+(y-a.y)*dy)/L2; u=Math.max(0,Math.min(1,u));
    const d=Math.hypot(x-(a.x+dx*u), y-(a.y+dy*u));
    if(d<best) best=d;
  }
  return best;
}
function buildTurretSlots(){
  const OFF=52, segs=[]; let total=0;
  for(let i=0;i<WP.length-1;i++){
    const a=WP[i], b=WP[i+1], L=Math.hypot(b.x-a.x,b.y-a.y);
    segs.push({a,b,L,s:total}); total+=L;
  }
  const N=CFG.turretMax, out=[];
  for(let i=0;i<N;i++){
    const t=(i+0.5)/N*total;
    const sg=segs.find(s=>t>=s.s && t<=s.s+s.L) || segs[segs.length-1];
    const u=(t-sg.s)/sg.L;
    const px=sg.a.x+(sg.b.x-sg.a.x)*u, py=sg.a.y+(sg.b.y-sg.a.y)*u;
    const ux=(sg.b.x-sg.a.x)/sg.L, uy=(sg.b.y-sg.a.y)/sg.L;
    let bestP=null, bestD=-1;
    for(const side of [(i%2)?1:-1, (i%2)?-1:1]){          // 선호 방향 → 반대 방향 순으로 시도
      const x=Math.max(46,Math.min(WORLD.w-46, px-uy*OFF*side));
      const y=Math.max(46,Math.min(WORLD.h-46, py+ux*OFF*side));
      const d=distToPath(x,y);
      if(d>bestD){ bestD=d; bestP={x,y}; }
      if(d>=40) break;                                     // 길에서 충분히 떨어졌으면 확정
    }
    out.push(bestP);
  }
  return out;
}
let TSPOTS = buildTurretSlots();     // 구매 시 처음 놓이는 위치(이후 자유롭게 이동 가능)

// ---- 맵 장식 : 나무·바위·덤불·꽃·연못 (정적이므로 지면 캐시에 한 번만 구워 넣는다) ----
function mulberry32(a){ return function(){          // 고정 시드 난수 → 같은 맵이면 항상 같은 배치
  a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }
let DECOR=[], PONDS=[];
function buildDecor(seed){
  const rnd=mulberry32(1000+seed*7919);
  DECOR=[]; PONDS=[];
  const b=baseNode();
  const free=(x,y,pad)=>distToPath(x,y)>pad && Math.hypot(x-b.x,y-b.y)>120
                        && x>26 && y>26 && x<WORLD.w-26 && y<WORLD.h-26;
  // 연못 1~2개
  for(let i=0;i<2;i++){
    for(let k=0;k<60;k++){
      const x=60+rnd()*(WORLD.w-120), y=60+rnd()*(WORLD.h-120), r=52+rnd()*34;
      if(distToPath(x,y)>r+52 && Math.hypot(x-b.x,y-b.y)>r+150 &&
         !PONDS.some(p=>Math.hypot(p.x-x,p.y-y)<p.r+r+60)){ PONDS.push({x,y,r}); break; }
    }
  }
  const onPond=(x,y,pad)=>PONDS.some(p=>Math.hypot(p.x-x,p.y-y)<p.r+(pad||0));
  const put=(kind,x,y,extra)=>DECOR.push(Object.assign({kind,x,y},extra||{}));
  // 나무 (숲처럼 뭉쳐서)
  let clusters=0;
  for(let k=0;k<400 && clusters<9;k++){
    const cx=50+rnd()*(WORLD.w-100), cy=50+rnd()*(WORLD.h-100);
    if(!free(cx,cy,86) || onPond(cx,cy,40)) continue;
    clusters++;
    const n=2+((rnd()*4)|0);
    for(let i=0;i<n;i++){
      const x=cx+(rnd()-0.5)*110, y=cy+(rnd()-0.5)*110;
      if(!free(x,y,64) || onPond(x,y,26)) continue;
      put('tree',x,y,{s:0.8+rnd()*0.55, dark:rnd()<0.4});
    }
  }
  // 바위 · 덤불 · 꽃
  for(let i=0;i<26;i++){ const x=40+rnd()*(WORLD.w-80), y=40+rnd()*(WORLD.h-80);
    if(free(x,y,52) && !onPond(x,y,18)) put('rock',x,y,{s:0.7+rnd()*0.8}); }
  for(let i=0;i<34;i++){ const x=40+rnd()*(WORLD.w-80), y=40+rnd()*(WORLD.h-80);
    if(free(x,y,44) && !onPond(x,y,14)) put('bush',x,y,{s:0.7+rnd()*0.6}); }
  for(let i=0;i<70;i++){ const x=30+rnd()*(WORLD.w-60), y=30+rnd()*(WORLD.h-60);
    if(free(x,y,36) && !onPond(x,y,10)) put('flower',x,y,{c:['#ff7ab6','#ffe066','#ffffff','#c78bff'][(rnd()*4)|0]}); }
  // 길가 울타리 (길과 나란히, 일정 간격)
  for(let i=0;i<WP.length-1;i++){
    const a=WP[i], c=WP[i+1], L=Math.hypot(c.x-a.x,c.y-a.y)||1;
    const ux=(c.x-a.x)/L, uy=(c.y-a.y)/L;
    for(let d=26; d<L-16; d+=46){
      for(const sgn of [-1,1]){
        const x=a.x+ux*d-uy*40*sgn, y=a.y+uy*d+ux*40*sgn;
        if(distToPath(x,y)>30 && Math.hypot(x-b.x,y-b.y)>110 && !onPond(x,y,8)
           && x>20 && y>20 && x<WORLD.w-20 && y<WORLD.h-20) put('fence',x,y,{});
      }
    }
  }
}
function drawDecor(g){
  DECOR.sort((p,q)=>depthOf(p.x,p.y)-depthOf(q.x,q.y));   // 뒤에서 앞으로(회전 반영)
  for(const d of DECOR){
    if(d.kind==='tree'){
      const s=d.s, tc=d.dark?'#4a7a2a':'#5fae35';
      box(g,d.x,d.y,0,9*s,9*s,26*s,'#6b4a2a');                    // 줄기
      box(g,d.x,d.y,22*s,30*s,30*s,20*s,tc);                      // 잎 아래단
      box(g,d.x,d.y,40*s,22*s,22*s,16*s,shadeHex(tc,1.12));       // 잎 위단
      box(g,d.x,d.y,54*s,12*s,12*s,10*s,shadeHex(tc,1.22));       // 꼭대기
    } else if(d.kind==='rock'){
      const s=d.s;
      box(g,d.x,d.y,0,22*s,20*s,12*s,'#8d949f');
      box(g,d.x-4*s,d.y+3*s,10*s,12*s,11*s,8*s,'#a8afb9');
    } else if(d.kind==='bush'){
      const s=d.s;
      box(g,d.x,d.y,0,20*s,18*s,12*s,'#3f7f2e');
      box(g,d.x+3*s,d.y-2*s,10*s,13*s,12*s,9*s,'#4f9b39');
    } else if(d.kind==='fence'){
      box(g,d.x,d.y,0,4,4,13,'#8a6b40');
      box(g,d.x,d.y,9,3.5,15,3,'#a07d4c');
    } else {                                                       // 꽃
      box(g,d.x,d.y,0,2.5,2.5,5,'#3f7f2e');
      box(g,d.x,d.y,5,4.5,4.5,3,d.c);
    }
  }
}
function shadeHex(hex,f){ return darken(hex,f); }

// 화면 좌표 → 월드 좌표 (지면 z=0 평면 기준) : 포탑을 끌어다 놓을 때 사용
function screenToWorld(sx,sy){
  const A=(sx-CAM.ox)/CAM.scale/ISO_X;          // rx-ry
  const B=(sy-CAM.oy)/CAM.scale/ISO_Y;          // rx+ry
  const rx=(A+B)/2, ry=(B-A)/2;
  const px=rx-WORLD.w/2, py=ry-WORLD.h/2;       // 뷰 회전 되돌리기
  return {x:WORLD.w/2 + px*CAM.cos + py*CAM.sin,
          y:WORLD.h/2 - px*CAM.sin + py*CAM.cos};
}

// ---- 아이소메트릭 카메라 ----
const ISO_X=0.866, ISO_Y=0.5, Z_HEAD=110;
const CAM={scale:1, ox:0, oy:0, rot:0, cos:1, sin:0};   // rot=뷰 회전각(90° 단위)
let _rx=0,_ry=0;
function worldRot(x,y){ const dx=x-WORLD.w/2, dy=y-WORLD.h/2;   // 월드 중심 기준 회전
  _rx=WORLD.w/2 + dx*CAM.cos - dy*CAM.sin; _ry=WORLD.h/2 + dx*CAM.sin + dy*CAM.cos; }
function isoX(x,y){ worldRot(x,y); return ((_rx-_ry)*ISO_X)*CAM.scale+CAM.ox; }
function isoY(x,y,z){ worldRot(x,y); return ((_rx+_ry)*ISO_Y-(z||0))*CAM.scale+CAM.oy; }
function depthOf(x,y){ worldRot(x,y); return _rx+_ry; }   // 회전 반영 깊이(painter's 정렬용)
function fitCamera(){
  const corners=[[0,0],[WORLD.w,0],[WORLD.w,WORLD.h],[0,WORLD.h]];
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(const [x,y] of corners){ worldRot(x,y);
    const sx=(_rx-_ry)*ISO_X, sy=(_rx+_ry)*ISO_Y;
    if(sx<minX)minX=sx; if(sx>maxX)maxX=sx;
    if(sy-Z_HEAD<minY)minY=sy-Z_HEAD; if(sy>maxY)maxY=sy;
  }
  const pad=16;
  CAM.scale=Math.min((W-pad*2)/(maxX-minX), (H-pad*2)/(maxY-minY));
  CAM.ox=W/2-((minX+maxX)/2)*CAM.scale;
  CAM.oy=H/2-((minY+maxY)/2)*CAM.scale;
}
function rotateView(){
  CAM.rot=(CAM.rot+Math.PI/2)%(Math.PI*2);
  CAM.cos=Math.round(Math.cos(CAM.rot)); CAM.sin=Math.round(Math.sin(CAM.rot));  // 90°=정수, 반올림으로 오차 제거
  fitCamera(); buildGround();
}

// ---- 색 셰이딩 (면별 밝기) ----
const _sc=new Map();
function shade(hex,f){
  // 회전 박스는 각도가 연속이라 f가 매번 다른 실수 → 32단계로 양자화해야 캐시가 무한히 늘지 않는다
  const q=Math.round(f*32);
  const k=hex+'|'+q; let v=_sc.get(k); if(v) return v;
  const ff=q/32, n=parseInt(hex.slice(1),16);
  const r=Math.min(255,((n>>16)&255)*ff)|0, g=Math.min(255,((n>>8)&255)*ff)|0, b=Math.min(255,(n&255)*ff)|0;
  v='rgb('+r+','+g+','+b+')'; _sc.set(k,v); return v;
}
// 박스 = 윗면 + 보이는 옆면 (회전 대응: 네 옆면을 먼->가까운 순으로 그려 뒷면을 덮음)
const _nX=[0,1,0,-1], _nY=[-1,0,1,0];   // 각 옆면의 외향 법선(월드)
// 아이소메트릭에서는 옆면 4개 중 2개만 보인다 → 뒷면은 그리지 않는다(그려도 앞면에 완전히 가려짐)
function box(g,x,y,z,w,d,h,col){
  const hw=w/2, hd=d/2, z1=z+h;
  const bx=[x-hw,x+hw,x+hw,x-hw], by=[y-hd,y-hd,y+hd,y+hd];   // CCW 밑면 코너
  for(let i=0;i<4;i++){
    const rnx=_nX[i]*CAM.cos-_nY[i]*CAM.sin, rny=_nX[i]*CAM.sin+_nY[i]*CAM.cos;  // 회전된 법선
    if(rnx+rny<=0) continue;                                                     // 뒷면 컬링
    const j=(i+1)&3;
    g.fillStyle=shade(col,Math.max(.42, .74+.20*rnx-.24*rny));                   // 방향별 명암
    g.beginPath();
    g.moveTo(isoX(bx[i],by[i]),isoY(bx[i],by[i],z));
    g.lineTo(isoX(bx[j],by[j]),isoY(bx[j],by[j],z));
    g.lineTo(isoX(bx[j],by[j]),isoY(bx[j],by[j],z1));
    g.lineTo(isoX(bx[i],by[i]),isoY(bx[i],by[i],z1));
    g.closePath(); g.fill();
  }
  g.fillStyle=shade(col,1.15);   // 윗면
  g.beginPath();
  g.moveTo(isoX(bx[0],by[0]),isoY(bx[0],by[0],z1)); g.lineTo(isoX(bx[1],by[1]),isoY(bx[1],by[1],z1));
  g.lineTo(isoX(bx[2],by[2]),isoY(bx[2],by[2],z1)); g.lineTo(isoX(bx[3],by[3]),isoY(bx[3],by[3],z1));
  g.closePath(); g.fill();
  g.strokeStyle='rgba(235,255,255,.10)'; g.lineWidth=Math.max(.45,.72*CAM.scale); g.stroke();
}
// 색 밝기 조절 (hex → hex) : 소매/바지 등 같은 계열의 톤 차이를 만들 때
const _dk=new Map();
function darken(hex,f){
  const k=hex+'|'+f; let v=_dk.get(k); if(v) return v;
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.round(((n>>16)&255)*f)), g=Math.min(255,Math.round(((n>>8)&255)*f)),
        b=Math.min(255,Math.round((n&255)*f));
  v='#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); _dk.set(k,v); return v;
}
// 회전 박스 : 임의 각도(ang)로 Z축 회전한 직육면체 (총열·사람 몸통 등 방향이 있는 부위용)
const _cx=[0,0,0,0], _cy=[0,0,0,0];
function rbox(g,x,y,z,len,wid,h,ang,col){
  const ca=Math.cos(ang), sa=Math.sin(ang), hl=len/2, hw=wid/2, z1=z+h;
  _cx[0]=x-hl*ca+hw*sa; _cy[0]=y-hl*sa-hw*ca;   // CCW 밑면 코너 (local -x-y → +x-y → +x+y → -x+y)
  _cx[1]=x+hl*ca+hw*sa; _cy[1]=y+hl*sa-hw*ca;
  _cx[2]=x+hl*ca-hw*sa; _cy[2]=y+hl*sa+hw*ca;
  _cx[3]=x-hl*ca-hw*sa; _cy[3]=y-hl*sa+hw*ca;
  for(let i=0;i<4;i++){
    const j=(i+1)&3;
    const ex=_cx[j]-_cx[i], ey=_cy[j]-_cy[i], L=Math.hypot(ex,ey)||1;
    const nx=ey/L, ny=-ex/L;                                                   // 외향 법선
    const rnx=nx*CAM.cos-ny*CAM.sin, rny=nx*CAM.sin+ny*CAM.cos;
    if(rnx+rny<=0) continue;                                                   // 뒷면 컬링
    g.fillStyle=shade(col,Math.max(.42,.74+.20*rnx-.24*rny));
    g.beginPath();
    g.moveTo(isoX(_cx[i],_cy[i]),isoY(_cx[i],_cy[i],z));
    g.lineTo(isoX(_cx[j],_cy[j]),isoY(_cx[j],_cy[j],z));
    g.lineTo(isoX(_cx[j],_cy[j]),isoY(_cx[j],_cy[j],z1));
    g.lineTo(isoX(_cx[i],_cy[i]),isoY(_cx[i],_cy[i],z1));
    g.closePath(); g.fill();
  }
  g.fillStyle=shade(col,1.15);
  g.beginPath();
  g.moveTo(isoX(_cx[0],_cy[0]),isoY(_cx[0],_cy[0],z1));
  for(let i=1;i<4;i++) g.lineTo(isoX(_cx[i],_cy[i]),isoY(_cx[i],_cy[i],z1));
  g.closePath(); g.fill();
  g.strokeStyle='rgba(235,255,255,.09)'; g.lineWidth=Math.max(.4,.66*CAM.scale); g.stroke();
}
// 바닥 스터드(로블록스 시그니처 돌기)
function stud(g,x,y,z,r,col){
  g.fillStyle=col;
  g.beginPath();
  g.ellipse(isoX(x,y), isoY(x,y,z), r*ISO_X*1.35*CAM.scale, r*ISO_Y*1.35*CAM.scale, 0,0,7);
  g.fill();
}

// ---- 캐릭터(사람 형태 휴머노이드) : 바라보는 방향(face)으로 몸 전체가 회전 ----
// 아군 = 파란 제복 병사 / 적 = 붉은 갑옷 전사
const ALLY_SKIN='#f7c98b', ALLY_TORSO='#2f6fd0', ALLY_LEG='#2b3a5c',
      ALLY_HAIR='#4a342a', ALLY_SHOE='#1a2236', ALLY_BELT='#f0c020';
const ENEMY_SKIN='#c9705f', ENEMY_TORSO='#8b1a2b', ENEMY_LEG='#341018',
      ENEMY_HAIR='#2a0d14', ENEMY_SHOE='#1a0509', ENEMY_BELT='#6b1020';
const EYE_COL='#141a24';
// 사람 1명 그리기. 로컬 좌표 : +x=앞(바라보는 방향), +y=왼쪽, z=위
// lod = 디테일 단계 (0=전체, 1=얼굴/손 생략, 2=최소) — 적이 많을 때 자동으로 올려 프레임 유지
function character(g,x,y,s,C,phase,moving,face,pose,lod){
  lod=lod||0;
  const anim = moving && !REDUCE;
  const sw   = anim ? Math.sin(phase) : 0;                 // 팔다리 스윙
  const bob  = anim ? Math.abs(Math.sin(phase))*1.3*s : 0; // 상하 흔들림
  const atk  = pose||0;                                    // 0=평상시, 1=공격자세(팔 앞으로)
  const ca=Math.cos(face), sa=Math.sin(face);
  const P=[];
  // (앞뒤 fx, 좌우 fy, 높이 z, 길이 len, 폭 wid, 높이 h, 색)
  const add=(fx,fy,z,len,wid,h,c)=>P.push({
    x:x+(fx*ca-fy*sa)*s, y:y+(fx*sa+fy*ca)*s, z:z*s, len:len*s, wid:wid*s, h:h*s, c});

  const legSw=sw*3.2, armSw=-sw*3.6;
  // 다리 + 신발
  add( legSw, 4.2, 3.5, 6.5, 6.5, 16, C.leg);
  add(-legSw,-4.2, 3.5, 6.5, 6.5, 16, C.leg);
  if(lod<2){
    add( legSw+1.0, 4.2, 0, 9.5, 6.8, 3.5, C.shoe);        // 발(앞쪽으로 조금 김)
    add(-legSw+1.0,-4.2, 0, 9.5, 6.8, 3.5, C.shoe);
  }
  // 골반·몸통·어깨(위로 갈수록 넓어져 사람 실루엣)
  if(lod<2) add(0,0,19.5+bob, 8.5, 14.5, 3.5, C.belt);     // 벨트
  add(0,0,23+bob,   8.0, 15.5, 12, C.torso);               // 몸통(허리~가슴)
  add(0,0,35+bob,   8.8, 19.0, 5.5, C.torso);              // 어깨(더 넓게)
  if(lod<1) add(0,0,40.5+bob, 4.5, 5.0, 2.5, C.skin);      // 목
  // 팔 + 손 (공격 자세면 앞으로 들어올림)
  const armF = atk?5.5:0, armZ = atk?26:21.5, sleeve=darken(C.torso,0.78);
  add(armF+armSw, 10.8, armZ+bob, 6, 6, 14, sleeve);       // 왼팔(소매)
  add(armF-armSw,-10.8, armZ+bob, 6, 6, 14, sleeve);       // 오른팔
  if(lod<1){
    add(armF+armSw, 10.8, armZ-3.5+bob, 6, 6, 4, C.skin);  // 왼손
    add(armF-armSw,-10.8, armZ-3.5+bob, 6, 6, 4, C.skin);  // 오른손
  }
  // 머리 + 머리카락 + 눈 + 코
  add(0,0,43+bob, 10.5, 11.5, 11, C.skin);                 // 머리
  add(0,0,53+bob, 11.2, 12.2, 3.2, C.hair);                // 머리카락(윗면)
  if(lod<1){
    add(-4.6,0,45.5+bob, 2.5, 11.8, 8.5, C.hair);          // 뒷머리
    add(6.4,2.9,48.8+bob, 3.0, 2.9, 2.4, EYE_COL);         // 왼눈(얼굴 밖으로 충분히 돌출)
    add(6.4,-2.9,48.8+bob, 3.0, 2.9, 2.4, EYE_COL);        // 오른눈
    add(6.6,0,44.8+bob, 3.0, 2.8, 2.6, C.skin);            // 코
    add(6.2,0,42.8+bob, 2.2, 5.0, 1.4, darken(C.skin,0.62)); // 입
  }
  if(C.horn && lod<2){                                     // 적 = 투구 뿔
    add(1.5, 6.2, 55.5+bob, 2.6, 2.6, 4.5, C.horn);
    add(1.5,-6.2, 55.5+bob, 2.6, 2.6, 4.5, C.horn);
  }
  P.sort((a,b)=> (depthOf(a.x,a.y)-depthOf(b.x,b.y)) || a.z-b.z);
  for(const p of P) rbox(g,p.x,p.y,p.z,p.len,p.wid,p.h,face,p.c);
  return 56*s+bob;   // 머리 꼭대기 높이(HP바 위치용)
}
const ALLY_C ={skin:ALLY_SKIN, torso:ALLY_TORSO, leg:ALLY_LEG, hair:ALLY_HAIR, shoe:ALLY_SHOE, belt:ALLY_BELT};
const ENEMY_C={skin:ENEMY_SKIN,torso:ENEMY_TORSO,leg:ENEMY_LEG, hair:ENEMY_HAIR, shoe:ENEMY_SHOE, belt:ENEMY_BELT, horn:'#e8d9c0'};
function fixedPalette(base,overrides){ return Object.freeze(Object.assign({},base,overrides)); }
const ALLY_FLASH_C=fixedPalette(ALLY_C,{torso:'#63b8ff'});
const ENEMY_BOSS_C=fixedPalette(ENEMY_C,{torso:'#8a1f9e',skin:'#c85ad6',leg:'#3a0d45',hair:'#25062c',horn:'#ffd166'});
const ENEMY_FLASH_C=fixedPalette(ENEMY_C,{torso:'#ffffff',skin:'#ffffff',leg:'#ffffff'});
const ENEMY_BOSS_FLASH_C=fixedPalette(ENEMY_BOSS_C,{torso:'#ffffff',skin:'#ffffff',leg:'#ffffff'});
const ENEMY_FREEZE_C=fixedPalette(ENEMY_C,{torso:'#7fd4ff',skin:'#bfe9ff',leg:'#5fb6e6'});
const ENEMY_BOSS_FREEZE_C=fixedPalette(ENEMY_BOSS_C,{torso:'#7fd4ff',skin:'#bfe9ff',leg:'#5fb6e6'});
const ENEMY_BURN_C=fixedPalette(ENEMY_C,{torso:'#ff7a1a',skin:'#ffb066'});
const ENEMY_BOSS_BURN_C=fixedPalette(ENEMY_BOSS_C,{torso:'#ff7a1a',skin:'#ffb066'});
const ENEMY_POISON_C=fixedPalette(ENEMY_C,{torso:'#6fbf3a',skin:'#a7e07a'});
const ENEMY_BOSS_POISON_C=fixedPalette(ENEMY_BOSS_C,{torso:'#6fbf3a',skin:'#a7e07a'});
const ENEMY_SLOW_C=fixedPalette(ENEMY_C,{torso:'#7b6fd0'});
const ENEMY_BOSS_SLOW_C=fixedPalette(ENEMY_BOSS_C,{torso:'#9b3fb0'});
const ENEMY_WEAK_C=fixedPalette(ENEMY_C,{torso:'#6b7280'});
const ENEMY_BOSS_WEAK_C=fixedPalette(ENEMY_BOSS_C,{torso:'#6b7280'});
function enemyPalette(o){
  const boss=!!o.isBoss;
  if(o.flash>0) return boss?ENEMY_BOSS_FLASH_C:ENEMY_FLASH_C;
  if(o.freezeT>0) return boss?ENEMY_BOSS_FREEZE_C:ENEMY_FREEZE_C;
  if(o.burnT>0) return boss?ENEMY_BOSS_BURN_C:ENEMY_BURN_C;
  if(o.poisonT>0) return boss?ENEMY_BOSS_POISON_C:ENEMY_POISON_C;
  if(o.slowT>0) return boss?ENEMY_BOSS_SLOW_C:ENEMY_SLOW_C;
  if(o.weakT>0) return boss?ENEMY_BOSS_WEAK_C:ENEMY_WEAK_C;
  return boss?ENEMY_BOSS_C:ENEMY_C;
}

// ---- 네온 디오라마 조명·후처리 ----
let backdrop=null, postFx=null;
function buildBackdrop(){
  backdrop=document.createElement('canvas');
  backdrop.width=Math.max(1,Math.round(W*DPR)); backdrop.height=Math.max(1,Math.round(H*DPR));
  const g=backdrop.getContext('2d'); g.setTransform(DPR,0,0,DPR,0,0);
  const sky=g.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#071126'); sky.addColorStop(.55,'#0a1730'); sky.addColorStop(1,'#050a15');
  g.fillStyle=sky; g.fillRect(0,0,W,H);
  const halo=g.createRadialGradient(W*.52,H*.52,0,W*.52,H*.52,Math.max(W,H)*.62);
  halo.addColorStop(0,'rgba(65,126,214,.22)'); halo.addColorStop(.4,'rgba(25,66,125,.09)'); halo.addColorStop(1,'rgba(2,5,13,0)');
  g.fillStyle=halo; g.fillRect(0,0,W,H);
  const rnd=mulberry32(90210);
  for(let i=0;i<Math.min(120,Math.round(W*H/9000));i++){
    const x=rnd()*W,y=rnd()*H*.82,r=.25+rnd()*.9;
    g.fillStyle='rgba(145,195,255,'+(.05+rnd()*.16)+')';
    g.beginPath(); g.arc(x,y,r,0,7); g.fill();
  }
}
function worldFootprint(g,z){
  g.beginPath();
  g.moveTo(isoX(0,0),isoY(0,0,z)); g.lineTo(isoX(WORLD.w,0),isoY(WORLD.w,0,z));
  g.lineTo(isoX(WORLD.w,WORLD.h),isoY(WORLD.w,WORLD.h,z));
  g.lineTo(isoX(0,WORLD.h),isoY(0,WORLD.h,z)); g.closePath();
}
function drawPlateBase(g){
  g.save(); g.filter='blur('+Math.max(10,25*CAM.scale)+'px)';
  g.fillStyle='rgba(0,0,0,.52)'; worldFootprint(g,-48); g.fill(); g.restore();
  const c=[[0,0],[WORLD.w,0],[WORLD.w,WORLD.h],[0,WORLD.h]], z0=0,z1=-34;
  for(let i=0;i<4;i++){
    const rnx=_nX[i]*CAM.cos-_nY[i]*CAM.sin, rny=_nX[i]*CAM.sin+_nY[i]*CAM.cos;
    if(rnx+rny<=0) continue;
    const j=(i+1)&3, grad=g.createLinearGradient(0,isoY(c[i][0],c[i][1],z0),0,isoY(c[i][0],c[i][1],z1));
    grad.addColorStop(0,rnx>rny?'#285b48':'#214339'); grad.addColorStop(1,'#10272a');
    g.fillStyle=grad; g.beginPath();
    g.moveTo(isoX(c[i][0],c[i][1]),isoY(c[i][0],c[i][1],z0));
    g.lineTo(isoX(c[j][0],c[j][1]),isoY(c[j][0],c[j][1],z0));
    g.lineTo(isoX(c[j][0],c[j][1]),isoY(c[j][0],c[j][1],z1));
    g.lineTo(isoX(c[i][0],c[i][1]),isoY(c[i][0],c[i][1],z1));
    g.closePath(); g.fill();
  }
  const turf=g.createLinearGradient(0,H*.18,0,H*.88);
  turf.addColorStop(0,'#79c94b'); turf.addColorStop(.48,'#55a93c'); turf.addColorStop(1,'#357a38');
  g.fillStyle=turf; worldFootprint(g,0); g.fill();
  g.strokeStyle='rgba(171,255,132,.38)'; g.lineWidth=Math.max(1,2*CAM.scale); worldFootprint(g,0); g.stroke();
}
function screenEllipse(g,x,y,z,rx,ry,fill,stroke,lw){
  const sx=isoX(x,y),sy=isoY(x,y,z||0),ex=rx*ISO_X*1.42*CAM.scale,ey=ry*ISO_Y*1.42*CAM.scale;
  if(fill){ g.fillStyle=fill; g.beginPath(); g.ellipse(sx,sy,ex,ey,0,0,7); g.fill(); }
  if(stroke){ g.strokeStyle=stroke; g.lineWidth=lw||1; g.beginPath(); g.ellipse(sx,sy,ex,ey,0,0,7); g.stroke(); }
}
function drawDecorShadows(g){
  for(const d of DECOR){
    const r=d.kind==='tree'?24*d.s:d.kind==='rock'?17*d.s:d.kind==='bush'?15*d.s:5;
    screenEllipse(g,d.x+9,d.y+9,0,r,r*.78,'rgba(4,16,15,.24)');
  }
}
function drawEntityShadow(g,o,kind){
  const r=kind==='t' ? Math.max(16,tdef(o).base*.55) : kind==='e' ? o.r*1.35 : 18;
  const a=(kind==='e'&&o.isBoss) ? .34 : .22;
  screenEllipse(g,o.x+7,o.y+8,0,r,r*.72,'rgba(1,8,13,'+a+')');
  screenEllipse(g,o.x+3,o.y+4,0,r*.62,r*.42,'rgba(1,5,10,.18)');
}
function drawWorldAtmosphere(g){
  g.save(); g.globalCompositeOperation='lighter';
  const pulse=.5+.5*Math.sin(G.anim*2.6), b=baseNode(), s=WP[0];
  screenEllipse(g,b.x,b.y,1,88+pulse*8,88+pulse*8,'rgba(38,244,190,'+(.055+pulse*.035)+')','rgba(91,255,218,.45)',Math.max(1,1.5*CAM.scale));
  screenEllipse(g,s.x,s.y,1,34+pulse*6,34+pulse*6,'rgba(255,67,104,'+(.08+pulse*.04)+')','rgba(255,98,126,.58)',Math.max(1,1.4*CAM.scale));
  for(const pd of PONDS){
    const q=.5+.5*Math.sin(G.anim*1.35+pd.x*.013);
    screenEllipse(g,pd.x,pd.y,1,pd.r*(.64+q*.08),pd.r*(.64+q*.08),null,'rgba(117,225,255,'+(.16+q*.16)+')',Math.max(.7,1.2*CAM.scale));
  }
  g.restore();
}
function ringFx(x,y,color,size,life){ if(G.rings.length<80) G.rings.push({x,y,color,size:size||28,life:life||.45,t:0}); }
function drawRings(g){
  g.save(); g.globalCompositeOperation='lighter';
  for(const r of G.rings){
    const p=Math.min(1,r.t/r.life),sz=r.size*(.25+p),a=(1-p)*.8;
    screenEllipse(g,r.x,r.y,4,sz,sz,null,r.color.replace(')',','+a+')').replace('rgb','rgba'),Math.max(1,(3-p*2)*CAM.scale));
  }
  g.restore();
}
function buildPostFx(){
  postFx=document.createElement('canvas');
  postFx.width=Math.max(1,Math.round(W*DPR)); postFx.height=Math.max(1,Math.round(H*DPR));
  const g=postFx.getContext('2d'); g.setTransform(DPR,0,0,DPR,0,0);
  const grade=g.createLinearGradient(0,0,0,H);
  grade.addColorStop(0,'rgba(90,145,255,.035)'); grade.addColorStop(.55,'rgba(0,0,0,0)'); grade.addColorStop(1,'rgba(1,5,14,.13)');
  g.fillStyle=grade; g.fillRect(0,0,W,H);
  const vig=g.createRadialGradient(W/2,H*.48,Math.min(W,H)*.24,W/2,H*.48,Math.max(W,H)*.74);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(.72,'rgba(0,0,0,.06)'); vig.addColorStop(1,'rgba(0,0,0,.42)');
  g.fillStyle=vig; g.fillRect(0,0,W,H);
}
function drawPostFx(g){ if(postFx) g.drawImage(postFx,0,0,W,H); }

// ---- 지면 캐시(정적) ----
let ground=null;
function buildGround(){
  ground=document.createElement('canvas');
  ground.width=Math.max(1,Math.round(W*DPR)); ground.height=Math.max(1,Math.round(H*DPR));
  const g=ground.getContext('2d');
  g.setTransform(DPR,0,0,DPR,0,0);
  const wd=WORLD.w, hd=WORLD.h;

  // 두께·그림자·상단 림을 가진 부유형 베이스플레이트
  drawPlateBase(g);
  // 잔디 얼룩·연못은 베이스플레이트 밖으로 나가지 않도록 잘라낸다
  g.save();
  g.beginPath();
  g.moveTo(isoX(0,0),isoY(0,0,0)); g.lineTo(isoX(wd,0),isoY(wd,0,0));
  g.lineTo(isoX(wd,hd),isoY(wd,hd,0)); g.lineTo(isoX(0,hd),isoY(0,hd,0));
  g.closePath(); g.clip();
  // 잔디 얼룩 : 밋밋한 단색 대신 밝고 어두운 풀밭이 섞이게
  const grnd=mulberry32(77+G.pathIndex*131);
  for(let i=0;i<70;i++){
    const x=grnd()*wd, y=grnd()*hd, r=40+grnd()*90;
    g.fillStyle = grnd()<0.5 ? 'rgba(120,200,80,.20)' : 'rgba(60,140,50,.18)';
    g.beginPath(); g.ellipse(isoX(x,y),isoY(x,y,0), r*ISO_X*1.42*CAM.scale, r*ISO_Y*1.42*CAM.scale,0,0,7); g.fill();
  }
  // 연못
  for(const pd of PONDS){
    const rx=pd.r*ISO_X*1.42*CAM.scale, ry=pd.r*ISO_Y*1.42*CAM.scale;
    g.fillStyle='rgba(40,90,70,.55)';
    g.beginPath(); g.ellipse(isoX(pd.x,pd.y),isoY(pd.x,pd.y,0), rx*1.08, ry*1.08,0,0,7); g.fill();
    g.fillStyle='#2f8fd0';
    g.beginPath(); g.ellipse(isoX(pd.x,pd.y),isoY(pd.x,pd.y,0), rx, ry,0,0,7); g.fill();
    g.fillStyle='rgba(160,225,255,.45)';
    g.beginPath(); g.ellipse(isoX(pd.x-pd.r*0.25,pd.y-pd.r*0.25),isoY(pd.x-pd.r*0.25,pd.y-pd.r*0.25,0),
      rx*0.42, ry*0.42,0,0,7); g.fill();
  }
  g.restore();
  // 스터드
  for(let x=32;x<wd;x+=64) for(let y=32;y<hd;y+=64) stud(g,x,y,0,11,'rgba(255,255,255,.13)');

  // 도로: 어두운 배수 숄더 → 밝은 커브 → 아스팔트의 3중 재질
  const RW=54;
  const roadBand=(rw,col,z)=>{
    g.fillStyle=col;
    for(let i=0;i<WP.length-1;i++){
      const a=WP[i], b=WP[i+1],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
      const nx=-dy/L*rw/2,ny=dx/L*rw/2;
      const c=[[a.x+nx,a.y+ny],[b.x+nx,b.y+ny],[b.x-nx,b.y-ny],[a.x-nx,a.y-ny]];
      g.beginPath(); g.moveTo(isoX(c[0][0],c[0][1]),isoY(c[0][0],c[0][1],z));
      for(let k=1;k<4;k++) g.lineTo(isoX(c[k][0],c[k][1]),isoY(c[k][0],c[k][1],z));
      g.closePath(); g.fill();
    }
    for(const p of WP){ g.beginPath(); g.ellipse(isoX(p.x,p.y),isoY(p.x,p.y,z),
      rw/2*ISO_X*1.42*CAM.scale,rw/2*ISO_Y*1.42*CAM.scale,0,0,7); g.fill(); }
  };
  roadBand(RW+18,'#33404d',.24);
  roadBand(RW+9,'#5b6875',.44);
  roadBand(RW,'#838b98',.68);
  // 중앙선
  g.strokeStyle='rgba(255,226,116,.72)'; g.lineWidth=Math.max(1,2.2*CAM.scale); g.setLineDash([7*CAM.scale,9*CAM.scale]);
  g.beginPath(); g.moveTo(isoX(WP[0].x,WP[0].y),isoY(WP[0].x,WP[0].y,0.8));
  for(let i=1;i<WP.length;i++) g.lineTo(isoX(WP[i].x,WP[i].y),isoY(WP[i].x,WP[i].y,0.8));
  g.stroke(); g.setLineDash([]);

  // 기지 패드
  const b=baseNode();
  g.fillStyle='rgba(56,232,176,.30)';
  g.beginPath(); g.ellipse(isoX(b.x,b.y),isoY(b.x,b.y,1), 96*ISO_X*1.42*CAM.scale, 96*ISO_Y*1.42*CAM.scale,0,0,7); g.fill();
  g.strokeStyle='rgba(56,232,176,.75)'; g.lineWidth=Math.max(1,2.5*CAM.scale);
  g.beginPath(); g.ellipse(isoX(b.x,b.y),isoY(b.x,b.y,1), 96*ISO_X*1.42*CAM.scale, 96*ISO_Y*1.42*CAM.scale,0,0,7); g.stroke();
  // 스폰 패드 + 적 진영 문
  const s0=WP[0];
  g.fillStyle='rgba(255,90,106,.45)';
  g.beginPath(); g.ellipse(isoX(s0.x,s0.y),isoY(s0.x,s0.y,1), 38*ISO_X*1.42*CAM.scale, 38*ISO_Y*1.42*CAM.scale,0,0,7); g.fill();

  // 장식물(나무·바위·덤불·꽃·울타리) — 정적이라 여기서 한 번만 그린다
  drawDecorShadows(g);
  drawDecor(g);

  // 기지 깃발 : 목표 지점을 눈에 띄게
  box(g,b.x-52,b.y-52,0,10,10,44,'#7a5a34');
  box(g,b.x-52+11,b.y-52,32,22,4,14,'#38e8b0');
  box(g,b.x+52,b.y+52,0,10,10,44,'#7a5a34');
  box(g,b.x+52-11,b.y+52,32,22,4,14,'#38e8b0');
  // 적 진영 표식
  box(g,s0.x,s0.y-34,0,8,8,34,'#5b2130');
  box(g,s0.x+9,s0.y-34,24,18,4,12,'#ff5a6a');

  // (포탑은 정해진 자리 없이 어디에나 놓을 수 있으므로 자리 표시는 그리지 않는다)
}

function resize(){
  DPR=Math.min(MOBILE_GPU?1.5:2, window.devicePixelRatio||1);
  W=cv.clientWidth; H=cv.clientHeight; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  fitCamera(); buildBackdrop(); buildGround(); buildPostFx();
  if(G.allies.length) layoutAllies();
}
window.addEventListener('resize', resize);
