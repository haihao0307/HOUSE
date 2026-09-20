'use strict';
(()=>{
const $=id=>document.getElementById(id),K=createBrickKernel(),catalog=BRICK_CATALOG,families=catalog.map(x=>x.id),names=catalog.map(x=>x.name),getEntry=f=>catalog.find(x=>x.id===f);
const layerSpec=[['shapeSeed','主形','shape'],['damageSeed','破损','damage'],['colorSeed','色区','color'],['fiberSeed','稻草','fiber'],['detailSeed','肌理','detail']];
let current='fired',settings={},params,geometry=null,worker=null,ticket=0,busy=false,renderer,oldView=false,refURL=null;let activeVersion='r4',oldEpoch=0,needsFit=true,layout='single';const cache=new Map(),audit={ready:false,builds:0,cacheHits:0,cancelled:0,materialUpdates:0,errors:[]};
function fresh(f){const c=getEntry(f);let p={family:f,...K.defaults[f],seed:c.seed,shape:c.shape,resolution:88,twists:2,strength:1,frequency:c.frequency,levels:4,grain:c.grain,rough:c.rough};for(const[key,,tag]of layerSpec)p[key]=K.derive(p.seed,tag);return p;}
for(const c of catalog){const b=document.createElement('button');b.dataset.family=c.id;b.title=c.group+' · '+c.name+'：'+c.note;b.setAttribute('aria-label','显示'+c.group+'类 '+c.name);b.innerHTML='<i style="background:'+c.tone+'"></i><span><b>'+c.name+'</b><em>'+c.group+' · '+c.note.split(' · ')[0]+'</em></span>';$('families').appendChild(b);}
try{const initial=new URL(location.href).searchParams.get('material');if(families.includes(initial))current=initial;}catch{}

for(const f of families)settings[f]=fresh(f);params={...settings[current]};let locks={};
function error(e){busy=false;$('busy').hidden=true;$('error').hidden=false;$('error').textContent=String(e);audit.errors.push(String(e));}
try{renderer=createBrickRenderer($('view'));renderer.reset();}catch(e){error(e);return;}
const setStatus=s=>{$('status').textContent=s;};
function applyMaterial(){Object.assign(renderer.state,{family:getEntry(current).shader,grain:params.grain,color:params.color,rough:params.rough,wet:params.wet,twists:params.twists,levels:params.levels,strength:params.strength,frequency:params.frequency,phase:(params.detailSeed>>>0)/4294967295*18.73});renderer.invalidate();}
function sync(){
 const entry=getEntry(current);$('seed').value=params.seed;
 const shapeNames=current==='pebble'?BRICK_PEBBLE_NAMES:BRICK_SHAPE_NAMES;
 $('shape').replaceChildren(...entry.shapes.map(id=>{const o=document.createElement('option');o.value=id;o.textContent=shapeNames[id];return o;}));$('shape').value=params.shape;
 $('shapeName').textContent=shapeNames[params.shape]||'';

 for(const k of ['damage','relief','grain','color','rough','wet','strength','frequency','levels']){const v=['frequency','levels'].includes(k)?params[k]:Math.round(params[k]*100);$(k).value=v;$(k+'Out').value=v;}
 for(const[key]of layerSpec){$(key).value=params[key];$('lock_'+key).checked=!!locks[key];}
 document.querySelectorAll('[data-family]').forEach(b=>b.classList.toggle('active',b.dataset.family===current));document.querySelectorAll('[data-twists]').forEach(b=>b.classList.toggle('active',Number(b.dataset.twists)===params.twists));
 if(!busy)applyMaterial();
}
function key(){return JSON.stringify([layout,...['family','shape','resolution','damage','relief','shapeSeed','damageSeed','colorSeed','fiberSeed'].map(k=>params[k])]);}
function accept(a,id,cached){if(a.stats.family!==current){error('材料身份校验失败');return;}geometry=a;busy=false;worker=null;applyMaterial();renderer.upload(a);if(needsFit){renderer.reset();needsFit=false;}const entry=getEntry(current);$('specimenName').textContent=entry.group+' · '+entry.name;$('view').setAttribute('aria-label',entry.name+'的可旋转三维实物');$('versionLabel').textContent='R4';$('view').style.opacity='1';audit.ready=true;$('busy').hidden=true;$('error').hidden=true;const s=a.stats;setStatus(names[families.indexOf(current)]+' · '+(cached?'缓存':Math.round(s.buildMs)+' ms')+' · '+(s.triangles/1000).toFixed(1)+'k 面');$('metrics').textContent='生成 '+Math.round(s.buildMs)+' ms；基础场 '+s.baseFieldEvaluations+' 次；法线重复场求值 '+s.normalFieldEvaluations+' 次。网格 '+((a.position.byteLength+a.normal.byteLength+a.data.byteLength+a.kind.byteLength+a.index.byteLength)/1048576).toFixed(2)+' MB。'+(current==='adobe'?'稻草 '+s.fibers+' 件；稻壳 0。':'');settings[current]={...params};if(!cached){cache.set(id,a);while(cache.size>2)cache.delete(cache.keys().next().value);}}
function stopWorker(){ticket++;if(worker){worker.terminate();worker=null;audit.cancelled++;}busy=false;$('busy').hidden=true;}
function build(){
 stopWorker();if(oldView)return;sync();if(renderer.state.paused){setStatus('已暂停');return;}const id=key();if(cache.has(id)){audit.cacheHits++;accept(cache.get(id),id,true);return;}
 busy=true;$('busy').hidden=false;$('busyText').textContent='生成'+getEntry(current).name;$('specimenName').textContent='生成中：'+getEntry(current).name;$('view').style.opacity='.16';const t=ticket;const source='const K=('+createBrickKernel.toString()+')();onmessage=e=>{try{const m=e.data.layout==="trio"?K.buildTrio(e.data):K.build(e.data);postMessage(m,[m.position.buffer,m.normal.buffer,m.data.buffer,m.kind.buffer,m.index.buffer]);}catch(e){postMessage({error:String(e)})}}';const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 try{worker=new Worker(url);URL.revokeObjectURL(url);worker.onmessage=e=>{if(t!==ticket)return;worker.terminate();worker=null;if(e.data.error){error(e.data.error);return;}audit.builds++;accept(e.data,id,false);};worker.onerror=e=>{if(t!==ticket)return;stopWorker();error(e.message||'建模线程出错');};worker.postMessage({...params,layout});}catch(e){URL.revokeObjectURL(url);error(e);}
}
function recolor(){if(busy||!geometry){build();return;}const a=geometry,cs=params.colorSeed>>>0,data=new Float32Array(a.data);const parts=a.stats.layout==='trio'?a.stats.parts:[{vertexStart:0,bodyVertices:a.stats.bodyVertices}];
 for(let j=0;j<parts.length;j++){const part=parts[j],seed=j?K.derive(cs,'child:'+j):cs,P=a.local||a.position;
 for(let k=0;k<part.bodyVertices;k++){const i=part.vertexStart+k,x=P[i*3],y=P[i*3+1],z=P[i*3+2];data[i*4]=K.noise(x*2.2,y*2.2,z*2.2,seed);data[i*4+1]=K.noise(x*7.5,y*7.5,z*7.5,seed+88);data[i*4+2]=K.noise(x*26,y*26,z*26,seed+19);}}
 geometry={...a,data,stats:{...a.stats,colorSeed:cs}};renderer.uploadData(data);audit.materialUpdates++;settings[current]={...params};}
for(const[key,label]of layerSpec){const row=document.createElement('div');row.className='layerRow';row.innerHTML='<label for="'+key+'">'+label+'</label><input id="'+key+'" type="number" min="0" max="4294967295"><label><input id="lock_'+key+'" type="checkbox">锁</label>';$('layerSeeds').appendChild(row);$(key).onchange=()=>{const v=Number($(key).value);if(!Number.isInteger(v)||v<0||v>4294967295){sync();return;}params[key]=v;if(key==='colorSeed')recolor();else if(key==='detailSeed'){applyMaterial();settings[current]={...params};}else build();};$('lock_'+key).onchange=()=>locks[key]=$('lock_'+key).checked;}
function leaveOld(){if(!oldView)return;oldEpoch++;oldView=false;activeVersion='r4';$('oldStage').replaceChildren();$('oldStage').hidden=true;$('view').hidden=false;$('shape').disabled=false;renderer.pause(false);$('pause').textContent='暂停';$('versionLabel').textContent='R4';$('versionNote').textContent='R4 · 当前候选';}
function selectFamily(f){
 if(!families.includes(f))return;leaveOld();settings[current]={...params};current=f;params={...settings[f]};needsFit=true;build();
 try{if(/^https?:/.test(location.protocol)){const u=new URL(location.href);u.searchParams.set('material',f);history.replaceState(null,'',u);}}catch{}
}
$('families').onclick=e=>{const b=e.target.closest('[data-family]');if(b)selectFamily(b.dataset.family);};
function master(n){if(!Number.isInteger(n)||n<0||n>4294967295){sync();return;}params.seed=n>>>0;for(const[key,,tag]of layerSpec)if(!locks[key])params[key]=K.derive(n,tag);build();}
$('nextSeed').onclick=()=>{leaveOld();master((params.seed+1067)>>>0);};$('seed').onchange=()=>master(Number($('seed').value));$('shape').onchange=()=>{params.shape=$('shape').value;needsFit=true;build();};
for(const k of ['damage','relief']){$(k).oninput=()=>$(k+'Out').value=$(k).value;$(k).onchange=()=>{params[k]=Number($(k).value)/100;build();};}
for(const k of ['grain','color','rough','wet','strength','frequency','levels'])$(k).oninput=()=>{params[k]=Number($(k).value)/(['frequency','levels'].includes(k)?1:100);$(k+'Out').value=$(k).value;audit.materialUpdates++;applyMaterial();settings[current]={...params};};
$('twists').onclick=e=>{const b=e.target.closest('[data-twists]');if(b){params.twists=Number(b.dataset.twists);sync();settings[current]={...params};}};
function mode(n){renderer.state.mode=n;$('channel').value=n;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',Number(b.dataset.mode)===n));renderer.invalidate();}
$('modes').onclick=e=>{const b=e.target.closest('[data-mode]');if(b)mode(Number(b.dataset.mode));};$('channel').onchange=()=>mode(Number($('channel').value));
function face(f){const pos={front:[0,0],back:[Math.PI,0],left:[-Math.PI/2,0],right:[Math.PI/2,0],top:[0,1.40],bottom:[0,-1.40]}[f];Object.assign(renderer.camera,{yaw:pos[0],pitch:pos[1],panX:0,panY:0});renderer.invalidate();}
$('views').onclick=e=>{const b=e.target.closest('[data-face]');if(b)face(b.dataset.face);};$('resetView').onclick=renderer.reset;
$('spin').onclick=()=>{renderer.state.auto=!renderer.state.auto;$('spin').textContent=renderer.state.auto?'停止转台':'转台';renderer.invalidate();};
function panel(on){$('panel').hidden=!on;$('togglePanel').setAttribute('aria-expanded',String(on));}
$('togglePanel').onclick=()=>panel($('panel').hidden);$('closePanel').onclick=()=>panel(false);
$('light').onchange=()=>renderer.setLight($('light').value);$('pixelRatio').onchange=()=>{renderer.state.pixelRatio=Number($('pixelRatio').value);renderer.invalidate();};
$('pause').onclick=()=>{if(oldView){leaveOld();build();return;}const on=!renderer.state.paused;if(on)stopWorker();renderer.pause(on);$('pause').textContent=on?'恢复':'暂停';if(!on)build();else setStatus('已暂停');};$('cancel').onclick=()=>{stopWorker();$('view').style.opacity='1';if(geometry){const c=getEntry(geometry.stats.family);$('specimenName').textContent=c.group+' · '+c.name+'（保留上一件）';}setStatus('已取消生成');};
function save(n,s,t='application/json'){const u=URL.createObjectURL(new Blob([s],{type:t})),a=document.createElement('a');a.href=u;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('exportPreset').onclick=()=>save('Brick_Mother_R4_'+current+'_'+params.seed+'.json',JSON.stringify({schema:'brick-mother-r4',parameters:params,locks},null,2));
$('importPreset').onclick=()=>$('presetFile').click();$('presetFile').onchange=async()=>{try{const f=$('presetFile').files[0];if(!f)return;if(f.size>25000)throw Error('参数文件过大');const d=JSON.parse(await f.text());if(d.schema!=='brick-mother-r4')throw Error('只接受 R4 参数');K.validate(d.parameters);const p=d.parameters;if(!getEntry(p.family).shapes.includes(p.shape))throw Error('该材料不支持此形态');for(const k of ['grain','color','rough','wet','strength','frequency','levels']){const max={color:1.5,strength:1.5,frequency:26,levels:5}[k]??1;if(!Number.isFinite(p[k])||p[k]<0||p[k]>max)throw Error('参数越界 '+k);}if(![0,1,2].includes(p.twists)||!Number.isInteger(p.levels)||p.levels<2||p.frequency<6)throw Error('取样参数越界');for(const[key]of layerSpec)if(!Number.isInteger(p[key])||p[key]<0||p[key]>4294967295)throw Error('子种子越界');leaveOld();current=p.family;params=fresh(current);for(const k of Object.keys(params))params[k]=p[k];locks={};for(const[key]of layerSpec)locks[key]=!!d.locks?.[key];build();}catch(e){error(e);}};
$('resetAll').onclick=()=>{params=fresh(current);locks={};needsFit=true;build();};
$('reference').onclick=()=>$('referenceDialog').showModal();$('closeRef').onclick=()=>$('referenceDialog').close();$('refFile').onchange=()=>{const f=$('refFile').files[0];if(!f)return;if(!f.type.startsWith('image/')||f.size>15000000){error('图片须小于15 MB');return;}if(refURL)URL.revokeObjectURL(refURL);refURL=URL.createObjectURL(f);$('refImage').src=refURL;$('refImage').hidden=false;};
$('versions').onclick=()=>$('versionDialog').showModal();$('closeVersions').onclick=()=>$('versionDialog').close();
const oldFiles={r3:'legacy/R3.html',r2:'legacy/R2.html',r1:'legacy/R1.html',v26:'legacy/V2.6.html',v275:'legacy/V2.7.5.html'};
async function openVersion(v){
 $('versionDialog').close();if(v==='r4'){leaveOld();build();return;}if(!oldFiles[v])return;
 leaveOld();stopWorker();renderer.pause(true);renderer.state.auto=false;$('spin').textContent='转台';panel(false);oldView=true;activeVersion=v;const epoch=++oldEpoch;
 $('oldStage').hidden=false;$('view').hidden=true;$('shape').disabled=true;$('oldStage').textContent='载入 '+v.toUpperCase()+' 原件…';$('versionLabel').textContent=v.toUpperCase();$('versionNote').textContent=v.toUpperCase()+' 原件 · 选任意材料返回R4';$('specimenName').textContent=v.toUpperCase()+' 旧版原件';
 try{
  let html;
  if(window.BRICK_LEGACY?.[v]){const bytes=Uint8Array.from(atob(window.BRICK_LEGACY[v]),c=>c.charCodeAt(0));html=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}
  else{const r=await fetch(oldFiles[v],{cache:'no-cache'});if(!r.ok)throw Error('旧版原件未能载入（HTTP '+r.status+'）');html=await r.text();}
  if(epoch!==oldEpoch||!oldView)return;const frame=document.createElement('iframe');frame.title=v.toUpperCase()+' 原版';frame.srcdoc=html;
  frame.onload=()=>{if(epoch!==oldEpoch)return;try{
   const w=frame.contentWindow,api=w.BrickR3||w.BrickR2;
   const counterpart=['fired','stone','rubble','adobe'].includes(current)?current:null;
   if(api?.selectFamily&&counterpart){api.selectFamily(counterpart);$('specimenName').textContent=getEntry(counterpart).group+' · '+getEntry(counterpart).name+'（'+v.toUpperCase()+'）';}
   else $('specimenName').textContent=v.toUpperCase()+' 原件 · 以画面内材料名为准';
   w.document.addEventListener('click',()=>setTimeout(()=>{try{const f=api?.parameters?.().family;if(f&&getEntry(f))$('specimenName').textContent=getEntry(f).group+' · '+getEntry(f).name+'（'+v.toUpperCase()+'）';}catch{}},10));
  }catch{}};
  $('oldStage').replaceChildren(frame);
 }catch(e){leaveOld();error(e);build();}
}
$('versionDialog').onclick=e=>{const b=e.target.closest('[data-version]');if(b)openVersion(b.dataset.version);};
$('trio').onclick=()=>{leaveOld();layout=layout==='single'?'trio':'single';$('trio').textContent=layout==='single'?'三种子':'看单件';needsFit=true;build();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')panel(false);if(e.key.toLowerCase()==='f'&&!/INPUT|SELECT/.test(document.activeElement.tagName))renderer.reset();});
$('view').addEventListener('webglcontextlost',()=>error('图形上下文中断，请关闭页面后重新打开。'));
window.addEventListener('pagehide',()=>{stopWorker();renderer.destroy();if(refURL)URL.revokeObjectURL(refURL);});
window.BrickR4={audit,renderer,getGeometry:()=>geometry,parameters:()=>({...params,layout}),stats:()=>({busy,workerAlive:!!worker,oldView,activeVersion,layout,parameters:{...params},geometry:geometry?.stats,render:{...renderer.stats},audit:{...audit}}),selectFamily,build,face,mode,master,openVersion};
sync();build();
})();
