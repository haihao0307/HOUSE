/* V0911 shared procedural field. No sampled material textures on this path.
   Four bounded spatial scales; the same evaluations feed albedo/roughness/normal.
   A retained old-material path provides the appearance and cost control. */
const waveNoiseGLSL=`
float wh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
vec4 wn(vec3 p){
 vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),d=6.*f*(1.-f);
 float a=wh(i),b=wh(i+vec3(1,0,0)),c=wh(i+vec3(0,1,0)),e=wh(i+vec3(1,1,0));
 float h=wh(i+vec3(0,0,1)),j=wh(i+vec3(1,0,1)),k=wh(i+vec3(0,1,1)),l=wh(i+vec3(1,1,1));
 float lo=mix(mix(a,b,u.x),mix(c,e,u.x),u.y),hi=mix(mix(h,j,u.x),mix(k,l,u.x),u.y);
 vec3 g=vec3(mix(mix(b-a,e-c,u.y),mix(j-h,l-k,u.y),u.z),mix(mix(c-a,e-b,u.x),mix(k-h,l-j,u.x),u.z),hi-lo)*d;
 return vec4(mix(lo,hi,u.z),g);
}
vec3 waveLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
`;
const waveShader=waveNoiseGLSL+`
varying vec3 wP;varying vec3 wN;varying vec3 wX;varying vec3 wY;varying vec3 wZ;varying float wCavity;varying float wFace;varying float wCut;varying vec2 wUV;
uniform vec4 waveControl;uniform vec4 waveCause;uniform vec4 identity;uniform vec4 ceramic;
vec3 waveColorResult;vec3 waveGradientResult;float waveRoughResult;float waveAOResult;
void waveEvaluate(){
 vec3 p=wP;vec3 id=identity.xyz;
 float waveFootprint=max(length(dFdx(p)),length(dFdy(p)));
 float wf=1.-smoothstep(.25,.90,waveFootprint*245.),wgf=1.-smoothstep(.20,.75,waveFootprint*2100.);
 vec4 low=wn(p*11.+id),middle=wn(p*55.+id+vec3(11.,7.,3.)),fine=vec4(.5,0,0,0),grain=vec4(.5,0,0,0);
 if(wf>.001){fine=wn(p*245.+id+27.);fine=vec4(mix(.5,fine.x,wf),fine.yzw*wf);}
 if(wgf>.001){grain=wn(p*2100.+id+41.);grain=vec4(mix(.5,grain.x,wgf),grain.yzw*wgf);}
 float warm=smoothstep(.48,.73,low.x+(middle.x-.5)*.20+identity.w*.7);
 float ash=smoothstep(.48,.76,middle.x+(fine.x-.5)*.27);
 float deep=smoothstep(.67,.84,low.x*.32+middle.x*.68);
 vec3 c=vec3(.365,.405,.421)+identity.w*.055;
 c=mix(c,vec3(.50,.40,.305),warm*.32*waveControl.x);
 c=mix(c,vec3(.62,.602,.557),ash*.32*waveControl.x);
 c=mix(c,vec3(.235,.27,.287),deep*.36*waveControl.x);
 c+=(fine.x-.5)*.035+(grain.x-.5)*.022;
 // Sparse 3D pore cells. Feature sphere remains within its cell (no cell cutoffs).
 vec3 cp=p*680.+id,cell=floor(cp),cf=fract(cp);
 float h=wh(cell+3.);vec3 centre=vec3(.35+.28*h,.35+.28*wh(cell+7.),.35+.28*wh(cell+13.));
 vec3 delta=cf-centre;float r=.14+.13*h,rr=length(delta),pore=(1.-smoothstep(r*.50,r,rr))*step(.80,h);
 float lip=exp(-pow((rr-r)/.048,2.))*step(.80,h);
 float wp=1.-smoothstep(.20,.70,waveFootprint*680.);pore*=wp;lip*=wp;vec3 poreGrad=delta/max(rr,.001)*pore*.42;
 // Forming striations share the medium field. No secondary octave stack.
 float phase=p.x*4700.+p.z*135.+middle.x*4.;float band=sin(phase);
 float stripe=smoothstep(.91,.998,band)*smoothstep(.43,.72,fine.x)*waveControl.y*(1.-smoothstep(.20,.70,waveFootprint*760.));
 float moisture=clamp(waveCause.x+ceramic.z*.65,0.,1.);
 float patina=waveCause.y*smoothstep(.24,.8,wUV.y)*smoothstep(.38,.65,middle.x);
 c-=pore*.070+stripe*.016;c+=lip*.013;
 c=mix(c,vec3(.455,.44,.39),patina*.20);
 // A bounded long crack follows the selected bending/weakness corridor.
 float path=waveCause.w+.0035*sin(p.z*57.+id.x)+.0014*sin(p.z*131.+id.y);
 float width=.00010+.00048*waveCause.z;
 float crack=1.-smoothstep(width,width+max(fwidth(p.x)*.75,.00006),abs(p.x-path));
 crack*=smoothstep(.26,.62,waveCause.z)*smoothstep(.05,.20,wUV.y)*(1.-smoothstep(.76,.95,wUV.y));
 c=mix(c,vec3(.20,.20,.182),crack*.70);
 // Fresh fractured ceramic is rough and granular; same rest coordinates on both halves.
 vec3 cut=mix(vec3(.40,.36,.31),vec3(.59,.51,.415),fine.x)+(grain.x-.5)*.085;
 c=mix(c,cut,clamp(wCut,0.,1.));
 c*=1.-moisture*.17;
 waveColorResult=waveLinear(clamp(c,vec3(.13),vec3(.78)));
 waveRoughResult=clamp(.80+(fine.x-.5)*.13+patina*.05+pore*.07-moisture*.18+wCut*.05,.38,.96);
 waveAOResult=clamp(1.-pore*.18-wCavity*.14-crack*.08,.60,1.);
 waveGradientResult=(fine.yzw*.060+grain.yzw*.18-poreGrad+vec3(stripe*.045,0.,0.))*(1.+wCut*.6);
}
`;
function waveMaterial(kind,variant,age,wet=0){
 const key=['wave',state.scene,state.seed,kind,variant,Math.round(age/5),state.mode].join('/');
 if(materialCache.has(key))return materialCache.get(key);
 const seed=hash32(state.seed+variant*8191+(kind==='cover'?1337:0));
 const u={identity:{value:new THREE.Vector4(hash01(seed,1)*97,hash01(seed,2)*97,hash01(seed,3)*97,(hash01(seed,4)-.5)*.22)},ceramic:{value:new THREE.Vector4(1,1,wet,0)},waveControl:{value:new THREE.Vector4(state.colorLayer??1,state.striations??.7,0,0)},waveCause:{value:new THREE.Vector4()}};
 const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.80,metalness:0,envMapIntensity:.68,side:THREE.FrontSide});m.userData.uniforms=u;m.userData.wave=true;m.userData.waveKind=kind;
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,u);
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
attribute float tileCavity;attribute float tileFace;attribute float waveCut;
varying vec3 wP;varying vec3 wN;varying vec3 wX;varying vec3 wY;varying vec3 wZ;varying float wCavity;varying float wFace;varying float wCut;varying vec2 wUV;`)
  .replace('#include <begin_vertex>',`#include <begin_vertex>
