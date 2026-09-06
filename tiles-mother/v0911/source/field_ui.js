/* Compact controls, last-request-wins rebuild queue, independent inspection clock. */
let fieldQueue=0,fieldPlayTimer=0;
function fieldEnqueue(fn){
 const ticket=++fieldQueue,overlay=$('#runtimeOverlay');overlay.hidden=false;
 $('#runtimeTitle').textContent='正在更新构件与实际接触';$('#runtimeMessage').textContent='只执行最新请求；静止后停止绘制。完整860片的首次落座仍需计算。';
 requestAnimationFrame(()=>setTimeout(()=>{if(ticket!==fieldQueue)return;try{fn();}catch(e){window.__tilesShowRuntimeError(e.message);throw e;}finally{if(ticket===fieldQueue)overlay.hidden=true;}},25));
}
function fieldSyncUI(){
 $('#sceneName').textContent=state.scene==='fracture'?'受水 · 断口 · 厚苔':{trio:'三片独立瓦',forty8:'48片构造台',roof:'860片屋面',uv:'逐面 UV 检查'}[state.scene];
 $('#yearValue').textContent=state.year.toFixed(1)+' 年';$('#year').value=state.year;
 $('#fieldYear').textContent=state.year.toFixed(1);$('#fieldClock').value=state.year;
 $('#lifeControls').hidden=false;$('#fieldSpecimens').hidden=state.scene!=='fracture';
 $('#revisionInfo').textContent='V0.9.11 · 共用噪波场 / 受水断口';
 $('#waveSwitch').textContent=state.waveSurface?'D 噪波材质已启用':'D 切换噪波材质';$('#waveSwitch').classList.toggle('active',state.waveSurface);
 $('#mossSwitch').classList.toggle('active',state.mossEnabled);document.body.classList.toggle('wave-selected',state.waveSurface);if(state.waveSurface)$$('[data-study]').forEach(b=>b.classList.remove('active')); 
 $('#fieldGateText').textContent='简化受水与受力模型 · 参数未标定';
 $('#studyLabel').textContent=state.waveSurface?'D · 共用场 / 纯计算材质':state.geometryRevision?'C · 保留上版材质对照':'A · 原形原材质';
 $$('[data-specimen]').forEach(b=>b.classList.toggle('active',b.dataset.specimen===state.specimen));
}
function studyUI(){studyUIV0910();if($('#fieldClock'))fieldSyncUI();}
function fieldSetYear(y){state.year=clamp(+y||0,0,15);fieldEnqueue(rebuild);}
function fieldStop(){clearTimeout(fieldPlayTimer);fieldPlayTimer=0;$('#fieldPlay').textContent='播放';}
function fieldPlayStep(){if(state.year>=15){fieldStop();return;}state.year=Math.min(15,state.year+.5);rebuild();fieldPlayTimer=setTimeout(fieldPlayStep,800);}
function fieldInstallUI(){
 // Scene navigation first; the familiar detailed controls remain in expandable groups.
 const left=$('.left'),nav=$('.nav').closest('.section');left.prepend(nav);
 const study=$('.study-controls');const details=document.createElement('details');details.className='field-details';details.innerHTML='<summary>边口、色层与原参考</summary>';study.before(details);details.append(study);
 const life=$('#lifeControls');nav.after(life);life.hidden=false;
 $('#year').max=15;$('#year').step=.5;$('#year').value=state.year;
 const shortcuts=life.querySelectorAll('[data-year]'),vals=[0,3,5,7,10];shortcuts.forEach((b,i)=>{b.dataset.year=vals[i];b.textContent=vals[i];b.onclick=()=>fieldSetYear(vals[i]);});
 const occ=life.querySelector('[data-care="maintained"]');if(occ)occ.textContent='持续修缮';life.querySelector('h2').textContent='失养情景';life.querySelector('.yearline span').textContent='停止维护经过';
 const right=$('.right'),stats=$('#sceneStats').closest('.section');right.prepend(stats);
 // Put diagnostic lists into collapsed sections, without removing them.
 for(const section of [...right.querySelectorAll(':scope > .section')]){
  if(section===stats||section.id==='fieldControls')continue;
  const d=document.createElement('details');d.className='field-details';const h=section.querySelector('h3');d.innerHTML='<summary>'+(h?.textContent||'范围说明')+'</summary>';section.before(d);d.append(section);
 }
 const perf=$('#perfStatus').closest('.section');right.append(perf);
 $('#fieldClock').oninput=e=>{$('#fieldYear').textContent=(+e.target.value).toFixed(1);};$('#fieldClock').onchange=e=>fieldSetYear(e.target.value);
 $('#year').oninput=e=>{$('#yearValue').textContent=(+e.target.value).toFixed(1)+' 年';};$('#year').onchange=e=>fieldSetYear(e.target.value);
 $('#fieldPlay').onclick=()=>{if(fieldPlayTimer)fieldStop();else{if(state.year>=15)state.year=0;$('#fieldPlay').textContent='暂停';fieldPlayTimer=setTimeout(fieldPlayStep,20);}};
 $('#waveSwitch').onclick=()=>{const keep=studyCameraSave();state.waveSurface=!state.waveSurface;fieldEnqueue(()=>{rebuild();studyCameraRestore(keep);});};
 $('#mossSwitch').onclick=()=>{const keep=studyCameraSave();state.mossEnabled=!state.mossEnabled;fieldEnqueue(()=>{rebuild();studyCameraRestore(keep);});};
 for(const [id,key,scale] of [['fieldRain','rainInput',100],['fieldLoad','loadFactor',100],['mossThickness','mossThickness',100],['openCut','openCut',100]]){
  const e=$('#'+id);e.oninput=()=>{$('#'+id+'Val').textContent=(+e.value/scale).toFixed(2);};e.onchange=()=>{const keep=studyCameraSave();state[key]=+e.value/scale;fieldEnqueue(()=>{rebuild();studyCameraRestore(keep);});};
 }
 $$('[data-specimen]').forEach(b=>b.onclick=()=>{state.specimen=b.dataset.specimen;fieldEnqueue(rebuild);});
 $('#showLab').onclick=()=>{state.scene='fracture';state.focusSingle=false;state.year=Math.max(7,state.year);state.specimen='both';fieldEnqueue(rebuild);};
 const oldApply=applyStudyPreset;
 $$('[data-study]').forEach(b=>b.onclick=()=>{state.waveSurface=false;oldApply(b.dataset.study);fieldEnqueue(rebuild);});
 $$('[data-study-angle]').forEach(b=>b.onclick=()=>{if(state.scene!=='fracture'){setStudyAngle(b.dataset.studyAngle);return;}const angle=b.dataset.studyAngle;const map={iso:[-.38,.48],edge:[-.75,.19],end:[Math.PI-.22,.08],top:[0,1.36],under:[-.45,-.5]};[yaw,pitch]=map[angle];updateCamera();});
 $('#resetCamera').onclick=()=>{if(state.scene==='fracture')buildFieldLab();else fitCamera(state.scene,'iso');};
 $('#underCamera').onclick=()=>{state.cameraSide=state.cameraSide==='under'?'iso':'under';if(state.scene==='fracture'){pitch=state.cameraSide==='under'?-.5:.48;updateCamera();}else fitCamera(state.scene,state.cameraSide);};
 $('#surfaceNote').textContent='D 共用噪波材质可同机位切换；裂纹与厚苔不靠贴图透明层。';
 fieldSyncUI();
}
