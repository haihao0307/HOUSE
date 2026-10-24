/**
 * KAOPU material master R03: original timber receiver + finite glass receiver.
 * THREE r170 is injected by the caller. All geometry and field positions use metres.
 * Source snapshots and rights boundaries: sources/wood-glass-provenance.json.
 * No images, texture assets, downloads or global scene mutation are required.
 */
import {
  fragmentShaderSource, createSubdividedBoxGeometry, createCylinderGeometry,
  getYunnanTimberPreset, deriveMemberParameters, bindOriginalTimberUniforms, mat4Identity
} from './mothers/timber-original.mjs';

export const WOOD_FINISHES = Object.freeze([
  {id:'warm',label:'原母体 · 暖褐中等',preset:'yunnan_warm_medium_v2'},
  {id:'aged',label:'原母体 · 深色旧木',preset:'yunnan_dark_aged_v2'},
  {id:'weathered',label:'原母体 · 浅色风化',preset:'yunnan_light_weathered_v2'},
  {id:'chestnut',label:'原母体 · 栗褐清漆',preset:'yunnan_lacquered_chestnut_v2'},
  {id:'paint',label:'新接收层 · 不透明绿漆／暖褐木底',preset:'yunnan_warm_medium_v2'}
]);
export const GLASS_RECIPE = Object.freeze({
  color:'#e0eee8',metalness:0,roughness:.045,transmission:.91,thickness:.014,
  ior:1.52,attenuationColor:'#b5cfbd',attenuationDistance:3.5,opacity:1,
  source:'hong-kong-main-city-r08/train/source/materials/matter.mjs',
  status:'limited dielectric transport; not a recovered mature glass mother',
  limitations:'Three r170 screen-space transmission; no multiple-pane or architectural optics certification'
});
const SNAPSHOT_HASH='ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(+v)?+v:a));
const mix=(a,b,t)=>a*(1-t)+b*t, fract=x=>x-Math.floor(x);
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function metres(v,label){if(!Number.isFinite(v)||v<=0)throw new RangeError(`${label} must be positive metres`);return v;}
function finishInfo(id='warm'){
  const aliases={clearcoat:'chestnut',lacquer:'chestnut',dark:'aged',original:'warm'};
  id=aliases[id]||id;
  const info=WOOD_FINISHES.find(f=>f.id===id||f.preset===id);
  if(!info)throw new RangeError(`Unknown wood finish: ${id}`);
  return info;
}
function memberFinish(preset,seed=270889,member=4401){
  const p=deriveMemberParameters(seed>>>0,member>>>0);
  return {kind:'wood',...p,seed01:.2718281828+((seed>>>0)%1000)*.000001,
    roughness:clamp((preset.surface.roughnessMin+preset.surface.roughnessMax)*.5+p.roughnessBias,preset.surface.roughnessMin,preset.surface.roughnessMax)};
}
// Direct CPU transcription of the original vertex shader, not a replacement wood noise.
function vertexHash(p,seed){const a=p.map((x,i)=>fract(x*.1031+seed*[17.17,41.73,83.11][i]));const d=a[0]*(a[1]+31.32)+a[1]*(a[2]+31.32)+a[2]*(a[0]+31.32);return fract((a[0]+a[1]+2*d)*(a[2]+d));}
function vertexNoise(p,seed){const i=p.map(Math.floor),f=p.map(fract).map(smooth),h=(x,y,z)=>vertexHash([i[0]+x,i[1]+y,i[2]+z],seed);return mix(mix(mix(h(0,0,0),h(1,0,0),f[0]),mix(h(0,1,0),h(1,1,0),f[0]),f[1]),mix(mix(h(0,0,1),h(1,0,1),f[0]),mix(h(0,1,1),h(1,1,1),f[0]),f[1]),f[2]);}
export function woodMacroHeight(position,surfaceClass=0,{finish='warm',seed=270889,member=4401}={}){
  const preset=getYunnanTimberPreset(finishInfo(finish).preset);
  return macroHeight(position,surfaceClass,preset,memberFinish(preset,seed,member));
}
function macroHeight(p,surfaceClass,preset,finish){
  const seed=finish.seed01,g=p.map(x=>x*Math.max(.001,preset.controls.textureScale));
  let q=g.map((x,i)=>x*[.28,1.15,1.15][i]+seed*7),sum=0,a=.58;
  for(let i=0;i<3;i++){sum+=a*vertexNoise(q,seed);q=q.map((x,j)=>x*2.07+[5.2,9.1,3.7][j]);a*=.45;}
  const broad=sum/.94,longWave=.5+.5*Math.sin(g[0]*.82+seed*29+broad*1.55);
  const classWeight=surfaceClass>.5&&surfaceClass<2.5?0:surfaceClass>2.5&&surfaceClass<3.5?1.08:1;
  if(classWeight===0)return 0;
  return ((broad-.5)*.78+(longWave-.5)*.22)*Math.min(preset.relief.macroDisplacementMm,preset.relief.maxMacroDisplacementMm)*.001*preset.controls.reliefScale*finish.reliefScale*classWeight;
}
function originalUniforms(T,preset,finish,round=false,radius=.12){
  const u={},names=new Proxy({},{get:(_,k)=>k}),put=(k,v)=>{u[k]={value:v};};
  const gl={uniform1f:put,uniform1i:put,uniform3fv:(k,v)=>put(k,new T.Vector3(...v)),uniform2fv:(k,v)=>put(k,new T.Vector2(...v)),uniformMatrix4fv:(k,_,v)=>put(k,new T.Matrix4().fromArray(v))};
  bindOriginalTimberUniforms(gl,names,{kind:'wood',material:{...finish,shapeMode:round?'round':'box',memberRadius:radius},geometry:{metadata:{supportsMacroDisplacement:true}},model:mat4Identity()},
    {preset,settings:{reliefMode:'inspection'},cameraPosition:[0,0,3],view:mat4Identity(),projection:mat4Identity()});
  // Original microheight and original CPU macro displacement are retained. Parallax is explicitly off.
  u.u_parallaxM.value=0;u.u_parallaxSteps.value=0;return u;
}
const varying='varying vec3 v_grainPosition;varying vec3 v_localNormal;varying vec3 v_worldPosition;varying float v_surfaceClass;';
const originalDeclarations=fragmentShaderSource.slice(fragmentShaderSource.indexOf('uniform vec3 u_cameraPosition'),fragmentShaderSource.indexOf('out vec4 outColor'));
const originalFunctions=fragmentShaderSource.slice(fragmentShaderSource.indexOf('const float PI'),fragmentShaderSource.indexOf('void main()'))
  .replace('const float PI = 3.141592653589793;','').replace(/\bsaturate\b/g,'timberSaturate');
