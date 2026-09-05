import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadPinnedPolicy,assertPolicy,sha256,canonical,validateLights,deepFreeze} from '../assets/guards.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const POLICY='80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`资料载入失败 ${r.status}`);return r.json();}
async function boot(){
 const [auditBytes,build,policy]=await Promise.all([fetch('./data/audit.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('预审数据未取得');return r.arrayBuffer();}),json('../data/build.json'),loadPinnedPolicy('../data/MOTHER_UNIFIED_POLICY_V1.0.0.json',POLICY)]);
 if(await sha256(auditBytes)!==build.auditSha256)throw Error('预审数据哈希不匹配');
 const audit=deepFreeze(JSON.parse(new TextDecoder().decode(auditBytes)));deepFreeze(build);
 if(build.policySha256!==POLICY||audit.sourceCommit!==build.sourceCommit)throw Error('规则或预审构建身份不一致');
 assertPolicy(policy);if(audit.visualApproved!==false||audit.productionApproved!==false||audit.newBuildingCompleted!==false)throw Error('预审不能授予建筑批准');
 const c=audit.caseRecord,scene=new THREE.Scene();scene.background=new THREE.Color('#e7ebe1');
 const roots={control:new THREE.Group(),fault:new THREE.Group()};Object.values(roots).forEach(r=>scene.add(r));roots.fault.visible=false;
 let active='control',mode='neutral_inspection',preset='overview',dirty=true,renderCount=0;
 const container=$('#viewport'),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;container.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(40,1,.05,200),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.1;controls.minDistance=2;controls.maxDistance=95;controls.maxPolarAngle=Math.PI*.495;
 controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
 const ambient=new THREE.HemisphereLight('#fffdf8','#a3b49e',1.2);scene.add(ambient);
 const lamps={key:new THREE.DirectionalLight('#fff1df',2),fill:new THREE.DirectionalLight('#e2edff',1),rim:new THREE.DirectionalLight('#ffffff',1.5)};
 lamps.key.position.set(-8,16,-12);lamps.fill.position.set(15,9,0);lamps.rim.position.set(0,12,16);Object.values(lamps).forEach(l=>scene.add(l));
 const settings={rotation:0,key:{enabled:true,intensity:2,color:'#fff1df'},fill:{enabled:true,intensity:1,color:'#e2edff'},rim:{enabled:true,intensity:1.5,color:'#ffffff'}};
 const labels=[];
 function label(root,text,pos){const el=document.createElement('span');el.className='label';el.textContent=text;$('#labels').append(el);labels.push({root,el,point:new THREE.Vector3(...pos)});}
 function line(root,pts,color='#50745a',dashed=false){const g=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p)));const m=dashed?new THREE.LineDashedMaterial({color,dashSize:.16,gapSize:.09}):new THREE.LineBasicMaterial({color});const o=new THREE.Line(g,m);if(dashed)o.computeLineDistances();root.add(o);return o;}
 function lineLoop(root,w,d,y,color){line(root,[[0,y,0],[w,y,0],[w,y,d],[0,y,d],[0,y,0]],color,true);}
 function plane(root,w,d,y,color,opacity){const m=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false});const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);o.rotation.x=-Math.PI/2;o.position.set(w/2,y,d/2);root.add(o);return o;}
 const W=c.plan.overallWidth,D=c.plan.overallDepth,axes=c.plan.bayAxesX,zs=Object.entries(c.plan.depthAxesZ);
 plane(roots.control,W,D,0,'#a9b8a0',.62);lineLoop(roots.control,W,D,0,'#536b52');lineLoop(roots.control,W,D,c.verticalControl.upperFloor,'#8d9f80');
 axes.forEach((x,i)=>{line(roots.control,[[x,0,0],[x,0,D]],'#57765b');line(roots.control,[[x,c.verticalControl.upperFloor,0],[x,c.verticalControl.upperFloor,D]],'#93a585',true);label('control',`轴 ${i+1}`,[x,0,-.25]);});
 zs.forEach(([id,z])=>{line(roots.control,[[0,0,z],[W,0,z]],'#718766');label('control',id.slice(0,1)+' 轴',[W+.28,0,z]);});
 for(let i=0;i<3;i++)label('control',`${(axes[i+1]-axes[i]).toFixed(2)} m`,[(axes[i]+axes[i+1])/2,0,-.7]);
 label('control','总面阔 11.53 m',[W/2,0,-1.35]);label('control','总进深 7.92 m',[-.7,0,D/2]);
 line(roots.control,[[W+1.15,0,D],[W+1.15,7.04,D]],'#866c47');
 const levels=[['地面',0],['楼面控制',2.85],['前廊披檐控制',3.82],['主檐控制',5.045],['脊高控制',7.04]];
 levels.forEach(([name,y])=>{line(roots.control,[[W+.85,y,D],[W+1.45,y,D]],'#866c47');label('control',`${name} ${y} m`,[W+1.8,y,D]);});
 label('control','标高线不确定脊位',[W+1.5,7.7,D]);
 line(roots.control,[[0,0,D],[0,2.85,D]],'#8b9c7f',true);line(roots.control,[[W,0,D],[W,2.85,D]],'#8b9c7f',true);
 const old=audit.legacyRegression;
 const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(old.points.flat(),3));wg.setIndex(old.wallIndices);wg.computeVertexNormals();const wall=new THREE.Mesh(wg,new THREE.MeshStandardMaterial({color:'#ad4c36',roughness:1,side:THREE.DoubleSide}));roots.fault.add(wall);
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(old.triangles.flat(2),3));rg.computeVertexNormals();roots.fault.add(new THREE.Mesh(rg,new THREE.MeshStandardMaterial({color:'#a6bdb1',roughness:1,side:THREE.DoubleSide,transparent:true,opacity:.65})));
 roots.fault.add(new THREE.LineSegments(new THREE.EdgesGeometry(wg),new THREE.LineBasicMaterial({color:'#7e2f24'})));
 const peak=old.points.reduce((a,b)=>a[1]>b[1]?a:b);label('fault',`旧墙顶 ${peak[1].toFixed(3)} m`,peak.map((v,i)=>i===1?v+.4:v));
 label('fault',`主屋面实际包围顶 ${old.roofActualMaxM.toFixed(3)} m`,[0,old.roofActualMaxM,3.5]);
 label('fault','仅用于回归诊断，不继承为新建筑',[0,0,7]);
 for(const p of old.points.filter(p=>p[1]>old.roofActualMaxM)){const dot=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:'#8d221c'}));dot.position.fromArray(p);roots.fault.add(dot);}
 const normal=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
 Object.values(roots).forEach(r=>r.updateMatrixWorld(true));
 const boxes=Object.fromEntries(Object.entries(roots).map(([id,r])=>[id,new THREE.Box3().setFromObject(r)]));
 // Diagram-only labels need visible margins; these are camera bounds, not measured geometry.
 boxes.control.expandByPoint(new THREE.Vector3(W+3.4,7.9,D));boxes.control.expandByPoint(new THREE.Vector3(-1,0,-1.7));
 function corners(){const b=boxes[active],r=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])r.push(new THREE.Vector3(x,y,z));return r;}
 function fit(){const center=boxes[active].getCenter(new THREE.Vector3());const dir=(preset==='plan'?new THREE.Vector3(0,1,-.001):preset==='front'?new THREE.Vector3(0,.02,-1):new THREE.Vector3(14,11,-19)).normalize();const right=new THREE.Vector3().crossVectors(camera.up,dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right);const tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),th=tv*camera.aspect;let dist=1;for(const p of corners()){const d=p.sub(center),v=d.dot(dir);dist=Math.max(dist,Math.abs(d.dot(right))/(th*.88)+v,Math.abs(d.dot(up))/(tv*.80)+v);}camera.position.copy(center).addScaledVector(dir,dist*1.05);controls.target.copy(center);controls.update();dirty=true;}
 function bounds(){camera.updateMatrixWorld(true);const p=corners().map(v=>v.project(camera)),min=[0,1,2].map(i=>Math.min(...p.map(v=>v.getComponent(i)))),max=[0,1,2].map(i=>Math.max(...p.map(v=>v.getComponent(i))));return {min,max,fullyInView:min.every(v=>v>=-1)&&max.every(v=>v<=1)};}
 function renderLabels(){const used=[];const ordered=[...labels].sort((a,b)=>Number(b.el.textContent.startsWith('总'))-Number(a.el.textContent.startsWith('总')));for(const l of ordered){const p=l.point.clone().project(camera);l.el.hidden=l.root!==active||Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1;if(l.el.hidden)continue;const x=(p.x*.5+.5)*container.clientWidth,y=(-p.y*.5+.5)*container.clientHeight;l.el.style.left=x+'px';l.el.style.top=y+'px';const w=l.el.offsetWidth,h=l.el.offsetHeight,r={l:x-w/2-3,r:x+w/2+3,t:y-h/2-3,b:y+h/2+3};if(used.some(q=>r.l<q.r&&r.r>q.l&&r.t<q.b&&r.b>q.t))l.el.hidden=true;else used.push(r);}}
 function render(){renderer.render(scene,camera);renderLabels();dirty=false;renderCount++;}
 function applyLights(){validateLights(settings);for(const [id,l]of Object.entries(lamps)){l.color.set(settings[id].color);l.intensity=settings[id].intensity;l.visible=settings[id].enabled;}}
 function setMode(next){assertPolicy(policy);if(!policy.presentation.requiredModes.includes(next))throw Error('展示模式未声明');mode=next;scene.overrideMaterial=next==='diagnostic'?normal:null;renderer.toneMapping=next==='diagnostic'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;if(next==='studio_beauty'){ambient.intensity=.10;applyLights();}else{ambient.intensity=1.2;for(const [id,l]of Object.entries(lamps)){l.visible=true;l.color.set('#fffdf8');l.intensity={key:1.8,fill:.8,rim:.6}[id];}}$('#lights').hidden=next!=='studio_beauty';$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===next));$('#sceneNote').textContent=next==='diagnostic'?'法线图例：视图 X 为红、Y 为绿、Z 为蓝；不表示材料颜色。':active==='fault'?'旧北墙与主屋面程序顶点诊断；不作为新样本。':'地点、年代未定；原图待回核；不称为历史复原';dirty=true;render();}
 function setScene(id){assertPolicy(policy);if(!roots[id])throw Error('场景未声明');active=id;Object.entries(roots).forEach(([k,r])=>r.visible=k===id);$$('[data-scene]').forEach(b=>b.classList.toggle('active',b.dataset.scene===id));$('#sceneTitle').textContent=id==='control'?'三开间前廊 · 尺寸记录复核':'旧模型回归 · 已捕获墙顶错误';preset='overview';fit();setMode(mode);}
 function pan(direction){assertPolicy(policy);const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);const amount=camera.position.distanceTo(controls.target)*.055;const v=({left:right.clone().multiplyScalar(-1),right:right.clone(),up:up.clone(),down:up.clone().multiplyScalar(-1)})[direction];if(!v)throw Error('平移方向未声明');v.multiplyScalar(amount);camera.position.add(v);controls.target.add(v);controls.update();dirty=true;render();}
 async function fingerprint(){const parts=[];Object.entries(roots).forEach(([id,r])=>{r.traverse(o=>{const rec={id,matrix:o.matrix.elements};if(o.geometry){rec.attributes=Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,Array.from(a.array)]));rec.index=o.geometry.index?Array.from(o.geometry.index.array):null;}if(o.material)rec.material={type:o.material.type,color:o.material.color?.getHex()??null,roughness:o.material.roughness??null,opacity:o.material.opacity};parts.push(rec);});});return sha256(canonical({sourceCase:c,geometry:parts,regressionSource:audit.sourceIdentities}));}
 function snapshot(){return {version:'0.2.0',activeScene:active,presentationMode:mode,sourceCommit:build.sourceCommit,policySha256:POLICY,caseId:c.id,newBuildingCompleted:false,visualApproved:false,productionApproved:false,camera:{position:camera.position.toArray(),target:controls.target.toArray()},lights:Object.fromEntries(Object.entries(lamps).map(([id,l])=>[id,{intensity:l.intensity,color:'#'+l.color.getHexString()}])),lightUnits:'viewer_relative_uncalibrated',color:'sRGB',exposure:1,autoExposure:false,physicalTime:null,solverStep:null,displayTime:0,nativePixelSize:[renderer.domElement.width,renderer.domElement.height],upscaled:false,framing:bounds(),renderCount};}
 let size='';new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(w<2||h<2)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(size!==`${w},${h}`){size=`${w},${h}`;fit();}$('#pixel').textContent=`原生 ${renderer.domElement.width} × ${renderer.domElement.height} px`;dirty=true;}).observe(container);
 controls.addEventListener('change',()=>dirty=true);function tick(){requestAnimationFrame(tick);if(controls.update())dirty=true;if(dirty)render();}requestAnimationFrame(tick);
 $$('[data-scene]').forEach(b=>b.onclick=()=>setScene(b.dataset.scene));$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$$('[data-pan]').forEach(b=>b.onclick=()=>pan(b.dataset.pan));
 $('#reset').onclick=()=>{preset='overview';fit();render();};$('#plan').onclick=()=>{preset='plan';fit();render();};$('#front').onclick=()=>{preset='front';fit();render();};
 function updateLights(){assertPolicy(policy);for(const id of ['key','fill','rim']){settings[id].intensity=Number($(`[data-light="${id}"]`).value);settings[id].color=$(`[data-color="${id}"]`).value;}validateLights(settings);if(mode==='studio_beauty')applyLights();dirty=true;render();}
 $$('[data-light],[data-color]').forEach(el=>el.oninput=updateLights);
 $('#metrics').innerHTML=[['面阔链',c.plan.facadeDimensionChain.join(' + ')],['记录总面阔',W+' m'],['记录总进深',D+' m'],['间数 / 构架轴',`${c.plan.bayCount} / ${c.plan.frameCountAcrossFacade}`],['候选身份','地域未定 · 现状改造']].map(([k,v])=>`<dt>${safe(k)}</dt><dd>${safe(v)}</dd>`).join('');
 $('#checks').innerHTML=audit.checks.map(q=>`<div class="check" title="${safe(q.reason||'只核算记录内部关系')}"><span>${safe(q.label)}</span><b class="${q.status}">${{pass:'记录闭合',unknown:'待核',fail:'发现矛盾'}[q.status]}</b></div>`).join('');
 $('#testCount').textContent=`${audit.selfTests.passed} / ${audit.selfTests.total} 通过`;
 $('#faultText').innerHTML=`<p>真实旧北墙顶点高度 <b class="fail">${peak[1].toFixed(3)} m</b>；主屋面实际包围顶 <b>${old.roofActualMaxM.toFixed(3)} m</b>。</p><p>逐顶点对照屋面下包络，最大超出 <b class="fail">${old.maxExcessM.toFixed(3)} m</b>。检查已返回失败，旧模型不再自动出现在首页。</p><p>旧代码的排水连续声明仍为<b class="unknown">未验证</b>，没有被作为排水正确的证据。</p>`;
 $('#faultDetail').textContent=JSON.stringify({wallId:old.wallId,roofId:old.roofId,status:old.status,maxExcessM:old.maxExcessM,scope:old.scope,drainage:old.drainage,sourceIdentities:audit.sourceIdentities},null,2);
 $('#sources').innerHTML=audit.primarySources.map(s=>`<div class="source">${safe(s.claim||s.label||s.title||s.id)}<small>${safe(s.path.split('/').pop())}</small><small>${s.hashMatched?'原件哈希已匹配':'当前原件未取得，不继承旧可用声明'}</small></div>`).join('');
 $('#buildIdentity').textContent=`预审 V0.2.0 · 源码 ${build.sourceCommit} · 共同规则 V1.0.0。完整演化、结构安全与历史复原均未通过本轮认证。`;
 async function exportRecord(){assertPolicy(policy);return {packetType:'blueprint-first-building-preflight',schemaVersion:'0.2.0',audit,presentation:snapshot(),geometryFingerprint:await fingerprint(),visualApproved:false,productionApproved:false};}
 $('#export').onclick=async()=>{try{const data=await exportRecord(),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='首栋建筑预审记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}catch(e){$('#buildIdentity').textContent=e.message;}};
 setMode('neutral_inspection');const initialFingerprint=await fingerprint();window.__FIRST_BUILDING__={ready:true,build,audit,setScene,setMode,pan,snapshot,fingerprint,initialFingerprint,exportRecord};$('#boot').hidden=true;
}
boot().catch(e=>{console.error(e);$('#boot').textContent='预审载入停止：'+e.message;window.__FIRST_BUILDING_ERROR__=e.message;});
