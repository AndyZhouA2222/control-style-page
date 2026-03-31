import * as THREE from 'three';
import { GLTFLoader } from './libs/GLTFLoader.js';

// -------------------------------------------------------
// Camera position, change its value to adjust the camera
// -------------------------------------------------------
const CAMERAS = [
  { name: "MAIN",  pos: [0.0, 4.0059, 28.0],    target: [0.0, 7.27, 12.5022] },
  { name: "side",   pos: [3.6527, 1.6361, 25.6215],  target: [0.9227, 6.7443, 17.4695] },
  { name: "ALTAR VIEW", pos: [10, 4, 8],                  target: [-2, 7, -4] },
];

// -------------------------------------------------------
// clickable note and image id
// -------------------------------------------------------
const NODES = [
  { id:"overview",  label:"Overview",         subtitle:"Andy",   x:50, y:12, symbol:"\u25C8",
    image:"images/overview.png", aspect:"portrait",
    desc:"", details:[] },
  { id:"pillars",   label:"THE PILLARS",          subtitle:"Please do not count", x:15, y:38, symbol:"\u2551",
    image:"images/pillars.png", aspect:"portrait",
    desc:"", details:[] },
  { id:"ceiling",   label:"THE RECEIVER",         subtitle:"Please remain silent near",    x:50, y:34, symbol:"\u25A1",
    image:"images/receiver.png", aspect:"landscape",
    desc:"", details:[] },
  { id:"floor",     label:"THE SEAL",     subtitle:"Please do not look into",       x:85, y:38, symbol:"\u25C7",
    image:"images/seal.png", aspect:"landscape",
    desc:"", details:[] },
  { id:"hanging",   label:"THE GATE",          subtitle:"Please walk slowly through",   x:35, y:62, symbol:"\u25BD",
    image:"images/gate.png", aspect:"portrait",
    desc:"", details:[] },
  { id:"walls",     label:"THE WALL",          subtitle:"Please do not question",  x:65, y:62, symbol:"\u2261",
    image:"images/wall.png", aspect:"landscape",
    desc:"", details:[] },
  { id:"entrance",  label:"THE COURT",        subtitle:"Please do not linger in",          x:50, y:88, symbol:"\u2293",
    image:"images/court.png", aspect:"portrait",
    desc:"", details:[] },
];

// -------------------------------------------------------
// connection between nodes
// -------------------------------------------------------
const CONNECTIONS = [
  ["overview","pillars"],["overview","ceiling"],["overview","floor"],
  ["ceiling","hanging"],["ceiling","walls"],["pillars","walls"],
  ["floor","entrance"],["walls","entrance"],["hanging","entrance"],
];

// -------------------------------------------------------
// State variable
// -------------------------------------------------------
let curCam=0, curNode=null, pOpen=false, hoverNode=null;
function getNode(id){return NODES.find(n=>n.id===id)}
function getLinks(id){return CONNECTIONS.filter(([a,b])=>a===id||b===id).map(([a,b])=>a===id?b:a)}

// THREE.JS
const container=document.getElementById('scene-container');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0c0c0f);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
container.appendChild(renderer.domElement);

// -------------------------------------------------------
// dirty flag Optimization  refer to https://java-design-patterns.com/patterns/dirty-flag/
// -------------------------------------------------------
let dirty=true;
function markDirty(){dirty=true;}

// CAMERA TWEEN
const ZOOM_CAM = { pos: [-0.11, 16.1133, 19.5857], target: [-0.0402, 16.7412, 9.6057] };
let tween = null;
function tweenCam(toPos, toTarget, duration=1800, onDone){
  const fromPos = camera.position.clone();
  const fromTarget = new THREE.Vector3(...CAMERAS[curCam].target);
  let curTarget;
  if(tween && tween.toTarget) curTarget = tween.toTarget.clone();
  else curTarget = fromTarget;
  const start = performance.now();
  const to = { pos: new THREE.Vector3(...toPos), target: new THREE.Vector3(...toTarget) };
  tween = { toTarget: to.target, active: true };
  function tick(now){
    if(!tween || !tween.active) return;
    const t = Math.min((now - start) / duration, 1);
    const e = t<0.5 ? 2*t*t : -1+(4-2*t)*t;
    camera.position.lerpVectors(fromPos, to.pos, e);
    const lerpTarget = new THREE.Vector3().lerpVectors(curTarget, to.target, e);
    camera.lookAt(lerpTarget);
    markDirty();
    if(t < 1) requestAnimationFrame(tick);
    else { tween = null; if(onDone) onDone(); }
  }
  requestAnimationFrame(tick);
}

