'use strict';
(()=>{
const $=id=>document.getElementById(id),K=createBrickKernel();
const catalog={fired:{name:'烧结旧砖',type:'砖',id:0,seed:5045},kiln:{name:'窑变旧砖',type:'砖',id:4,seed:6112},adobe:{name:'纤维土坯',type:'土坯',id:3,seed:4517},dressed:{name:'粗凿砌筑石',type:'石',id:5,seed:8231},rubble:{name:'不规则毛石',type:'石',id:2,seed:9298},stone:{name:'层状毛石',type:'石',id:1,seed:10365},pebble:{name:'建筑卵石',type:'石',id:6,seed:7213}};
const families=Object.keys(catalog),rocks=['','花岗岩','砂岩','玄武岩','石英岩','板岩','片麻岩','大理岩'];
const isStone=f=>['dressed','rubble','stone'].includes(f),isRock=f=>isStone(f)||f==='pebble';
const seedLayers=['shape','damage','color','fiber','detail'];
// Each parameter declares its dependency; every exposed input is tested against real output.
const definitions={
 damage:['局部缺损',0,1,.01,'geo'],relief:['形面起伏',0,1,.01,'geo'],edgeWear:['边角圆钝',0,1,.01,'geo'],
 chisel:['凿痕深浅',0,1,.01,'geo'],strata:['层理与剥离',0,1,.01,'geo'],roundness:['圆磨程度',0,1,.01,'geo'],
 strawDensity:['稻草含量',0,1,.01,'geo'],huskDensity:['小稻壳含量',0,1,.01,'geo'],
 red:['砖红比例',0,1,.01,'surface'],char:['焦黑覆盖',0,1,.01,'surface'],kiln:['窑色变化',0,1,.01,'surface'],
 tone:['冷暖偏色',-1,1,.01,'surface'],color:['色区变化',0,1.5,.01,'surface'],mineral:['矿物对比',0,1,.01,'surface'],
 grain:['微细起伏',0,1,.01,'surface'],frequency:['纹理疏密',6,28,.1,'surface'],rough:['表面粗糙',.3,1,.01,'surface'],
 polish:['磨光程度',0,1,.01,'surface'],wet:['湿润程度',0,1,.01,'surface'],strength:['局部纹理变化',0,1.5,.01,'surface']};
const common=['tone','color','grain','frequency','rough','wet','strength'];
function keys(f){return f==='adobe'?['damage','relief','edgeWear','strawDensity','huskDensity',...common]:f==='fired'||f==='kiln'?['damage','edgeWear','red','char',...(f==='kiln'?['kiln']:[]),...common]:f==='pebble'?['roundness','mineral','polish',...common]:['damage','relief','chisel',...(![1,3,4].includes(params.rock)&&(f==='stone'||[5,6].includes(params.rock))?['strata']:[]),'mineral',...common];}
function fresh(f){let p={family:f,...K.defaults[f],resolution:88,seed:catalog[f].seed,twists:2,levels:4,strength:.85,frequency:f==='adobe'?18:isRock(f)?13:15,
 rock:f==='pebble'?3:f==='stone'?5:isRock(f)?2:0,edgeWear:f==='adobe'?.56:K.defaults[f].edgeWear??0,chisel:.45,strata:f==='stone'?.82:.26,roundness:.82,
 strawDensity:.60,huskDensity:.38,red:.82,char:f==='kiln'?.22:.15,kiln:.60,tone:0,mineral:.65,polish:.35};
 for(const tag of seedLayers)p[tag+'Seed']=K.derive(p.seed,tag);return p;}
let current='fired',params,mesh=null,worker=null,debounce=0,ticket=0,busy=false,accepted=null,fitNext=true,pendingCamera=null,renderer=null,disposed=false;
const stored={},locks={},cache=new Map();for(const f of families){stored[f]=fresh(f);locks[f]={};}params={...stored[current]};
const audit={ready:false,builds:0,cacheHits:0,cancelled:0,materialUpdates:0,errors:[],controls:[],lastAction:'start'};
function status(t){$('status').textContent=t;}
function issue(e){stop();$('error').textContent=String(e);$('error').hidden=false;audit.errors.push(String(e));if(accepted){params={...accepted};current=params.family;sync();applyMaterial();} }
try{renderer=createBrickRenderer($('view'));}catch(e){$('error').hidden=false;$('error').textContent=String(e);return;}
function geometryKey(p=params){const ks=['family','shape','resolution','edgeWear','damage','relief','shapeSeed','damageSeed'];if(p.family==='adobe')ks.push('fiberSeed','strawDensity','huskDensity');if(isStone(p.family))ks.push('rock','chisel','strata');if(p.family==='pebble')ks.push('roundness');return JSON.stringify(ks.map(k=>p[k]));}
function materialValues(){const v={family:catalog[current].id,rock:params.rock,mode:0,clip:0,levels:4,twists:2,phase:(params.detailSeed>>>0)/4294967295*18.73};for(const k of ['red','char','kiln','tone','color','grain','frequency','rough','wet','strength','mineral','polish','strata'])v[k]=params[k];return v;}
function applyMaterial(){Object.assign(renderer.state,materialValues());renderer.invalidate();audit.materialUpdates++;}
function labels(){const s={long:current==='pebble'?'椭长':'长条',sample:current==='pebble'?'圆砾':'厚块',half:'断块',thin:current==='pebble'?'扁砾':'薄片'};
 $('specimenName').textContent=catalog[current].type+' / '+catalog[current].name;$('shapeName').textContent=s[params.shape];$('materialName').textContent=isRock(current)?rocks[params.rock]+' · '+(current==='pebble'?'圆磨表面':'砌筑表面'):(current==='kiln'?'红砖基底 · 局部窑色':'成品观察');
 $('rockControls').hidden=!isRock(current);$('rock').value=params.rock;document.title='Brick Mother R6 · '+catalog[current].name;
 for(const b of document.querySelectorAll('[data-family]')){let on=b.dataset.family===current;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}
 for(const b of document.querySelectorAll('[data-rock]')){let on=Number(b.dataset.rock)===params.rock;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));}
 for(const b of document.querySelectorAll('[data-shape]')){b.classList.toggle('active',b.dataset.shape===params.shape);b.textContent=s[b.dataset.shape];}
}
let panelKey='';
function sync(){labels();document.querySelectorAll('[data-layer]').forEach(e=>e.hidden=e.dataset.layer==='fiber'&&current!=='adobe');$('seed').value=params.seed;const ks=keys(current),key=current+':'+ks.join(',');
 if(panelKey!==key){$('sliders').replaceChildren();for(const k of ks){const[n,min,max,step]=definitions[k];const l=document.createElement('label');l.className='slider';l.innerHTML='<span>'+n+'</span><output id="'+k+'Out"></output><input id="'+k+'" data-param="'+k+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" aria-label="'+n+'">';$('sliders').appendChild(l);}panelKey=key;}
 for(const k of ks){$(k).value=params[k];$(k+'Out').value=Number(params[k]).toFixed(k==='frequency'?1:2);}
 for(const k of seedLayers){$(k+'Seed').value=params[k+'Seed'];$('lock_'+k).checked=!!locks[current][k];}
}
for(const tag of seedLayers){const label={shape:'形体',damage:'缺损',color:'色区',fiber:'夹杂',detail:'微纹理'}[tag],row=document.createElement('label');row.className='seedRow';row.dataset.layer=tag;row.innerHTML='<span>'+label+'</span><input id="'+tag+'Seed" type="number" min="0" max="4294967295"><span><input id="lock_'+tag+'" type="checkbox">锁</span>';$('layerSeeds').appendChild(row);
 $(tag+'Seed').onchange=()=>{const n=Number($(tag+'Seed').value);if(!Number.isInteger(n)||n<0||n>4294967295){sync();return;}params[tag+'Seed']=n;if(tag==='detail'){applyMaterial();stored[current]={...params};}else if(tag==='color')recolor();else if(tag==='fiber'&&current!=='adobe')stored[current]={...params};else build();};$('lock_'+tag).onchange=()=>locks[current][tag]=$('lock_'+tag).checked;}
function fit(){if(!mesh)return;const b=mesh.stats.bounds,w=b.max[0]-b.min[0],h=b.max[1]-b.min[1],d=b.max[2]-b.min[2],aspect=$('view').clientWidth/Math.max(1,$('view').clientHeight);renderer.reset();renderer.camera.radius=Math.min(12,Math.max(3.2,Math.max(h,w/aspect)/(2*Math.tan(.335))*1.20+d*.55));renderer.invalidate();}
function withColor(a){if(a.stats.colorSeed===params.colorSeed)return a;const d=new Float32Array(a.data);for(let i=0;i<a.stats.bodyVertices;i++){const x=a.position[3*i],y=a.position[3*i+1],z=a.position[3*i+2];d[4*i]=K.noise(x*2.2,y*2.2,z*2.2,params.colorSeed);d[4*i+1]=K.noise(x*7.5,y*7.5,z*7.5,params.colorSeed+88);d[4*i+2]=K.noise(x*26,y*26,z*26,params.colorSeed+19);}return{...a,data:d,stats:{...a.stats,colorSeed:params.colorSeed}};}
function recolor(){if(!mesh||busy){build();return;}mesh=withColor(mesh);renderer.uploadData(mesh.data);applyMaterial();stored[current]={...params};accepted={...params};}
function stop(){clearTimeout(debounce);debounce=0;ticket++;if(worker){worker.terminate();worker=null;audit.cancelled++;}busy=false;$('busy').hidden=true;$('stage').setAttribute('aria-busy','false');$('view').classList.remove('loading');}
function accept(a,key,cached=false){mesh=withColor(a);busy=false;$('busy').hidden=true;$('error').hidden=true;$('view').classList.remove('loading');$('stage').setAttribute('aria-busy','false');applyMaterial();renderer.upload(mesh);audit.ready=true;stored[current]={...params};accepted={...params};cache.set(key,mesh);while(cache.size>3)cache.delete(cache.keys().next().value);sync();if(fitNext){fitNext=false;fit();}if(pendingCamera){Object.assign(renderer.camera,pendingCamera);pendingCamera=null;renderer.invalidate();}status(catalog[current].name+' · '+(cached?'已缓存':Math.round(mesh.stats.buildMs)+' ms')+' · '+(mesh.stats.triangles/1000).toFixed(1)+'k 面');}
function build(){stop();if(disposed)return;if(renderer.state.paused){renderer.pause(false);$('pause').textContent='暂停';}const key=geometryKey();sync();if(cache.has(key)){audit.cacheHits++;accept(cache.get(key),key,true);return;}busy=true;audit.ready=false;$('busy').hidden=false;$('stage').setAttribute('aria-busy','true');$('view').classList.add('loading');status('正在更新 '+catalog[current].name);const id=ticket;
 const code='const K=('+createBrickKernel.toString()+')();onmessage=e=>{try{const m=K.build(e.data);postMessage(m,[m.position.buffer,m.normal.buffer,m.data.buffer,m.kind.buffer,m.index.buffer]);}catch(e){postMessage({error:String(e)})}}',url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 try{worker=new Worker(url);URL.revokeObjectURL(url);worker.onmessage=e=>{if(id!==ticket)return;worker.terminate();worker=null;if(e.data.error){issue(e.data.error);return;}audit.builds++;accept(e.data,key);};worker.onerror=e=>issue(e.message);worker.postMessage({...params});}catch(e){URL.revokeObjectURL(url);issue(e);}}
function setParameter(k,v,immediate=false){if(!definitions[k]||!keys(current).includes(k))return false;const[,min,max]=definitions[k];if(!Number.isFinite(v)||v<min||v>max)return false;if(renderer.state.paused){renderer.pause(false);$('pause').textContent='暂停';}params[k]=v;stored[current]={...params};audit.controls.push({key:k,value:v,family:current});if(audit.controls.length>300)audit.controls.shift();if($(k)){$(k).value=v;$(k+'Out').value=v.toFixed(k==='frequency'?1:2);}
 if(definitions[k][4]==='geo'){if(immediate)build();else{stop();debounce=setTimeout(build,140);}}else{applyMaterial();if(!busy&&accepted)accepted={...params};}return true;}
$('sliders').addEventListener('input',e=>{const k=e.target.dataset.param;if(k)setParameter(k,Number(e.target.value));});
$('sliders').addEventListener('change',e=>{const k=e.target.dataset.param;if(k&&definitions[k][4]==='geo'){clearTimeout(debounce);build();}});
function selectFamily(f){if(!catalog[f])return;stop();stored[current]={...params};current=f;params={...stored[f]};fitNext=true;renderer.pause(false);$('pause').textContent='暂停';build();}
function selectRock(n){if(!isRock(current)||!Number.isInteger(n)||n<1||n>7)return;if(renderer.state.paused){renderer.pause(false);$('pause').textContent='暂停';}params.rock=n;audit.lastAction='rock:'+n;stored[current]={...params};sync();if(isStone(current))build();else applyMaterial();status('岩性已选：'+rocks[n]);}
$('families').onclick=e=>{const b=e.target.closest('[data-family]');if(b)selectFamily(b.dataset.family);};$('rockControls').onclick=e=>{const b=e.target.closest('[data-rock]');if(b)selectRock(Number(b.dataset.rock));};$('rock').onchange=()=>selectRock(Number($('rock').value));
function master(n){if(!Number.isInteger(n)||n<0||n>4294967295)return;params.seed=n;for(const k of seedLayers)if(!locks[current][k])params[k+'Seed']=K.derive(n,k);build();}
$('seed').onchange=()=>master(Number($('seed').value));$('nextSeed').onclick=()=>master((params.seed+1067)>>>0);$('quickShapes').onclick=e=>{const b=e.target.closest('[data-shape]');if(b){params.shape=b.dataset.shape;fitNext=true;build();}};
function face(side){const q={front:[0,0],back:[Math.PI,0],left:[-Math.PI/2,0],right:[Math.PI/2,0],top:[0,1.44],bottom:[0,-1.44]}[side];if(q){renderer.camera.yaw=q[0];renderer.camera.pitch=q[1];renderer.invalidate();}}
$('views').onclick=e=>{const b=e.target.closest('[data-face]');if(b)face(b.dataset.face);};$('resetView').onclick=fit;
function panel(on){$('panel').hidden=!on;$('togglePanel').setAttribute('aria-expanded',String(on));}$('togglePanel').onclick=()=>panel($('panel').hidden);$('closePanel').onclick=()=>panel(false);
$('spin').onclick=()=>{renderer.state.auto=!renderer.state.auto;$('spin').classList.toggle('active',renderer.state.auto);renderer.invalidate();};
$('pause').onclick=()=>{const on=!renderer.state.paused;if(on){stop();if(accepted){params={...accepted};current=params.family;sync();}}renderer.pause(on);$('pause').textContent=on?'继续':'暂停';};
$('cancel').onclick=()=>{stop();if(accepted){params={...accepted};current=params.family;sync();applyMaterial();}};
function preset(){return{schema:'brick-mother-r6',parameters:{...params},locks:{...locks[current]},camera:{...renderer.camera}};}
function importData(d){if(d.schema!=='brick-mother-r6'||!catalog[d.parameters?.family])throw Error('请选择 R6 参数文件');const p={...fresh(d.parameters.family),...d.parameters};K.validate(p);for(const k in definitions){const[,min,max]=definitions[k];if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error('参数越界 '+k);}for(const k of seedLayers)if(!Number.isInteger(p[k+'Seed'])||p[k+'Seed']<0||p[k+'Seed']>4294967295)throw Error('种子越界');if(isRock(p.family)?p.rock<1:p.rock!==0)throw Error('岩性不匹配');stop();current=p.family;params=p;locks[current]={...d.locks};pendingCamera=null;if(d.camera){const c=d.camera;if(['yaw','pitch','radius','panX','panY'].every(k=>Number.isFinite(c[k]))&&c.radius>=1.4&&c.radius<=12&&Math.abs(c.pitch)<=1.45&&Math.abs(c.yaw)<10000&&Math.abs(c.panX)<50&&Math.abs(c.panY)<50)pendingCamera={yaw:c.yaw,pitch:c.pitch,radius:c.radius,panX:c.panX,panY:c.panY};}fitNext=true;build();}
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(preset(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Brick_Mother_R6_'+current+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};
$('import').onclick=()=>$('presetFile').click();$('presetFile').onchange=async()=>{try{const f=$('presetFile').files[0];if(f&&f.size<25000)importData(JSON.parse(await f.text()));}catch(e){issue(e);}};
$('resetAll').onclick=()=>{params=fresh(current);locks[current]={};fitNext=true;build();};
$('previous').onclick=()=>{location.href='https://haihao0307.github.io/HOUSE/brick-mother/experiments/atelier-r5/web/';};
$('share').onclick=async()=>{const url=location.href.split('#')[0]+'#preset='+encodeURIComponent(JSON.stringify(preset()));try{await navigator.clipboard.writeText(url);status('已复制当前材料与参数链接');}catch{$('shareText').value=url;$('shareText').hidden=false;$('shareText').select();status('可从文本框复制视图链接');}};
window.addEventListener('pagehide',()=>{disposed=true;stop();renderer.destroy();});document.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(document.activeElement.tagName))return;if(e.key==='Escape')panel(false);if(e.key.toLowerCase()==='f')fit();});
window.BrickR6={audit,renderer,catalog,definitions,controlKeys:()=>keys(current),parameters:()=>({...params}),getGeometry:()=>mesh,stats:()=>({busy,workerAlive:!!worker,parameters:{...params},geometry:mesh?.stats,render:{...renderer.stats},audit:{...audit}}),selectFamily,selectRock,setParameter,face,fit,master,build,preset,importData};
let loaded=false;try{if(location.hash.startsWith('#preset=')){const text=decodeURIComponent(location.hash.slice(8));if(text.length<25000){importData(JSON.parse(text));loaded=true;}}}catch(e){status('参数链接无效，使用默认砖块');}if(!loaded){sync();build();}
})();