const originalEvaluate=fragmentShaderSource.slice(fragmentShaderSource.indexOf('  vec3 baseColor = u_solidColor;'),fragmentShaderSource.indexOf('  vec3 normal = normalize(v_worldNormal);'))
  .replace(/\bsaturate\b/g,'timberSaturate').replace('length(u_cameraPosition - v_worldPosition)','length(cameraPosition - v_worldPosition)')+
  '\nktColor=baseColor;ktRoughness=roughness;ktHeight=heightMeters;ktCavity=cavity;\n';
// Authored finish wear only. This is deliberately separate from the unchanged timber field.
const wearGLSL=`
uniform float wgWear;uniform float wgStrength;uniform float wgVariant;uniform float wgMode;
uniform float wgPaint;uniform vec3 wgPaintColor;uniform vec3 wgHalfSize;
float wgReceiverNoise(vec3 p){return clamp(.72*fbm(p*vec3(1.,3.,3.)+vec3(13.2,7.7,4.1))+.28*valueNoise(p*vec3(7.,29.,29.)+vec3(3.1,19.4,11.6)),0.,1.);}
float wgDamage(vec3 p,vec3 n){
  float effort=clamp(wgWear*wgStrength*wgVariant,0.,1.);
  vec3 edgeDistance=max(wgHalfSize-abs(p),vec3(0.));
  vec3 tangentEdge=mix(edgeDistance,vec3(10.),step(vec3(.5),abs(n)));
  float edge=1.-smoothstep(.002,.025,min(tangentEdge.x,min(tangentEdge.y,tangentEdge.z)));
  float wearPatch=wgReceiverNoise(p*vec3(1.2,4.,4.));
  float score=edge*.64+wearPatch*.34;
  float mask=smoothstep(1.01-effort*.79,1.06-effort*.79,score);
  return mask*smoothstep(0.,.04,effort);
}
void evaluateOriginalTimber(out vec3 ktColor,out float ktRoughness,out float ktHeight,out float ktCavity){
${originalEvaluate}
}
`;
function requireChunk(shader,token){if(!shader.includes(token))throw Error(`WOOD_GLASS_R170_SOURCE_DRIFT: ${token}`);}
function createWoodMaterial(T,preset,finish,info,state,half,{round=false,radius=.12,shaders=[]}={}){
  const isPaint=info.id==='paint';
  const material=new T.MeshPhysicalMaterial({color:0xffffff,roughness:finish.roughness,metalness:0,
    clearcoat:isPaint?.45:preset.surface.clearcoat,clearcoatRoughness:isPaint?.23:preset.surface.clearcoatRoughness,
    specularIntensity:isPaint?.5:preset.surface.specular,ior:1.5});
  const u={...originalUniforms(T,preset,finish,round,radius),wgWear:{value:state.wear},wgStrength:{value:state.strength},wgVariant:{value:state.variant},wgMode:{value:state.mode},wgPaint:{value:isPaint?1:0},wgPaintColor:{value:new T.Color('#345d4f')},wgHalfSize:{value:new T.Vector3(...half)}};
  material.name=`Timber original / ${info.id} / ${round?'round':'box'} receiver`;
  material.userData={sourceHash:SNAPSHOT_HASH,presetId:preset.id,finishLayer:isPaint?'new opaque green paint, shared damage mask':'original preset',units:'metres',uniforms:u};
  material.onBeforeCompile=shader=>{
    for(const token of ['#include <color_fragment>','#include <roughnessmap_fragment>','#include <normal_fragment_maps>','#include <lights_physical_fragment>','#include <opaque_fragment>'])requireChunk(shader.fragmentShader,token);
    Object.assign(shader.uniforms,u);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 grainPosition;attribute vec3 grainNormal;attribute float surfaceClass;'+varying)
      .replace('#include <begin_vertex>','#include <begin_vertex>\nv_grainPosition=grainPosition;v_localNormal=grainNormal;v_surfaceClass=surfaceClass;v_worldPosition=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+varying+'\n'+originalDeclarations+'\n'+originalFunctions+'\n'+wearGLSL);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec3 ktColor;float ktRoughness,ktHeight,ktCavity;evaluateOriginalTimber(ktColor,ktRoughness,ktHeight,ktCavity);
float wgMask=wgDamage(v_grainPosition,normalize(v_localNormal));
if(wgPaint>.5){
  // One and the same mask controls exposed wood colour, roughness, microheight, cavity and clearcoat.
  ktColor=mix(wgPaintColor,ktColor,wgMask);
  ktRoughness=mix(.31,ktRoughness,wgMask);
  ktHeight=ktHeight*wgMask+(1.-wgMask)*.000065;
  ktCavity=mix(1.,ktCavity,wgMask);
}else{
  // New bounded weathering receiver; original preset/field is the unmodified base at variant 0.
  ktColor=mix(ktColor,u_weatheredColor,wgMask*.23);
  ktRoughness=clamp(ktRoughness+wgMask*.08,.18,.98);
}
diffuseColor.rgb*=ktColor;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=ktRoughness;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 wgDx=dFdx(-vViewPosition),wgDy=dFdy(-vViewPosition),wgR1=cross(wgDy,normal),wgR2=cross(normal,wgDx);float wgDet=dot(wgDx,wgR1);normal=normalize(abs(wgDet)*normal-sign(wgDet)*(dFdx(ktHeight)*wgR1+dFdy(ktHeight)*wgR2));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=1.-wgMask;material.clearcoatRoughness=clamp(material.clearcoatRoughness+wgMask*.25,0.,1.);\n#endif');
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=ktCavity;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if(wgMode>.5&&wgMode<1.5)outgoingLight=ktColor;
else if(wgMode<2.5&&wgMode>1.5)outgoingLight=vec3(ktRoughness);
else if(wgMode<3.5&&wgMode>2.5)outgoingLight=vec3(clamp(.5+ktHeight*1400.,0.,1.));
else if(wgMode>3.5)outgoingLight=vec3(wgMask);
#include <opaque_fragment>`);
    shaders.push(shader);
  };
  material.customProgramCacheKey=()=>`kaopu-r03-timber-original-physical-receiver-2`;
  return material;
}

// R02 adapter: original field/presets on independently generated architectural parts.
// The caller supplies material-attached grainPosition/grainNormal/surfaceClass attributes.
export function architectureTimberMaterial(T,{finish='warm',seed=270889,member=4401,round=false,radius=.12,half=[10,10,10],paintColor=null,shaders=[]}={}){
  const info=finishInfo(paintColor?'paint':finish),preset=getYunnanTimberPreset(info.preset);
  const material=createWoodMaterial(T,preset,memberFinish(preset,seed,member),info,{wear:0,strength:1,variant:1,mode:0},half,{round,radius,shaders});
  if(paintColor)material.userData.uniforms.wgPaintColor.value.set(paintColor);
  return material;
}
function timberGeometry(T,length,height,depth,preset,finish,{round=false,radius=.12}={}){
  const raw=round?createCylinderGeometry(length,radius,64,{axialSegments:Math.min(64,Math.max(12,Math.ceil(length/.035))),macroAmplitude:0}):
    createSubdividedBoxGeometry(length,height,depth,{lengthSegments:Math.min(64,Math.max(8,Math.ceil(length/.035))),crossSegments:Math.min(16,Math.max(4,Math.ceil(Math.max(height,depth)/.025))),endSegments:6});
  const positions=raw.positions.slice(),half=[length/2,height/2,depth/2];let maxDelta=0;
  for(let i=0;i<positions.length;i+=3){
    const p=Array.from(raw.positions.slice(i,i+3)),n=Array.from(raw.normals.slice(i,i+3));let boundary=1;
    if(round)boundary=smooth((half[0]-Math.abs(p[0]))/.012);
    else for(let k=0;k<3;k++)if(Math.abs(n[k])<.5)boundary*=smooth((half[k]-Math.abs(p[k]))/.012);
    const amount=macroHeight(Array.from(raw.grainPositions.slice(i,i+3)),raw.surfaceClasses[i/3],preset,finish)*boundary;
    maxDelta=Math.max(maxDelta,Math.abs(amount));for(let j=0;j<3;j++)positions[i+j]+=n[j]*amount;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.BufferAttribute(raw.normals.slice(),3));
  geometry.setAttribute('grainNormal',new T.BufferAttribute(raw.normals.slice(),3));
  geometry.setAttribute('grainPosition',new T.BufferAttribute(raw.grainPositions,3));
  geometry.setAttribute('surfaceClass',new T.BufferAttribute(raw.surfaceClasses,1));
  geometry.setIndex(new T.BufferAttribute(raw.indices,1));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={...raw.metadata,units:'metres',sourceHash:SNAPSHOT_HASH,maximumActualDisplacementM:maxDelta,
    relief:'original macroField CPU transcription; 12 mm seam taper; normals recomputed',roundUsesFullMother:round};
  return geometry;
}
function receiverGroup(T,kind,options){
  const group=new T.Group(),state={wear:clamp(options.wear??.65),strength:clamp(options.strength??1),mode:clamp(options.mode??0,0,4),variant:options.variant===0?0:1};
  group.name=`Material master R03 / ${kind} / ${state.variant?'receiver':'reference'}`;
  group.userData.receiver={kind,units:'metres',variant:state.variant};
  group.userData.state=state;
  group.userData.update=(next={})=>{
    for(const k of ['wear','strength','mode'])if(next[k]!==undefined)state[k]=clamp(next[k],0,k==='mode'?4:1);
    group.traverse(o=>{const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){const u=mat?.userData?.uniforms;if(u){u.wgWear.value=state.wear;u.wgStrength.value=state.strength;u.wgMode.value=state.mode;}}});
    return group;
  };
  group.userData.dispose=()=>{const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
  return group;
}
/** Returns THREE.Group. Rebuild for finish/object/dimensions; update wear/strength/mode in place. */
export function buildWoodCase(T,options={}){
  const info=finishInfo(options.finish),originalPreset=getYunnanTimberPreset(info.preset),preset={...originalPreset,controls:{...originalPreset.controls,textureScale:options.textureScale??(options.variant===0?1:5.8)}},group=receiverGroup(T,'wood',options),state=group.userData.state;
  const object=options.object??'window';if(!['window','board','round'].includes(object))throw new RangeError(`Unknown wood object: ${object}`);
  let member=0;const shaders=options.shaders??[],materials=[];
  const wood=(name,length,height,depth,position,rotateZ=0,extra={})=>{
    const finish=memberFinish(preset,options.seed??270889,4401+member++);
    const mat=createWoodMaterial(T,preset,finish,info,state,[length/2,height/2,depth/2],{...extra,shaders});materials.push(mat);
    const mesh=new T.Mesh(timberGeometry(T,length,height,depth,preset,finish,extra),mat);mesh.name=name;mesh.position.fromArray(position);mesh.rotation.z=rotateZ;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={purpose:name,lengthAxis:'local +X',units:'metres'};group.add(mesh);return mesh;
  };
  if(object==='round')wood('Full-mother round timber',1.35,.24,.24,[0,.28,0],0,{round:true,radius:.12});
  else if(object==='board'){
    const length=metres(options.length??1.35,'length'),width=metres(options.width??.28,'width'),depth=metres(options.depth??.035,'depth');
    wood('Floorboard: original grain with end faces',length,width,depth,[0,.40,0]);
  }else{
    // 1.00 × 1.42 m practical window frame. Each cut member keeps its own local +X grain.
    wood('Left window stile',1.42,.075,.095,[-.4625,.91,0],Math.PI/2);
    wood('Right window stile',1.42,.075,.095,[.4625,.91,0],Math.PI/2);
    wood('Window top rail',.85,.075,.095,[0,1.5825,0]);
    wood('Window lower rail',.85,.095,.105,[0,.2475,0]);
    wood('Window central mullion',1.24,.043,.065,[0,.91,0],Math.PI/2);
    wood('Window meeting rail',.85,.045,.065,[0,.94,.008]);
    wood('Weathered outer sill',1.12,.060,.18,[0,.17,.035]);
    // Separate cut board gives a long-grain surface and inspectable end-grain at useful scale.
    const board=wood('Detached timber board specimen',1.2,.24,.032,[0,.12,.32]);board.rotation.x=-Math.PI*.19;
  }
  group.userData.receiver={...group.userData.receiver,object,finish:info.id,presetId:preset.id,presetLabel:preset.label,
    sourceHash:SNAPSHOT_HASH,textureScale:preset.controls.textureScale,scaleSource:'Original large-timber preset 1; small-member receiver scale 5.8 inherited from FH88 WALNUT_PRESET; new receiver selection, not a changed original snapshot',mother:'mothers/timber-original.mjs',grainSpace:'member local; unaffected by group translations',
    originalRetained:['four original presets','growth rings','anisotropic fibres','pores','cracks','tool marks','knots','microheight','actual macro displacement','full mother round support'],
    additions:['Three physical-lighting transport','12 mm seam taper','new edge/patch finish wear receiver',...(info.id==='paint'?['opaque paint: shared mask for colour/roughness/microheight/cavity/clearcoat']:[])],
    limitations:['Parallax disabled in this transport','PBR lighting differs from original standalone mother lighting','Wear is authored demonstration, not calibrated historical aging','Paint film edge relief is bump height; no explicit peeling flakes']};
  group.userData.materials=materials;
  return group;
}
const glassGLSL=`
varying vec3 wgGlassPosition;
uniform float wgWear;uniform float wgStrength;uniform float wgVariant;uniform float wgMode;uniform vec3 wgHalfSize;
float wgGlassDeposit(){
  vec3 p=wgGlassPosition;float edge=min(wgHalfSize.x-abs(p.x),wgHalfSize.y-abs(p.y));
  float rim=1.-smoothstep(.002,.038,edge);
  float bottom=1.-smoothstep(.015,.13,p.y+wgHalfSize.y);
  float streak=pow(.5+.5*sin(p.x*91.+sin(p.x*32.)*2.1),18.)*(.5+.5*sin(p.y*7.5+p.x*8.));
  return clamp((rim*.52+bottom*.34+streak*.18)*wgWear*wgStrength*wgVariant,0.,.93);
}
`;
function glassMaterial(T,thickness,state,half,shaders){
  const {source,status,limitations,...renderingRecipe}=GLASS_RECIPE;
  const material=new T.MeshPhysicalMaterial({...renderingRecipe,side:T.FrontSide,transparent:false});
  // Explicitly assign only rendering properties; provenance strings are not material parameters.
  material.name=`Finite glass: ${(thickness*1000).toFixed(1)} mm`;
  material.thickness=thickness;
  const u={wgWear:{value:state.wear},wgStrength:{value:state.strength},wgVariant:{value:state.variant},wgMode:{value:state.mode},wgHalfSize:{value:new T.Vector3(...half)}};
  material.userData={uniforms:u,opticalThicknessM:thickness,physicalThicknessM:thickness,recipe:{...GLASS_RECIPE},newReceiver:'local edge deposits and streaks, not a recovered glass mother'};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,u);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 wgGlassPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nwgGlassPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+glassGLSL);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wgDeposit=wgGlassDeposit();diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.26,.20),wgDeposit*.25);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+wgDeposit*.45,.045,.8);');
    requireChunk(shader.fragmentShader,'#include <transmission_fragment>');
    const transmission=T.ShaderChunk.transmission_fragment;
    requireChunk(transmission,'material.transmission = transmission;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_fragment>',transmission.replace('material.transmission = transmission;','material.transmission = transmission * (1. - wgDeposit * .38);'));
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`if(wgMode>.5&&wgMode<1.5)outgoingLight=diffuseColor.rgb;
else if(wgMode<2.5&&wgMode>1.5)outgoingLight=vec3(roughnessFactor);
else if(wgMode<3.5&&wgMode>2.5)outgoingLight=vec3(clamp(thickness*10.,0.,1.));
else if(wgMode>3.5)outgoingLight=vec3(wgDeposit);
#include <opaque_fragment>`);
    shaders.push(shader);
  };
  material.customProgramCacheKey=()=> 'kaopu-r03-finite-glass-receiver-2';return material;
}
function plainBox(T,group,name,dimensions,position,material){const mesh=new T.Mesh(new T.BoxGeometry(...dimensions),material);mesh.name=name;mesh.position.fromArray(position);mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);return mesh;}
/** Closed panes, physical thickness == optical thickness. Returned opaque rear target permits transmission checks. */
export function buildGlassCase(T,options={}){
  const thickness=metres(options.thickness??.014,'thickness'),comparison=metres(options.compareThickness??.060,'compareThickness');
  if(thickness>.3||comparison>.3)throw new RangeError('Glass receiver supports thickness up to 0.3 metres');
  const group=receiverGroup(T,'glass',options),state=group.userData.state,shaders=options.shaders??[];
  const frame=new T.MeshStandardMaterial({color:'#444d49',roughness:.42,metalness:.75});
  const light=new T.MeshBasicMaterial({color:'#f3eee1'}),dark=new T.MeshBasicMaterial({color:'#223b46'}),red=new T.MeshBasicMaterial({color:'#bd5339'}),blue=new T.MeshBasicMaterial({color:'#587f94'});
  const samples=[{name:'Window glass',x:-.30,y:.84,w:.70,h:1.12,t:thickness},{name:'Thickness comparison coupon',x:.48,y:.57,w:.36,h:.58,t:comparison}];
  const materials=[];
  for(const s of samples){
    const mat=glassMaterial(T,s.t,state,[s.w/2,s.h/2,s.t/2],shaders);materials.push(mat);
    const pane=plainBox(T,group,s.name,[s.w,s.h,s.t],[s.x,s.y,0],mat);pane.userData={closed:true,units:'metres',physicalThicknessM:s.t,opticalThicknessM:s.t,topology:'closed 12-triangle box',purpose:s.name};
    for(const sign of [-1,1]){
      plainBox(T,group,'Vertical glazing channel',[.026,s.h+.052,s.t+.016],[s.x+sign*(s.w/2+.013),s.y,0],frame);
      plainBox(T,group,'Horizontal glazing channel',[s.w,.026,s.t+.016],[s.x,s.y+sign*(s.h/2+.013),0],frame);
    }
    const supportHeight=s.y-s.h/2-.026-.05;
    for(const side of [-1,1])plainBox(T,group,'Glazing stand support',[.024,supportHeight,.028],[s.x+side*s.w*.27,.05+supportHeight/2,0],frame);
    // Behind each pane: genuinely opaque geometry, so Three's transmission buffer can include it.
    plainBox(T,group,'Opaque transmission target',[s.w+.06,s.h+.06,.012],[s.x,s.y,-.25],light);
    for(let i=0;i<7;i++)plainBox(T,group,'Opaque contrast stripe',[s.w/17,s.h*.9,.008],[s.x+(i-3)*s.w/8,s.y,-.239],i===1?red:i===5?blue:dark);
    plainBox(T,group,'Opaque horizontal contrast',[s.w*.93,.025,.008],[s.x,s.y+.11,-.23],red);
  }
  plainBox(T,group,'Glazing display foot',[1.35,.05,.38],[0,.025,0],frame);
  group.userData.materials=materials;
  group.userData.receiver={...group.userData.receiver,thicknessM:thickness,compareThicknessM:comparison,
    closedGeometry:true,localCoordinates:true,recipe:GLASS_RECIPE,absorption:'attenuationColor + attenuationDistance (3.5 m), never opacity fading',
    additions:['geometry thickness matches optical thickness','opaque rear contrast targets','new edge-deposit/streak receiver'],
    limitations:['Three r170 screen-space finite transmission','No multi-layer mutual transmission or off-screen refraction guarantee','Not measured architectural glass; no spectral, caustic or multiple-reflection claim','14 mm versus 60 mm absorption difference is physically modest at a 3.5 m attenuation distance']};
  return group;
}