let zoomed = false;
function toggleZoom(){
  const btn = document.getElementById('zoomBtn');
  if(!zoomed){
    tweenCam(ZOOM_CAM.pos, ZOOM_CAM.target, 1800, ()=>{ zoomed=true; if(btn){btn.textContent='⬡ZOOM OUT';btn.classList.add('active');} });
  } else {
    const p = CAMERAS[curCam];
    tweenCam(p.pos, p.target, 1800, ()=>{ zoomed=false; if(btn){btn.textContent='⬡ZOOM IN';btn.classList.remove('active');} });
  }
}

// Immediately switch to the specified preset camera position and reset zoom state and ui
function applyCam(i){const p=CAMERAS[i];camera.position.set(...p.pos);camera.lookAt(new THREE.Vector3(...p.target));curCam=i;zoomed=false;markDirty();const btn=document.getElementById('zoomBtn');if(btn){btn.textContent='⬡ZOOM IN';btn.classList.remove('active');}document.getElementById('viewName').textContent=p.name;document.getElementById('statusCam').textContent=String(i+1).padStart(2,'0');renderCamBtns();}

const gr=new THREE.GridHelper(30,30,0x1a1a2e,0x12121a);gr.position.y=0.01;scene.add(gr);
applyCam(0);

// GLB LOADER
function loadGLB(path, options={}){
  const loader=new GLTFLoader();
  loader.load(
    path,
    (gltf)=>{
      const model=gltf.scene;
      if(options.position) model.position.set(...options.position);
      if(options.rotation) model.rotation.set(...options.rotation);
      if(options.scale){
        const s=Array.isArray(options.scale)?options.scale:[options.scale,options.scale,options.scale];
        model.scale.set(...s);
      }
      if(options.wireframe){
        model.traverse(child=>{
          if(child.isMesh){
            const edges=new THREE.LineSegments(
              new THREE.EdgesGeometry(child.geometry,45), // Show only hard edges greater than 45° // 
              new THREE.LineBasicMaterial({color:0xe94560,transparent:true,opacity:0.5})
            );
            edges.position.copy(child.position);
            edges.rotation.copy(child.rotation);
            edges.scale.copy(child.scale);
            child.parent.add(edges);
            child.material=new THREE.MeshBasicMaterial({color:0x15151c});
          }
        });
      }
      scene.add(model);
      if(options.onLoad) options.onLoad(model, gltf);
      markDirty();
      console.log('[GLB] Loaded:', path);
    },
    (xhr)=>{ if(xhr.lengthComputable){ const pct=Math.round(xhr.loaded/xhr.total*100); console.log('[GLB] '+pct+'% loaded'); if(options.onProgress) options.onProgress(pct); } },
    (err)=>{ console.error('[GLB] Failed to load:', path, err); }
  );
}

