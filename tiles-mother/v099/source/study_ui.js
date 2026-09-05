/* Live UI: comparison changes keep the same camera and installation conditions. */
function studyCameraSave(){return {yaw,pitch,distance,target:target.toArray(),side:state.cameraSide};}
function studyCameraRestore(v){yaw=v.yaw;pitch=v.pitch;distance=v.distance;target.fromArray(v.target);state.cameraSide=v.side;updateCamera();}
function applyStudyPreset(name){
 const keep=studyCameraSave();
 const shape=name==='original'?0:1,surface=name==='surface'?1:0;
 const changed=shape!==state.geometryRevision;
 state.geometryRevision=shape;state.surfaceRevision=surface;
 if(changed){queued(()=>{rebuild();studyCameraRestore(keep);studyUI();});}
 else{updateStudySurface();studyUI();}
}
function studyUI(){
 const name=state.geometryRevision===0?'original':state.surfaceRevision?'surface':'shape';
 $$('[data-study]').forEach(b=>b.classList.toggle('active',b.dataset.study===name));
 $('#studyLabel').textContent={original:'A · V0.9.8 原形 / 原材质',shape:'B · 新边口 / 原材质',surface:'C · 新边口 / 分层材质'}[name];
 $('#edgeRange').value=Math.round((state.edgeStrength??1)*100);$('#edgeValue').textContent=$('#edgeRange').value+'%';
 $('#colorRange').value=Math.round((state.colorLayer??1)*100);$('#colorValue').textContent=$('#colorRange').value+'%';
 $('#reliefRange').value=Math.round((state.striations??.7)*100);$('#reliefValue').textContent=$('#reliefRange').value+'%';
 $('#closeup').classList.toggle('active',!!state.focusSingle);
 $('#revisionInfo').textContent='V0.9.9 · 候选审阅 · 基线 V0.9.8 保留';
 $('#surfaceNote').textContent=state.surfaceRevision?'参考分层已启用；原微孔与观察光保持':'原陶瓦着色与观察光保持';
}
function focusStudy(){
 state.scene='trio';state.focusSingle=!state.focusSingle;state.cameraSide='iso';rebuild();
}
function setStudyAngle(which){
 const isSmall=state.scene==='trio'||state.scene==='uv';
 if(!isSmall){if(which==='under'){state.cameraSide='under';fitCamera(state.scene,'under');}else fitCamera(state.scene,'iso');return;}
 if(!state.focusSingle){state.scene='trio';state.focusSingle=true;rebuild();}
 target.set(0,-.007,0);distance=(state.trioFamily==='cover'?1.10:1.38)*Math.max(1,.9/camera.aspect);
 if(which==='edge'){yaw=-.67;pitch=.19;}
 if(which==='end'){yaw=Math.PI;pitch=.03;}
 if(which==='top'){yaw=0;pitch=1.36;}
 if(which==='under'){yaw=-.55;pitch=-.5;}
 if(which==='iso'){yaw=-.63;pitch=.60;}
 state.cameraSide=which==='under'?'under':'iso';updateCamera();studyUI();
}
$$('[data-study]').forEach(b=>b.onclick=()=>applyStudyPreset(b.dataset.study));
$('#edgeRange').oninput=e=>{$('#edgeValue').textContent=e.target.value+'%';};
$('#applyEdge').onclick=()=>{const c=studyCameraSave();state.edgeStrength=+$('#edgeRange').value/100;state.geometryRevision=1;queued(()=>{rebuild();studyCameraRestore(c);studyUI();});};
$('#colorRange').oninput=e=>{state.colorLayer=+e.target.value/100;state.surfaceRevision=1;updateStudySurface();studyUI();};
$('#reliefRange').oninput=e=>{state.striations=+e.target.value/100;state.surfaceRevision=1;updateStudySurface();studyUI();};
$('#closeup').onclick=focusStudy;$$('[data-study-angle]').forEach(b=>b.onclick=()=>setStudyAngle(b.dataset.studyAngle));
$('#neutralClay').onclick=()=>{const keep=studyCameraSave();state.mode=state.mode==='clay'?'material':'clay';queued(()=>{rebuild();studyCameraRestore(keep);studyUI();});};
$('#saveStudy').onclick=()=>{const r={schema:'tiles-mother-v099-review-state',version:'0.9.9',state:structuredClone(state),camera:studyCameraSave(),counts:lastRoof?.counts??null,contacts:lastRoof?.contactReport??null,sourceCommit:'ab18ac365be1444587f42f483af5d2a08cf8a815',sourceScanSHA256:'ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365',visualApproved:false,productionApproved:false};const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Tiles_Mother_V099_Review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let referenceURL=null;
$('#referenceFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(!/^image\//.test(f.type)){alert('请选择图片文件');return;}if(referenceURL)URL.revokeObjectURL(referenceURL);referenceURL=URL.createObjectURL(f);$('#referenceImage').src=referenceURL;$('#referenceName').textContent=f.name;$('#referencePanel').hidden=false;};
$('#closeReference').onclick=()=>{$('#referencePanel').hidden=true;};
// Two-finger pinch/pan is independent from the inherited single-pointer rotation.
const touchPoints=new Map();let touchGesture=null;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===2){const a=[...touchPoints.values()];touchGesture={span:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};drag=null;e.stopImmediatePropagation();}},true);
canvas.addEventListener('pointermove',e=>{if(!touchPoints.has(e.pointerId))return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===2&&touchGesture){const a=[...touchPoints.values()],span=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),x=(a[0].x+a[1].x)/2,y=(a[0].y+a[1].y)/2;distance=clamp(distance*touchGesture.span/Math.max(1,span),.3,24);const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);target.addScaledVector(right,-(x-touchGesture.x)*distance*.00115).addScaledVector(up,(y-touchGesture.y)*distance*.00115);touchGesture={span,x,y};drag=null;updateCamera();e.stopImmediatePropagation();}},true);
for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{touchPoints.delete(e.pointerId);touchGesture=null;},true);
window.TilesMotherV099={...window.TilesMotherV098,version:'0.9.9',applyPreset:applyStudyPreset,setAngle:setStudyAngle,focus:focusStudy,getCamera:studyCameraSave,sourceCommit:'ab18ac365be1444587f42f483af5d2a08cf8a815',setView:x=>{Object.assign(state,x);rebuild();studyUI();},geometryBuilders:{original:makeTileGeometryV098,candidate:makeTileGeometryV099},auditUV:uvGate};
window.__tilesDebug.makeTileGeometry=makeTileGeometry;window.__tilesDebug.placementCache=placementCache;
studyUI();document.body.dataset.version='0.9.9';
