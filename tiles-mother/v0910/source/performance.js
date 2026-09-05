/* Performance-only layer. The tile generators, timber evolution, materials and
 * lighting parameters are inherited unchanged. Complete scenes are bounded by
 * a two-entry LRU; triangle proxies are reconstructed only for explicit audits.
 */
const perfSceneBank=new Map(),perfGlobalQABank=new Map();
const perfMetrics={version:'0.9.10',sceneHits:0,sceneMisses:0,lastBuildMs:0,lastBuildMode:'',frames:0,frameCallbacks:0,sceneCacheLimit:2,compactFits:0};
function perfSceneKey(kind=state.scene){return ['v0910',kind,state.geometryRevision,state.edgeStrength,state.year,state.seed,state.care,state.mode].join('/');}
function perfKeepResources(){
 const geos=new Set(),mats=new Set(PERSISTENT_MATERIALS),roots=new Set([...stageRoot.children,...[...perfSceneBank.values()].map(x=>x.record.roof)]);
 for(const root of roots)root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])mats.add(m);});
 return {geos,mats};
}
function perfDisposeRoot(root){
 const keep=perfKeepResources(),geos=new Set(),mats=new Set();
 root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])mats.add(m);if(o.isInstancedMesh)o.dispose?.();});
 for(const g of geos)if(!keep.geos.has(g))g.dispose();
 for(const m of mats)if(!keep.mats.has(m)){if(m.map&&!PERSISTENT_MATERIALS.has(m))m.map.dispose();m.dispose();}
 for(const [key,m] of materialCache)if(!keep.mats.has(m)){m.dispose();materialCache.delete(key);}
}
function clearStage(){
 const keep=new Set([...perfSceneBank.values()].map(x=>x.record.roof)),old=stageRoot.children.slice();
 for(const root of old)stageRoot.remove(root);
 for(const root of old)if(!keep.has(root))perfDisposeRoot(root);
 $('#sceneStats').innerHTML='';
}
function perfCompactRecord(record){
 let compact=0;
 for(const fits of [record.panFits,record.coverFits])for(const f of fits){
  if(!f)continue;
  if(f.__releaseProxy){f.__releaseProxy();compact++;continue;}
  const original=f.proxy,g=original.geometry,finalMatrix=original.matrix.clone(),dy=original.yOffset;
  const calculationMatrix=finalMatrix.clone();calculationMatrix.elements[13]-=dy;
  let held=null;
  Object.defineProperty(f,'proxy',{enumerable:true,configurable:true,get(){if(!held){held=makeProxy(g,calculationMatrix);held.yOffset=dy;held.matrix=finalMatrix.clone();}return held;}});
  Object.defineProperty(f,'__releaseProxy',{value:()=>{held=null;}});compact++;
 }
 perfMetrics.compactFits=compact;
}
function perfSyncMaterials(){
 stageRoot.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){
  if(m.userData.uniforms)m.userData.uniforms.ceramic.value.z=state.light==='rain'?1:0;
  if(m.userData.study)m.userData.study.value.set(state.surfaceRevision?1:0,state.colorLayer??1,state.striations??.7,0);
 }});
}
function perfRememberRoof(key){
 const record=lastRoof;
 perfCompactRecord(record);
 perfSceneBank.set(key,{record,html:$('#sceneStats').innerHTML,gateText:$('#contactGate').textContent,gateClass:$('#contactGate').className});
 while(perfSceneBank.size>perfMetrics.sceneCacheLimit){const oldest=perfSceneBank.keys().next().value,entry=perfSceneBank.get(oldest);perfSceneBank.delete(oldest);perfDisposeRoot(entry.record.roof);}
}
function buildRoofLike(kind){
 const start=performance.now(),key=perfSceneKey(kind),cached=perfSceneBank.get(key);
 if(cached){
  clearStage();perfSceneBank.delete(key);perfSceneBank.set(key,cached);lastRoof=cached.record;stageRoot.add(lastRoof.roof);
  perfCompactRecord(lastRoof);perfSyncMaterials();
  $('#sceneStats').innerHTML=cached.html;$('#contactGate').textContent=cached.gateText;$('#contactGate').className=cached.gateClass;
  fitCamera(kind,state.cameraSide);applyTimberOnly();perfMetrics.sceneHits++;perfMetrics.lastBuildMode='完整场景复用';
 }else{
  buildRoofLikeV099(kind);perfRememberRoof(key);perfMetrics.sceneMisses++;perfMetrics.lastBuildMode='新状态精确计算';
 }
 perfMetrics.lastBuildMs=performance.now()-start;perfUpdatePanel();
}
function runGlobalQA(){
 const key=['v0910',state.geometryRevision,state.edgeStrength].join('/'),cached=perfGlobalQABank.get(key);
 if(cached){lastGlobalQA=cached.qa;$('#uvGate').textContent=cached.text;$('#uvGate').className=cached.cls;$('#uvReport').innerHTML=cached.html;return lastGlobalQA;}
 const qa=runGlobalQAV099();perfGlobalQABank.set(key,{qa,text:$('#uvGate').textContent,cls:$('#uvGate').className,html:$('#uvReport').innerHTML});
 if(perfGlobalQABank.size>6)perfGlobalQABank.delete(perfGlobalQABank.keys().next().value);return qa;
}
function perfUpdatePanel(){
 const box=$('#perfStatus');if(!box)return;
 box.textContent=(state.scene==='roof'||state.scene==='forty8'?`${perfMetrics.lastBuildMode} ${(perfMetrics.lastBuildMs/1000).toFixed(3)} s · `:'')+`缓存 ${perfSceneBank.size}/2 · ${state.autoRotate?'自动旋转':'静止时停止绘制'}`;
}
function perfSnapshot(){
 const resources=perfKeepResources();let instanceBytes=0,instanceSlots=0;
 stageRoot.traverse(o=>{if(o.isInstancedMesh){instanceSlots+=o.instanceMatrix.count;instanceBytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength||0);}});
 return {...perfMetrics,pendingFrame:!!perfPending,cacheKeys:[...perfSceneBank.keys()],instanceBytes,instanceSlots,geometryCount:resources.geos.size,materialCount:resources.mats.size,renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory}},hidden:document.hidden};
}