// LOAD MODEL
const MODEL_LOCAL='models/model.glb';
const MODEL_REMOTE='https://storage.googleapis.com/modelandyzzz/model.glb';
const modelOpts={
  position:[0,0,0],rotation:[0,0,0],scale:1,wireframe:true,
  onProgress:(pct)=>{
    const bar=document.getElementById('preBar');
    const pctEl=document.getElementById('prePct');
    const label=document.getElementById('preLabel');
    const enterBtn=document.getElementById('preEnter');
    if(bar)bar.style.width=pct+'%';
    if(pctEl)pctEl.textContent=pct+'%';
    if(label)label.textContent=pct<100?'LOADING SECTOR DATA':'RENDERING';
  },
  onLoad:(model)=>{
    markDirty();
    const pre=document.getElementById('preloader');
    const enterBtn=document.getElementById('preEnter');
    const label=document.getElementById('preLabel');
    if(label)label.textContent='READY';
    if(enterBtn)enterBtn.classList.add('visible');
    if(enterBtn&&pre){
      // Timing of the animation after clicking enter
      // sequence: preloader fade-out → Andy (5.1s) → sound effect → Neva (5.1s)
      enterBtn.addEventListener('click',()=>{
        pre.classList.add('pre-done');
        pre.addEventListener('transitionend',()=>{
          pre.remove();
          const atPre=document.getElementById('area-title-pre');
          const at=document.getElementById('area-title');
          if(atPre){
            atPre.classList.add('active');
            setTimeout(()=>{
              atPre.classList.remove('active');
              setTimeout(()=>{
                const snd2=document.getElementById('areaSound');
                if(snd2){snd2.volume=1.0;snd2.preservesPitch=false;snd2.playbackRate=1.0;snd2.play().catch(()=>{});}
                if(at){at.classList.add('active');setTimeout(()=>at.classList.remove('active'),5100);}
              },400);
            },5100);
          } else if(at){
            at.classList.add('active');setTimeout(()=>at.classList.remove('active'),5100);
          }
        },{once:true});
      },{once:true});
    }
  }
};

// zombie MODE: uncomment the line below and comment out ONLINE MODE to use local model
//loadGLB(MODEL_LOCAL, modelOpts);

// ONLINE MODE: comment out the lines below when using zombie MODE
const isLocal=false;
loadGLB(isLocal?MODEL_LOCAL:MODEL_REMOTE,modelOpts);

// Variables for the FPS counter
let fc=0,lt=performance.now();const fpsEl=document.getElementById('statusFps');
function animate(){
  requestAnimationFrame(animate);
  if(!dirty) return;
  dirty=false;
  renderer.render(scene,camera);
  fc++;
  const n=performance.now();
  if(n-lt>=1000){fpsEl.textContent=fc;fc=0;lt=n;}
}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);const p=CAMERAS[curCam];camera.lookAt(new THREE.Vector3(...p.target));markDirty();});

// CAM BUTTONS
function renderCamBtns(){const el=document.getElementById('camButtons');el.innerHTML='';CAMERAS.forEach((c,i)=>{const b=document.createElement('button');b.className='cam-btn'+(curCam===i?' active':'');b.innerHTML=`${i+1}<span class="cam-btn-name">${c.name}</span>`;b.addEventListener('click',()=>applyCam(i));el.appendChild(b);});}

// TABS
function renderTabs(){const el=document.getElementById('nodeTabs');el.innerHTML='';NODES.forEach(n=>{const b=document.createElement('button');b.className='node-tab'+(curNode===n.id?' active':'');b.innerHTML=`<span class="tab-symbol">${n.symbol}</span>${n.label}`;b.addEventListener('click',()=>{curNode=curNode===n.id?null:n.id;if(curNode&&!pOpen)pOpen=true;renderAll();});el.appendChild(b);});}

