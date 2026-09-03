
(async()=>{'use strict';
const T=TilesReferenceRuntime,G=TilesMotherV08Parts.geometry,R=TilesRoof091,M=TilesMaterial091;
const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms)),frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
const mobile=location.hash.includes('lite')||/iPhone|iPad|Android/.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches&&innerWidth<950;
const defaults={seed:32017,form:24,pores:40,edge:20,color:90,micro:105,age:0,wet:0,exposure:.53,slope:-.27,view:'roof',family:'pan',channel:0,explode:0,hideCovers:false,contacts:false,drainage:false,playing:false,auto:false};
let needsRender=true;const invalidate=()=>needsRender=true;
let viewJob=0;
let settings={...defaults},roof=null,shown=[],job=0,building=false,selectedId=null,lastView='roof',cameraPreset='iso',frames=0,lastFrame=performance.now();
const start=performance.now();const progress=(text,value)=>{$('loadText').textContent=text;$('loadBar').style.width=(value*100)+'%';};
await frame();let renderer;
try{renderer=new T.WebGLRenderer({canvas:$('canvas'),antialias:!mobile,alpha:false,preserveDrawingBuffer:false,powerPreference:mobile?'default':'high-performance'});}catch(e){__tilesFatal('当前环境未能创建 WebGL2：'+e.message);return;}
renderer.setPixelRatio(mobile?1:Math.min(1.5,devicePixelRatio||1));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color('#252d2d');
const camera=new T.PerspectiveCamera(36,1,.002,30);camera.position.set(1,.8,-1.2);
const orbit=new T.OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.1;orbit.minDistance=.025;orbit.maxDistance=5;orbit.autoRotateSpeed=.5;orbit.addEventListener('change',invalidate);
document.addEventListener('input',invalidate);document.addEventListener('change',invalidate);document.addEventListener('click',invalidate);
const world=new T.Group(),overlays=new T.Group();scene.add(world,overlays);
const key=new T.DirectionalLight(0xfff3e3,2.6),fill=new T.DirectionalLight(0xddeaff,.72),rim=new T.DirectionalLight(0xf9fcff,1.1);
key.position.set(-1.2,2.2,-1.5);fill.position.set(2,.9,-.4);rim.position.set(.2,1.6,2);scene.add(key,fill,rim);
key.castShadow=!mobile;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-.95;key.shadow.camera.right=.95;key.shadow.camera.top=.95;key.shadow.camera.bottom=-.95;key.shadow.camera.near=.1;key.shadow.camera.far=7;key.shadow.bias=-.000018;key.shadow.normalBias=.000025;
progress('生成工作室反射环境',.04);await frame();let env;
try{env=M.environment(renderer);scene.environment=env.texture;}catch(e){console.warn('Environment preprocessing fallback',e.message);scene.add(new T.HemisphereLight(0xe9ecf1,0x7e7669,.65));}
progress('生成颗粒、微孔、刮痕与粗糙度通道',.09);await frame();const detail=M.makeDetail(mobile?512:1024);detail.normalRoughAO.anisotropy=detail.fields.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const roofBudget=mobile?{nu:24,nv:36}:{nu:40,nv:60};
function makeMesh(record){const d=record.raw,geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(d.positions,3));geo.setAttribute('normal',new T.BufferAttribute(d.normals,3));geo.setAttribute('uv',new T.BufferAttribute(d.uv,2));geo.setAttribute('tangent',new T.BufferAttribute(d.tangents,4));geo.setAttribute('tileCavity',new T.BufferAttribute(d.cavities,1));geo.setAttribute('tileFace',new T.BufferAttribute(d.face,1));geo.setAttribute('tileRelief',new T.BufferAttribute(d.relief,1));geo.setIndex(new T.BufferAttribute(d.indices,1));geo.computeBoundingSphere();geo.computeBoundingBox();const mat=M.material(record,detail,settings);M.update(mat,settings);const m=new T.Mesh(geo,mat);m.castShadow=m.receiveShadow=!mobile;m.userData.record=record;m.userData.basePose={...record.pose};return m;}
function clear(group){while(group.children.length){const c=group.children[0];group.remove(c);c.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}}
function poseMesh(mesh){const r=mesh.userData.record,p=mesh.userData.basePose,e=settings.explode;
 mesh.position.set(p.x||0,(p.y||0)+(r.family==='cover'?e*.13:0)+(r.row||0)*e*.026,p.z||0);mesh.rotation.set(p.angleX||0,0,p.angleZ||0,'ZYX');
 mesh.visible=!(['roof','joint'].includes(settings.view)&&settings.hideCovers&&r.family==='cover');
}
function fit(which='iso'){
 cameraPreset=which;world.updateMatrixWorld(true);const box=new T.Box3();for(const c of world.children)if(c.visible)box.expandByObject(c);if(box.isEmpty())return;
 const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const radius=size.length()*.5;
 let dir={iso:[.78,.69,-1],front:[.12,.10,-1],side:[1,.18,-.16],top:[0,1,.0001],back:[.30,-.80,-.70],micro:[.20,.65,-.72]}[which]||[.78,.69,-1];
 const v=new T.Vector3(...dir).normalize();const fov=2*Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,camera.aspect));
 let distance=radius/Math.sin(fov/2)*1.04;if(which==='micro')distance=radius*.95;
 orbit.target.copy(center);camera.position.copy(center).addScaledVector(v,distance);camera.up.set(0,1,0);camera.lookAt(center);orbit.update();
 document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===which));
}
function updateVisibleCount(){$('qaCount').textContent=world.children.filter(m=>m.visible).length;}
function updateQA(){
 const q=roof?.qa;const ts=settings.view==='roof'||settings.view==='joint'?roof.topology:shown.map(r=>R.auditGeometry(r.raw));
 $('qaOpen').textContent=ts.reduce((n,t)=>n+t.boundaryEdges,0);$('qaFlip').textContent=ts.reduce((n,t)=>n+t.outwardErrors,0);$('qaHit').textContent=['roof','joint'].includes(settings.view)?(q?.sampledPenetrations??'未测'):'单件';
 $('qaNote').innerHTML=`<b>最薄处 ${(Math.min(...ts.map(t=>t.minThicknessMM))).toFixed(2)} mm</b><br>有向边闭合 ${ts.every(t=>t.directedEdgeErrors===0)?'通过':'需检查'}<br>屋面基线采样 ${q?.samples?.toLocaleString()||0} 点`;
 updateVisibleCount();
}
function redrawOverlays(){clear(overlays);overlays.rotation.copy(world.rotation);if(!roof||settings.view==='single'||settings.view==='trio')return;
 const visibleIDs=new Set(world.children.filter(m=>m.visible).map(m=>m.userData.record.id));
 if(settings.contacts&&settings.explode===0){
  for(const r of roof.relations){if(!visibleIDs.has(r.a)||!visibleIDs.has(r.b))continue;const a=roof.records.find(t=>t.id===r.a),b=roof.records.find(t=>t.id===r.b);const wanted=(a.family==='pan'&&b.family==='cover'&&a.row===b.row)||(a.family===b.family&&a.col===b.col&&b.row===a.row+1);if(!wanted)continue;
   const sp=new T.Mesh(new T.SphereGeometry(.0028,8,6),new T.MeshBasicMaterial({color:r.gapMM<0?0xff6759:r.gapMM<4.5?0x88d4b2:0xefbd75}));sp.position.set(r.at[0],r.at[1]+.003,r.at[2]);overlays.add(sp);
  }
 }
 if(settings.drainage&&settings.explode===0){for(const path of roof.paths){const geo=new T.BufferGeometry().setFromPoints(path.points.map(p=>new T.Vector3(...p)));const line=new T.Line(geo,new T.LineBasicMaterial({color:0x83cfe2}));overlays.add(line);}}
}
function updateMaterials(){invalidate();for(const m of world.children)M.update(m.material,settings);$('ageVal').textContent=Math.round(settings.age)+' 年';$('sceneSub').textContent=`${settings.age.toFixed(0)} 年 · ${settings.wet>0?'湿润陶面':'干燥陶面'} · 单面剔除 · 同一陶土色场`;}
async function showView(preserve=false){
 const ticket=++viewJob;const view=settings.view,family=settings.family;let next=[];
 if(view==='roof'){next=roof.records;}
 else if(view==='joint'){
  next=roof.records.filter(r=>r.row<2&&((r.family==='pan'&&r.col<2)||(r.family==='cover'&&r.col===1)));
 }else{
  const count=view==='trio'?3:1;
  for(let i=0;i<count;i++){
   const match=roof.records.find(r=>r.id===selectedId&&r.family===family)||roof.records.find(r=>r.family===family&&r.row===0&&r.col===1);
   const tile=i===0?match.tile:R.tileRaw(family,0,i+5,settings,roofBudget).tile;
   const raw=G.mesh(tile,{nu:mobile?40:88,nv:mobile?60:124,damage:settings.age/150*.25});
   next.push({id:i===0?match.id:`single/${i}`,family,tile,raw,row:0,col:i,pose:{x:count>1?(i-1)*.30:0,y:0,z:0,angleX:0,angleZ:0}});
   await frame();
  }
 }
 if(ticket!==viewJob)return;clear(world);clear(overlays);shown=next;world.rotation.set(['roof','joint'].includes(view)?settings.slope:0,0,0);
 for(const r of shown){const mesh=makeMesh(r);poseMesh(mesh);world.add(mesh);}
 updateMaterials();redrawOverlays();updateQA();
 $('sceneTitle').textContent={roof:'28瓦屋面 · 12板瓦 / 16筒瓦',joint:'局部搭接 · 板瓦排水 / 筒瓦盖缝',single:(settings.family==='pan'?'板瓦':'筒瓦')+'实体特写 · 可检查背面与断面',trio:'三件同类变体 · 独立烧制色域'}[settings.view];
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===settings.view));
 if(!preserve)fit('iso');lastView=settings.view;
 $('footerStatus').textContent=`V0.9.1 · ${mobile?'轻量':'精细'} PBR · 无承托板 · ${shown.length} 件`;
}
async function rebuild(initial=false){const id=++job;building=true;$('busy').style.display=initial?'none':'block';const t=performance.now();
 try{const result=await R.build({...settings},roofBudget,async p=>{if(id!==job)throw new Error('superseded');progress(`建立实体瓦片与实际搭接 ${Math.round(p*28)} / 28`,.12+p*.76);await sleep(0);});
  if(id!==job)return;roof=result;await showView(!initial&&lastView===settings.view);await frame();renderer.render(scene,camera);await frame();
  $('loading').classList.add('hide');$('busy').style.display='none';building=false;$('live').textContent='3D 已就绪';
  window.__TM091.ready=true;window.__TM091.lastBuildMS=performance.now()-t;window.__TM091.startupMS=performance.now()-start;
 }catch(e){building=false;$('busy').style.display='none';if(e.message!=='superseded')__tilesFatal(e);}
}
function resize(){invalidate();const rect=$('stage').getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('stage'));resize();
let scheduled;const queueBuild=()=>{clearTimeout(scheduled);scheduled=setTimeout(()=>rebuild(),180);};
for(const key of ['form','pores','edge','color','micro','age','wet']){
 const el=$(key);el.addEventListener('input',()=>{settings[key]=Number(el.value)/(key==='wet'?100:1);$(key+'Val').textContent=el.value+(key==='age'?' 年':key==='wet'?'%':'');if(['color','micro','wet','age'].includes(key))updateMaterials();});
 if(['form','pores','edge'].includes(key))el.addEventListener('change',queueBuild);
 if(key==='age')el.addEventListener('change',()=>{settings.playing=false;$('play').textContent='播放百年演化';queueBuild();});
}
$('newSeed').onclick=()=>{settings.seed=(TilesStudyCore.hash(settings.seed+'new')>>>0)||1;$('seed').value=settings.seed;queueBuild();};
$('seed').onchange=()=>{settings.seed=Math.max(1,Math.min(4294967295,Math.round(Number($('seed').value)||32017)));$('seed').value=settings.seed;queueBuild();};
$('channel').onchange=()=>{settings.channel=Number($('channel').value);updateMaterials();};
$('exposure').oninput=()=>{renderer.toneMappingExposure=Number($('exposure').value)/100;$('exposureVal').textContent=renderer.toneMappingExposure.toFixed(2);};
$('lightMode').onchange=()=>{const v=$('lightMode').value;if(v==='raking'){key.position.set(-1.8,.24,-1);key.intensity=3.8;fill.intensity=.12;rim.intensity=.45;}else if(v==='soft'){key.position.set(-1,3,-1);key.intensity=1.2;fill.intensity=.7;rim.intensity=.45;}else{key.position.set(-1.2,2.2,-1.5);key.intensity=2.6;fill.intensity=.72;rim.intensity=1.1;}for(const m of world.children)m.material.envMapIntensity=v==='raking'?.28:v==='soft'?1.2:.7;};
$('explode').oninput=()=>{settings.explode=Number($('explode').value)/100;$('explodeVal').textContent=$('explode').value+'%';for(const m of world.children)poseMesh(m);redrawOverlays();};
$('hideCovers').onclick=()=>{settings.hideCovers=!settings.hideCovers;$('hideCovers').textContent=settings.hideCovers?'显示筒瓦':'隐藏筒瓦';$('hideCovers').classList.toggle('active',settings.hideCovers);for(const m of world.children)poseMesh(m);updateVisibleCount();};
for(const name of ['contacts','drainage'])$(name).onclick=()=>{settings[name]=!settings[name];$(name).classList.toggle('active',settings[name]);redrawOverlays();};
$('auto').onclick=()=>{settings.auto=!settings.auto;orbit.autoRotate=settings.auto;$('auto').classList.toggle('active',settings.auto);};$('fit').onclick=()=>fit('iso');
$('play').onclick=()=>{settings.playing=!settings.playing;if(settings.age>=150)settings.age=0;$('play').textContent=settings.playing?'暂停演化':'播放百年演化';if(!settings.playing)queueBuild();};
$('reset').onclick=()=>{settings={...defaults};selectedId=null;orbit.autoRotate=false;for(const k of ['form','pores','edge','color','micro','age','wet','seed']){$(k).value=settings[k];if($(k+'Val'))$(k+'Val').textContent=settings[k]+(k==='age'?' 年':k==='wet'?'%':'');}$('channel').value='0';$('explode').value='0';$('explodeVal').textContent='0%';$('hideCovers').textContent='隐藏筒瓦';for(const k of ['hideCovers','contacts','drainage','auto'])$(k).classList.remove('active');$('play').textContent='播放百年演化';$('lightMode').value='studio';$('lightMode').dispatchEvent(new Event('change'));$('exposure').value='105';renderer.toneMappingExposure=1.05;$('exposureVal').textContent='1.05';document.querySelectorAll('[data-family]').forEach(b=>b.classList.toggle('active',b.dataset.family==='pan'));queueBuild();};
async function switchView(v){if(building)return;settings.view=v;settings.explode=0;$('explode').value=0;$('explodeVal').textContent='0%';await showView(false);}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{settings.family=b.dataset.family;selectedId=null;document.querySelectorAll('[data-family]').forEach(x=>x.classList.toggle('active',x===b));switchView('single');});
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=async()=>{if(building)return;if(b.dataset.camera==='micro'&&settings.view!=='single'){await switchView('single');}fit(b.dataset.camera);});
$('leftToggle').onclick=()=>{$('layout').classList.toggle('show-left');$('layout').classList.remove('show-right');};$('rightToggle').onclick=()=>{$('layout').classList.toggle('show-right');$('layout').classList.remove('show-left');};
const ray=new T.Raycaster();$('canvas').addEventListener('dblclick',async e=>{if(building)return;const rect=$('canvas').getBoundingClientRect(),v=new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);ray.setFromCamera(v,camera);const hit=ray.intersectObjects(world.children).find(h=>h.object.visible);if(!hit)return;const r=hit.object.userData.record;selectedId=r.id;settings.family=r.family;document.querySelectorAll('[data-family]').forEach(b=>b.classList.toggle('active',b.dataset.family===r.family));await switchView('single');});
$('canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();settings.playing=false;__tilesFatal('WebGL 上下文中断。可以使用轻量模式重新进入。');});
let paused=false;document.addEventListener('visibilitychange',()=>paused=document.hidden);
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-lastFrame)/1000,.08);lastFrame=now;if(paused)return;frames++;
 if(settings.playing&&!building){settings.age=Math.min(150,settings.age+dt*5);$('age').value=settings.age;updateMaterials();if(settings.age>=150){settings.playing=false;$('play').textContent='播放百年演化';queueBuild();}}
 orbit.update();if(needsRender||settings.auto||settings.playing){renderer.render(scene,camera);needsRender=false;}
 if(frames%120===0&&window.__TM091?.ready)$('live').textContent=settings.playing?`${Math.round(settings.age)} 年`:'3D 实时渲染';
}
window.__TM091={ready:false,version:'0.9.1',mobile,get frames(){return frames},get building(){return building},get drawCalls(){return renderer.info.render.calls},get settings(){return {...settings}},get qa(){return roof?.qa},get topology(){return roof?.topology},get relations(){return roof?.relations},get renderer(){return renderer},get camera(){return camera},get world(){return world},get scene(){return scene},get shown(){return shown},get roof(){return roof},get detail(){return detail},fit,switchView,rebuild,updateMaterials,async set(v){Object.assign(settings,v);if(v.view)await switchView(v.view);else updateMaterials();},source:{branchHead:'785d31b774120ec81ac4b2e8e3e2a29db762de4a',input:'Tiles_Mother_V082_iPhone_Immediate_PBR_Workbench.html',visualApproved:false,productionApproved:false}};
requestAnimationFrame(animate);await rebuild(true);
})();