wP=position;wN=normal;wCavity=tileCavity;wFace=tileFace;wCut=waveCut;wUV=uv;
mat3 localRotation=mat3(1.);
#ifdef USE_INSTANCING
 localRotation=mat3(instanceMatrix);
#endif
wX=normalMatrix*localRotation*vec3(1,0,0);wY=normalMatrix*localRotation*vec3(0,1,0);wZ=normalMatrix*localRotation*vec3(0,0,1);`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+waveShader)
   .replace('#include <color_fragment>','#include <color_fragment>\nwaveEvaluate();diffuseColor.rgb*=waveColorResult;')
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=waveRoughResult;')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 wg=wX*waveGradientResult.x+wY*waveGradientResult.y+wZ*waveGradientResult.z;wg-=normal*dot(wg,normal);normal=normalize(normal-wg);')
   .replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=waveAOResult;');
  m.userData.compiled=true;
 };
 m.defaultAttributeValues={...m.defaultAttributeValues,waveCut:[0]};
 m.customProgramCacheKey=()=>`tm0911-shared-wave-${kind}`;materialCache.set(key,m);waveUpdateMaterial(m);return m;
}
function waveUpdateMaterial(m){
 const u=m.userData.uniforms;if(!m.userData.wave||!u)return;
 const wet=state.care==='abandoned'?1-Math.exp(-state.year*.12*state.rainInput):.12;
 const demand=fieldTileDemand(m.userData.waveKind||'pan',state.care==='maintained'?0:state.year,state.seed,state.rainInput,state.loadFactor);
 u.waveControl.value.set(state.colorLayer??1,state.striations??.7,0,0);
 u.waveCause.value.set(wet*.58,Math.min(1,state.year/12),state.scene==='fracture'?demand.damage:(state.care==='abandoned'?Math.min(1,state.year/11):.05),demand.s*.110);
 u.ceramic.value.z=state.light==='rain'?1:0;
}
function waveUpdateAll(){for(const m of materialCache.values())waveUpdateMaterial(m);if(waveWoodMaterials)for(const m of waveWoodMaterials)m.userData.woodExposure.value=state.care==='abandoned'?1-Math.exp(-state.year*.17*state.rainInput):.08;perfRequest();}
let waveWoodMaterials=null,waveMossMat=null;
function waveWood(check=false){
 if(check)return getWoodMaterialsV0910(true);
 if(waveWoodMaterials)return waveWoodMaterials;
 waveWoodMaterials=[false,true].map(end=>{
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0,envMapIntensity:.40});m.userData.woodExposure={value:state.care==='abandoned'?1-Math.exp(-state.year*.17*state.rainInput):.08};
 m.onBeforeCompile=s=>{s.uniforms.woodExposure=m.userData.woodExposure;
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 woodP;').replace('#include <begin_vertex>','#include <begin_vertex>\nwoodP=position;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 woodP;uniform float woodExposure;\n'+waveNoiseGLSL)
 .replace('#include <color_fragment>',`#include <color_fragment>