// MAP
function renderMapCon(){const svg=document.getElementById('mapSvg');svg.innerHTML='';CONNECTIONS.forEach(([fI,tI])=>{const f=getNode(fI),t=getNode(tI),isA=curNode===fI||curNode===tI,isH=hoverNode===fI||hoverNode===tI;const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',f.x+'%');l.setAttribute('y1',f.y+'%');l.setAttribute('x2',t.x+'%');l.setAttribute('y2',t.y+'%');l.setAttribute('stroke',isA?'#e94560':isH?'#e9456050':'#1e1e28');l.setAttribute('stroke-width',isA?1.5:0.5);l.setAttribute('stroke-dasharray',isA?'none':'3 5');svg.appendChild(l);});}

function renderMapNodes(){const c=document.getElementById('mapNodes');c.innerHTML='';NODES.forEach(n=>{const isA=curNode===n.id,isCon=curNode&&getLinks(curNode).includes(n.id),isD=curNode&&!isA&&!isCon;const el=document.createElement('div');el.className='map-node'+(isA?' active':'')+(isD?' dimmed':'');el.style.left=n.x+'%';el.style.top=n.y+'%';el.innerHTML=`<div class="map-symbol"><span>${n.symbol}</span></div><div class="map-label">${n.label}</div>`;el.addEventListener('click',()=>{curNode=isA?null:n.id;renderAll();});el.addEventListener('mouseenter',()=>{hoverNode=n.id;renderMapCon();});el.addEventListener('mouseleave',()=>{hoverNode=null;renderMapCon();});c.appendChild(el);});}

// CIPHER
// Convert the specified text to ASCII code
function cipher(word){
  const ascii=Array.from(word).map(c=>c.charCodeAt(0)).join(' ');
  return `<cipher data="${word}">${ascii}</cipher>`;
}

const Cipher=(()=>{
  const unlocked=new Set();

  function parse(text){
    return text.replace(/<cipher data="([^"]+)">([^<]+)<\/cipher>/g,(match,original,ascii)=>{
      if(unlocked.has(original))return `<span class="cipher-unlocked">${original}</span>`;
      const id='cipher-'+btoa(String.fromCharCode(...new TextEncoder().encode(original))).replace(/=/g,'');
      return `<span class="cipher-block" data-original="${original}" data-ascii="${ascii}" id="${id}">${ascii}<span class="cipher-hint">⬡ENCRYPTED</span></span>`;
    });
  }

  function bind(onUnlock){
    document.querySelectorAll('.cipher-block').forEach(el=>{
      if(el.dataset.bound)return;
      el.dataset.bound='1';
      el.addEventListener('mouseenter',()=>{
        if(!el.querySelector('.cp-tooltip')){
          const tip=document.createElement('span');
          tip.className='cp-tooltip';
          tip.textContent='CLICK TO UNLOCK';
          el.appendChild(tip);
        }
      });
      el.addEventListener('mouseleave',()=>{
        el.querySelector('.cp-tooltip')?.remove();
      });
      el.addEventListener('click',()=>_showPopup(el,onUnlock));
    });
  }

  function _showPopup(el,onUnlock){
    if(document.getElementById('cipher-popup'))return;
    const original=el.dataset.original;
    const overlay=document.createElement('div');
    overlay.id='cipher-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:599;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);';
    document.body.appendChild(overlay);
    const popup=document.createElement('div');
    popup.id='cipher-popup';
    popup.className='cipher-popup';
    popup.innerHTML=`<div class="cp-label">⬡ DECRYPT SEQUENCE — ENTER KEYWORD</div><div class="cp-ascii">${el.dataset.ascii}</div><input class="cp-input" type="text" placeholder="Enter keyword..." autocomplete="off" spellcheck="false"><div class="cp-hint">TYPE THE CORRECT WORD TO UNLOCK — <a href="https://www.asciitable.com" target="_blank" class="cp-link">ASCII TABLE</a></div><div class="cp-err" id="cp-err"></div>`;
    document.body.appendChild(popup);
    const input=popup.querySelector('.cp-input');
    input.focus();
    let closing=false;
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        const val=input.value.trim().toLowerCase();
        if(val===original.toLowerCase()){
          unlocked.add(original);
          popup.classList.add('cp-success');
          popup.querySelector('.cp-label').textContent='⬡ DECRYPTED';
          setTimeout(()=>{popup.remove();document.getElementById('cipher-overlay')?.remove();if(onUnlock)onUnlock();},600);
        } else {
          const err=document.getElementById('cp-err');
          err.textContent='ACCESS DENIED — INCORRECT KEY';
          input.classList.add('cp-shake');
          setTimeout(()=>input.classList.remove('cp-shake'),400);
        }
      } else if(e.key==='Escape'){closing=true;popup.remove();document.getElementById('cipher-overlay')?.remove();}
    });
    const close=e=>{
      if(!closing&&!popup.contains(e.target)&&e.target!==el){popup.remove();document.getElementById('cipher-overlay')?.remove();document.removeEventListener('mousedown',close);}
    };
    setTimeout(()=>document.addEventListener('mousedown',close),100);
  }

  return{parse,bind};
})();

