const $=s=>document.querySelector(s),canvas=$('#stage');
const settings={scene:'roof48',seed:314159,year:0,care:false,relief:1.1,warmth:.45,patina:.52,wet:0,moss:.8,mossHeight:1,brightness:1,temperature:.12,variation:.7,core:.5,twist:1,fracture:0,diagnostic:0};
let renderer,workshop,camera={yaw:-.57,pitch:.69,distance:.67,target:[0,.025,0]},frame=0,drag=new Map(),renderRequested=false,lastStats={},requestedBuild=0,resetPending=false;
function requestRender(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;try{let t=performance.now();lastStats=renderer.render(camera,settings,workshop.bounds);lastStats.cpuSubmitMs=performance.now()-t;$('#metrics').textContent=`绘制 ${lastStats.drawCalls} 次 · 三角形 ${lastStats.triangles.toLocaleString()} · 几何缓冲 ${(lastStats.geometryBytes/1048576).toFixed(2)} MiB · 最近生成 ${workshop.buildMs.toFixed(1)} ms · 静止停绘`;}catch(e){fail(e)}})}
function fail(e){console.error(e);$('#busy').hidden=true;let el=document.createElement('div');el.className='fail';el.textContent='工作台未能完成初始化。\n'+e.message;document.body.appendChild(el)}
function fit(view='iso'){
 let f=workshop.fit,aspect=canvas.clientWidth/canvas.clientHeight;camera={target:f.target.slice(),distance:f.distance*Math.max(1,.95/aspect),yaw:f.yaw,pitch:f.pitch};
 if(view==='edge'){camera.pitch=.16;camera.yaw=-.14;camera.distance*=.93}
 if(view==='under'){camera.pitch=-.47;camera.yaw=.42}
 requestRender();
}
function rebuild(reset=false){
 resetPending=resetPending||reset;const ticket=++requestedBuild;$('#busy').hidden=false;$('#busy').textContent='更新…';
 return new Promise(resolve=>setTimeout(()=>{if(ticket!==requestedBuild){resolve(false);return}try{
  workshop.build(settings);if(resetPending){resetPending=false;fit()}else requestRender();
  $('#fracture').disabled=settings.scene.startsWith('roof');$('#moss').disabled=settings.scene==='wood';$('#warmth').disabled=settings.scene==='wood';document.querySelector('label[for=fracture]').textContent=settings.scene==='wood'?'破损端口':'断口展开';$('#fracture').max=settings.scene==='wood'?'1':'2';$('#fracture').step=settings.scene==='wood'?'1':'.2';
  const names={pan:'手工板瓦',cover:'弧形筒瓦',trio:'三片 · 同一材料，不同窑色',wood:'旧木 · 纤维与断面',roof48:'搭接构造 · 49片（含补回顶口筒瓦）',roof860:'八百六十片 · 整坡屋面'};
  $('#caption').textContent=names[settings.scene];let roof=settings.scene.startsWith('roof');$('#timeline').hidden=false;
  $('#subcaption').textContent=roof?'圆椽承托 · 四道横梁 · 板瓦排水 / 筒瓦盖缝':settings.scene==='wood'?'顺纹细部 · 独立端面 · 本色与灰化':'闭合薄壳 · 灰青陶面 · 局部土赭';
  $('#smallstats').textContent=roof?`在役 ${workshop.stats.panLive+workshop.stats.coverLive} / ${workshop.stats.originalTiles} · 失养 ${settings.care?'持续修缮':settings.year+' 年'}`:'';
  $('#busy').hidden=true;document.body.dataset.ready='true';resolve(true);
 }catch(e){fail(e);resolve(false)}},16));
}
function updateButtons(){document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('active',b.dataset.scene===settings.scene));$('#care').classList.toggle('active',settings.care);$('#years').textContent=settings.year;$('#year').value=settings.year}
function option(k,value){settings[k]=value;let input=document.getElementById(k);if(input&&input.type==='range'){input.value=value;let out=document.getElementById(k+'Val');if(out)out.textContent=Math.round(value*100)+'%';}if(k==='scene'){updateButtons();return rebuild(true)}if(['moss','mossHeight','fracture','seed','year','care'].includes(k)){if(k==='moss'||k==='mossHeight'){for(let key of workshop.geometries.keys())if(key.includes('moss')||/m\d$/.test(key))workshop.geometries.delete(key)}updateButtons();return rebuild(false)}requestRender();return Promise.resolve(true)}
function init(){try{
 $('#panel').hidden=innerWidth<800;$('#settings').setAttribute('aria-expanded',String(innerWidth>=800));renderer=new Renderer(canvas);workshop=new Workshop(renderer);workshop.build(settings);fit();$('#busy').hidden=true;updateButtons();rebuild(false);document.body.dataset.ready='true';
 $('#settings').onclick=()=>{let p=$('#panel');p.hidden=!p.hidden;$('#settings').setAttribute('aria-expanded',String(!p.hidden))};$('#home').onclick=()=>fit();
 document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>option('scene',b.dataset.scene));document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fit(b.dataset.view));
 $('#gray').onclick=()=>{settings.diagnostic=settings.diagnostic?0:1;$('#gray').classList.toggle('active',!!settings.diagnostic);requestRender()};
 for(let k of ['relief','warmth','patina','wet','moss','mossHeight','fracture','brightness','temperature','variation','core','twist']){let input=$('#'+k);input.oninput=()=>{$('#'+k+'Val').textContent=Math.round(input.value*100)+'%';if(!['moss','mossHeight','fracture'].includes(k))option(k,+input.value)};if(['moss','mossHeight','fracture'].includes(k))input.onchange=()=>option(k,+input.value)}
 $('#year').oninput=()=>$('#years').textContent=$('#year').value;$('#year').onchange=()=>option('year',+$('#year').value);$('#care').onclick=()=>option('care',!settings.care);
 $('#seed').onchange=()=>{let n=+$('#seed').value;if(!Number.isInteger(n)||n<1||n>1e7)return;option('seed',n)};
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const preset=b.dataset.preset;let vals=preset==='neutral'?{brightness:1,temperature:.12,variation:.7,patina:.52,warmth:.45}:preset==='dark'?{brightness:.77,temperature:0,variation:.60,patina:.34,warmth:.20}:{brightness:1.08,temperature:.45,variation:.80,patina:.64,warmth:.65};for(let[k,v]of Object.entries(vals))option(k,v)});
 document.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>option('year',+b.dataset.year));
 $('#resetColor').onclick=()=>{for(let[k,v]of Object.entries({brightness:1,temperature:.12,variation:.7,patina:.52,warmth:.45,relief:1.1,core:.5,twist:1,wet:0}))option(k,v)};
 $('#newSeed').onclick=()=>{let n=1+Math.floor(hash(settings.seed+773)*9999999);$('#seed').value=n;option('seed',n)};
 $('#save').onclick=()=>{let a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({version:'clean-02',settings,camera},null,2)],{type:'application/json'}));a.href=url;a.download='tiles-clean-parameters.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 let refURL=null;$('#file').onchange=()=>{let f=$('#file').files[0];if(!f)return;if(refURL)URL.revokeObjectURL(refURL);refURL=URL.createObjectURL(f);$('#reference').src=refURL;$('#reference').hidden=false;$('#hideRef').hidden=false};$('#hideRef').onclick=()=>{$('#reference').hidden=true;$('#hideRef').hidden=true};
 canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);drag.set(e.pointerId,[e.clientX,e.clientY]);};
 canvas.onpointermove=e=>{if(!drag.has(e.pointerId))return;let prev=drag.get(e.pointerId),dx=e.clientX-prev[0],dy=e.clientY-prev[1];if(drag.size===2){let others=[...drag].find(([id])=>id!==e.pointerId)[1],old=Math.hypot(prev[0]-others[0],prev[1]-others[1]),next=Math.hypot(e.clientX-others[0],e.clientY-others[1]);if(next>5)camera.distance=clamp(camera.distance*old/next,.14,30)}else if(e.shiftKey||e.buttons===2){let scale=camera.distance*.001;camera.target[0]-=dx*scale*Math.cos(camera.yaw);camera.target[2]+=dx*scale*Math.sin(camera.yaw);camera.target[1]+=dy*scale}else{camera.yaw-=dx*.006;camera.pitch=clamp(camera.pitch+dy*.006,-1.25,1.40)}drag.set(e.pointerId,[e.clientX,e.clientY]);requestRender()};
 canvas.onpointerup=canvas.onpointercancel=e=>drag.delete(e.pointerId);canvas.oncontextmenu=e=>e.preventDefault();canvas.ondblclick=()=>fit();
 canvas.onwheel=e=>{e.preventDefault();camera.distance=clamp(camera.distance*Math.exp(e.deltaY*.001),.14,30);requestRender()};
 window.addEventListener('resize',()=>requestRender());window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(['f','r','F','R'].includes(e.key))fit();if(e.key==='Escape')$('#panel').hidden=true});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#busy').hidden=false;$('#busy').textContent='图形上下文中断，请重新打开页面。'});
 window.TilesClean={version:'clean-02',settings,camera:()=>camera,workshop,renderer,option,fit,requestRender,stats:()=>({...lastStats,...workshop.stats,buildMs:workshop.buildMs,seatingMs:workshop.seatingMs,frames:renderer.frames,pendingFrames:frame?1:0,generation:workshop.generation}),snapshot:()=>workshop.records.map(r=>({kind:r.kind,row:r.row,col:r.col,m:r.m,seed:r.seed}))};
 }catch(e){fail(e)}}
init();