vec4 fib=wn(vec3(woodP.xy*155.,woodP.z*4.));
float rings=sin(length(woodP.xy+vec2(.013,-.009))*1050.+fib.x*3.);
float fibres=pow(.5+.5*sin(woodP.x*1850.+woodP.y*1570.+fib.x*5.),12.);
float streak=mix(.88,1.12,fib.x)-fibres*.13;
diffuseColor.rgb*=streak${end?'+.08*rings':''};
${end?'':`vec4 weather=wn(vec3(woodP.xy*38.,woodP.z*7.)+13.);float groove=pow(.5+.5*sin(woodP.x*390.+woodP.y*470.+fib.x*3.),28.)*smoothstep(.32,.65,weather.x);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.115,.111,.098),woodExposure*(.32+.25*weather.x));diffuseColor.rgb*=1.-groove*woodExposure*.42;`} `);
 };m.customProgramCacheKey=()=>`tm0911-fibre-${end}`;PERSISTENT_MATERIALS.add(m);return m;
 });return waveWoodMaterials;
}
function waveMossMaterial(){
 if(waveMossMat)return waveMossMat;
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,envMapIntensity:.43,side:THREE.FrontSide});
 m.onBeforeCompile=s=>{
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mossP;').replace('#include <begin_vertex>','#include <begin_vertex>\nmossP=position;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 mossP;\n'+waveNoiseGLSL)
 .replace('#include <color_fragment>','#include <color_fragment>\nvec4 tuft=wn(mossP*3100.);diffuseColor.rgb*=.74+.50*tuft.x;')
 .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(dFdx(tuft.x),dFdy(tuft.x),0.)*.22);');
 };m.customProgramCacheKey=()=>`tm0911-moss`;PERSISTENT_MATERIALS.add(m);waveMossMat=m;return m;
}