// DETAIL
// Generate random garbled strings for decoration
function genStamp(){
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const syms=['⬡','◈','◇','◆','▽','▼','△'];
  const totalLen=Math.floor(Math.random()*21)+20;
  const chunks=Math.floor(Math.random()*3)+3;
  const parts=[];
  let remaining=totalLen;
  for(let i=0;i<chunks;i++){
    const isLast=i===chunks-1;
    const len=isLast?remaining:Math.floor(remaining/(chunks-i)*(0.6+Math.random()*0.8));
    remaining-=len;
    let word='';
    for(let j=0;j<len;j++){
      if(Math.random()<0.1) word+=syms[Math.floor(Math.random()*syms.length)];
      else word+=letters[Math.floor(Math.random()*letters.length)];
    }
    parts.push(word);
  }
  return parts.join(' ');
}
function applyStamp(){
  const stamp=document.querySelector('.stamp-mini');
  if(!stamp)return;
  const fonts=['CodeLang','NuCore','SynGen'];
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const syms=['⬡','◈','◇','◆','▽','▼','△'];
  const finalText=genStamp();
  const chars=[...finalText];
  const assignedFonts=chars.map(ch=>ch===' '?'':fonts[Math.floor(Math.random()*fonts.length)]);
  stamp.innerHTML='';
  const spans=chars.map((ch,i)=>{
    const s=document.createElement('span');
    s.textContent=ch;
    if(assignedFonts[i]) s.style.fontFamily=assignedFonts[i]+',monospace';
    stamp.appendChild(s);
    return s;
  });
  const duration=1400;
  const start=performance.now();
  const locked=new Array(chars.length).fill(false);
  // font animation, randomly scrolling and then locking one by one
  function scramble(now){
    const elapsed=now-start;
    const progress=Math.min(elapsed/duration,1);
    spans.forEach((s,i)=>{
      if(chars[i]===' '){s.textContent=' ';return;}
      if(!locked[i]&&Math.random()<progress*0.15){locked[i]=true;s.textContent=chars[i];}
      if(!locked[i]){
        const pool=Math.random()<0.1?syms:null;
        s.textContent=pool?pool[Math.floor(Math.random()*pool.length)]:letters[Math.floor(Math.random()*letters.length)];
      }
    });
    if(progress<1) requestAnimationFrame(scramble);
    else spans.forEach((s,i)=>s.textContent=chars[i]);
  }
  requestAnimationFrame(scramble);
}
function renderDetail(){
  const empty=document.getElementById('emptyState'),content=document.getElementById('detailContent');
  const preview=document.getElementById('imagePreview'),ph=document.getElementById('imagePlaceholder');
  const oldImg=preview.querySelector('img'); if(oldImg)oldImg.remove(); ph.style.display='flex';
  if(!curNode){empty.style.display='flex';content.style.display='none';return;}
  const d=getNode(curNode); empty.style.display='none'; content.style.display='block';
  document.getElementById('dSubtitle').textContent=d.subtitle;
  document.getElementById('dTitle').textContent=d.label;
  document.getElementById('dDesc').innerHTML=Cipher.parse(d.desc);
  Cipher.bind(renderDetail);
  if(d.image){
    const img=document.createElement('img'); img.src=d.image; img.alt=d.label;
    img.addEventListener('load',()=>{img.classList.add('loaded');ph.style.display='none';});
    img.addEventListener('error',()=>img.remove());
    img.addEventListener('click',()=>openLB(d.image,d.label));
    preview.appendChild(img);
  }
  const det=document.getElementById('dDetails');det.innerHTML='';
  d.details.forEach((t,i)=>{const r=document.createElement('div');r.className='tech-row';r.innerHTML=`<div class="tech-num">${String(i+1).padStart(2,'0')}</div><span class="tech-text">${t}</span>`;det.appendChild(r);});
  const lnk=document.getElementById('dLinks');lnk.innerHTML='';
  getLinks(curNode).forEach(lid=>{const ln=getNode(lid);const b=document.createElement('button');b.className='link-btn';b.innerHTML=`<span class="sym">${ln.symbol}</span>${ln.label}`;b.addEventListener('click',()=>{curNode=lid;renderAll();});lnk.appendChild(b);});
  applyStamp();
}

// LIGHTBOX
function openLB(src,label){const lb=document.getElementById('lightbox');document.getElementById('lightboxImg').src=src;document.getElementById('lightboxLabel').textContent=label;lb.style.display='flex';requestAnimationFrame(()=>lb.classList.add('open'));}
function closeLB(){const lb=document.getElementById('lightbox');lb.classList.remove('open');setTimeout(()=>{lb.style.display='none';},300);}
document.getElementById('lightboxClose').addEventListener('click',closeLB);
document.getElementById('lightbox').addEventListener('click',e=>{if(e.target===e.currentTarget)closeLB();});

// STATUS
function renderStatus(){const d=curNode?getNode(curNode):null;document.getElementById('statusActive').textContent='SECTOR: '+(d?d.subtitle:'NONE');document.getElementById('statusState').textContent=curNode?'VIEWING':'STANDBY';}
function renderPanel(){const dd=document.getElementById('dropdown'),tb=document.getElementById('topbar'),btn=document.getElementById('toggleBtn');if(pOpen){dd.classList.add('open');tb.classList.add('panel-open');btn.classList.add('open');btn.textContent='\u25B2';document.body.classList.add('panel-open');}else{dd.classList.remove('open');tb.classList.remove('panel-open');btn.classList.remove('open');btn.textContent='\u25BC';document.body.classList.remove('panel-open');}}
function renderAll(){renderTabs();renderMapCon();renderMapNodes();renderDetail();renderStatus();renderPanel();renderCamBtns();}

// EVENTS
document.getElementById('toggleBtn').addEventListener('click',()=>{pOpen=!pOpen;renderAll();});
document.getElementById('zoomBtn').addEventListener('click',toggleZoom);
document.addEventListener('keydown',e=>{
  if(e.key==='1')applyCam(0);else if(e.key==='2')applyCam(1);else if(e.key==='3')applyCam(2);
  else if(e.key==='Tab'){e.preventDefault();pOpen=!pOpen;renderAll();}
  else if(e.key==='Escape'){if(document.getElementById('lightbox').classList.contains('open')){closeLB();return;}if(curNode){curNode=null;}else if(pOpen){pOpen=false;}renderAll();}
});

// CONTENT LOADER
// Parsing content-desc.txt
function parseContent(text){
  function applyCipherSyntax(str){
    return str.replace(/\[\[([^\]]+)\]\]/g,(_,w)=>cipher(w));
  }
  const lines=text.split('\n');
  let curId=null,mode=null,descLines=[],detailLines=[];
  function flush(){
    if(!curId)return;
    const node=getNode(curId);
    if(node){
      if(descLines.length)node.desc=applyCipherSyntax(descLines.join(' ').trim());
      if(detailLines.length)node.details=detailLines.slice(0,3);
    }
    curId=null;descLines=[];detailLines=[];mode=null;
  }
  for(const raw of lines){
    const line=raw.trim();
    if(!line||line.startsWith('//'))continue;
    const dm=line.match(/^DESC_(\w+):$/);
    const tm=line.match(/^DETAILS_(\w+):$/);
    if(dm){flush();curId=dm[1];mode='desc';continue;}
    if(tm){if(tm[1]===curId)mode='details';continue;}
    if(mode==='desc')descLines.push(line);
    else if(mode==='details')detailLines.push(line);
  }
  flush();
}
fetch('content-desc.txt')
  .then(r=>r.text())
  .then(text=>{parseContent(text);renderAll();})
  .catch(()=>renderAll());