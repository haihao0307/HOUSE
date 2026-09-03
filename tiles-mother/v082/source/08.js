(() => {
'use strict';
const T = window.TilesReferenceRuntime;
const C = window.TilesStudyCore;
const P = window.TilesMotherV08Profile;
const Parts = window.TilesMotherV08Parts;
const G = Parts.geometry;
const R = Parts.roof;
const Studio = Parts.studio;
if (!T || !C || !P || !G || !R || !Studio) throw Error('Tiles Mother V0.8.2 runtime is incomplete');

const DEVICE = (() => {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const coarse = matchMedia?.('(pointer:coarse)')?.matches || false;
  const narrow = Math.min(screen.width || innerWidth, innerWidth || screen.width) <= 900;
  const forcedFull = /(?:#|[?&])full(?:=1)?\b/.test(location.href);
  const forcedLite = /(?:#|[?&])lite(?:=1)?\b/.test(location.href);
  const mobile = forcedLite || (!forcedFull && (ios || (coarse && narrow)));
  return { ios, coarse, narrow, mobile, forcedFull, forcedLite };
})();
const RUNTIME = {
  mobile: DEVICE.mobile,
  rendererPath: DEVICE.mobile ? 'mobile-lightweight-pbr' : 'desktop-full-pbr',
  roofBudget: DEVICE.mobile ? { nu:18, nv:26 } : { ...P.mesh.roof },
  singleBudget: DEVICE.mobile ? { nu:38, nv:54 } : { ...P.mesh.single },
  trioBudget: DEVICE.mobile ? { nu:28, nv:40 } : { ...P.mesh.trio },
  pixelRatio: DEVICE.mobile ? 1 : Math.min(devicePixelRatio || 1, P.studio.maxPixelRatio),
  shadows: !DEVICE.mobile,
  startupStarted: performance.now(),
  lastBuildMs: 0
};
window.TilesMotherV081Runtime = RUNTIME;
window.TilesMotherV082Runtime = RUNTIME;
Object.assign(RUNTIME,{requestedBuilds:0,completedBuilds:0,cancelledBuilds:0,frameCount:0,renderedAgeYears:null,contextLossCount:0,contextRestoreCount:0,shaderErrors:[],running:true,building:false});
const bootProgress = (title, detail, ratio) => window.__tilesBoot?.progress(title, detail, ratio);
bootProgress('正在准备 Tiles Mother V0.8.2', RUNTIME.mobile ? '手机端已启用轻量 PBR、低内存网格和分阶段首帧' : '桌面端启用完整 PBR 与高精度网格', .14);


const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hash32 = value => {
  let n = Number(value) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
};
const random01 = (seed, salt) => hash32((seed || 1) ^ salt) / 4294967296;
function deriveSeeds(master) {
  const keys = ['shape','warp','structure','damage','color','weather','micro'];
  const result = { master: master >>> 0 };
  keys.forEach((key,index) => result[key] = hash32(master ^ ((index+1)*0x9e3779b9)) || index+1);
  return result;
}
function childSeeds(base, variant) {
  const salt = hash32((variant + 1) * 2654435761);
  const result = {};
  for (const [index,key] of ['master','shape','warp','structure','damage','color','weather','micro'].entries()) {
    result[key] = hash32((base[key] || base.master || 1) ^ salt ^ (index * 7919 + 131)) || 1;
  }
  return result;
}

const defaultControls = {
  pan: { length: 32, width: 22, thickness: 1.15, curve: 4.6, taper: 12, warp: 29, damage: 17, pores: 46 },
  cover: { length: 30, width: 16, thickness: 1.05, curve: 6.7, taper: 9, warp: 27, damage: 16, pores: 42 }
};
const profiles = {
  pan: { controls: {...defaultControls.pan}, seeds: deriveSeeds(32017) },
  cover: { controls: {...defaultControls.cover}, seeds: deriveSeeds(2362213974) }
};
const materialSettings = { colorVariation: P.material.colorVariationDefault, microRelief: 92 };
const state = Studio.makeState({ view: 'roof', mode: 'aaa_beauty', focus: 'all', activeFamily: 'pan', variant: 0, physicalTime: 0, channel: 'final' });
state.playing = false;
state.autoRotate = false;
state.lastTick = performance.now();

let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas: $('viewport'), antialias: !RUNTIME.mobile, alpha: false, powerPreference: RUNTIME.mobile ? 'default' : 'high-performance', preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false });
} catch (error) { window.__tilesBoot?.fail(error); throw error; }
renderer.setPixelRatio(RUNTIME.pixelRatio);
renderer.shadowMap.enabled = RUNTIME.shadows;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = P.studio.exposure;
renderer.localClippingEnabled = true;
renderer.debug.checkShaderErrors=true;
renderer.debug.onShaderError=(gl,program,vs,fs)=>{
 const detail=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join(' | ');
 RUNTIME.shaderErrors.push(detail);window.__tilesBoot.fail(Error('PBR着色器未通过编译：'+detail));
};

const scene = new T.Scene();
scene.background = new T.Color(P.studio.background);
const camera = new T.PerspectiveCamera(36, 1, 0.004, 100);
const controls = new T.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 0.18;
controls.maxDistance = 8;
controls.target.set(0, 0, 0);
controls.autoRotate = false;
controls.autoRotateSpeed = 0.32;

const world = new T.Group();
scene.add(world);
const overlays = new T.Group();
scene.add(overlays);
const contextGroup = new T.Group();
scene.add(contextGroup);

const floorMat = new T.MeshStandardMaterial({ color: 0x282b28, roughness: 0.98, metalness: 0 });
const floor = new T.Mesh(new T.CircleGeometry(5.2, RUNTIME.mobile ? 48 : 128), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const lights = {
  hemi: new T.HemisphereLight(0xe8edf0, 0x443a31, 0.92),
  key: new T.DirectionalLight(0xffdfbd, 1.48),
  fill: new T.DirectionalLight(0xc9dcff, 0.58),
  rim: new T.DirectionalLight(0xf4f7ff, 0.72),
  top: new T.DirectionalLight(0xffffff, 0.32),
  ambient: new T.AmbientLight(0xffffff, 0.58)
};
lights.key.position.set(3.6, 5.2, 2.2);
lights.fill.position.set(-4.0, 2.1, 2.8);
lights.rim.position.set(-2.2, 4.2, -4.2);
lights.top.position.set(0.2, 5.4, 0.0);
for (const light of Object.values(lights)) scene.add(light);
lights.key.castShadow = RUNTIME.shadows;
lights.key.shadow.mapSize.set(RUNTIME.mobile ? 1024 : 2048, RUNTIME.mobile ? 1024 : 2048);
lights.key.shadow.camera.left = -2.6;
lights.key.shadow.camera.right = 2.6;
lights.key.shadow.camera.top = 2.6;
lights.key.shadow.camera.bottom = -2.6;
lights.key.shadow.camera.near = 0.1;
lights.key.shadow.camera.far = 14;
lights.key.shadow.bias = -0.00012;
lights.key.shadow.normalBias = 0.0003;
lights.key.shadow.radius = 3;

const shaderFunctions = `
 varying vec2 vTileUV;
 varying vec3 vTileLocal;
 varying float vTileCavity;
 varying float vTileFlake;
 varying float vTileRelief;
 varying float vTileFace;
 varying float vTileSection;
 uniform vec4 tileSeeds;
 uniform vec4 tileControls;
 uniform vec4 tileState;
 uniform vec4 tileDims;
 uniform vec3 tileTint;
 uniform vec4 tileAge;
 uniform vec4 tileWear;
 uniform vec4 tilePBR;
 uniform float tileMode;
 float tmHash(vec2 p,float s){return fract(sin(dot(p,vec2(127.1,311.7))+s)*43758.5453123);}
 float tmNoise(vec2 p,float s){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(tmHash(i,s),tmHash(i+vec2(1.,0.),s),f.x),mix(tmHash(i+vec2(0.,1.),s),tmHash(i+1.,s),f.x),f.y);}
 float tmFbm(vec2 p,float s){return .50*tmNoise(p,s)+.28*tmNoise(p*2.03,s+13.)+.14*tmNoise(p*4.09,s+37.)+.08*tmNoise(p*8.17,s+71.);}
 vec3 tmLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
 vec2 tmP(){return vec2(vTileLocal.x/max(tileDims.x,.001),vTileLocal.z/max(tileDims.y,.001))*2.;}
 float tmTop(){return step(.5,vTileFace);}
 float tmBack(){return (1.-step(.5,abs(vTileFace)))*step(-.5,vTileFace);}
 float tmEdge(){return 1.-step(-.5,vTileFace);}
 float tmMacro(){vec2 p=tmP();return tmFbm(p*1.55+vec2(2.7,-4.1),tileSeeds.x+19.);}
 float tmMeso(){vec2 p=tmP();return tmFbm(p*5.6+vec2(-7.3,3.4),tileSeeds.y+53.);}
 float tmGrain(){vec2 p=tmP()*64.;float aa=1.-smoothstep(.65,1.85,max(length(dFdx(p)),length(dFdy(p))));return .5+(tmNoise(p,tileSeeds.w+97.)-.5)*aa;}
 float tmScuff(){vec2 p=tmP();vec2 q=p*vec2(7.5,30.);q.x+=1.35*(tmFbm(p*5.,tileSeeds.z)-.5);float aa=1.-smoothstep(.7,1.8,max(length(dFdx(q)),length(dFdy(q))));return smoothstep(.66,.82,tmNoise(q,tileSeeds.z+83.))*smoothstep(.42,.65,tmFbm(p*7.,tileSeeds.z+107.))*aa;}
 float tmEdgeMask(){vec2 p=abs(tmP());return smoothstep(.72,1.03,max(p.x,p.y));}
 float tmShelter(){vec2 p=tmP();float lap=smoothstep(.22,.96,p.y);return clamp(lap*.72+vTileCavity*.45+tmBack()*.18,0.,1.);}
 float tmFlow(){vec2 p=tmP();float meander=(tmFbm(vec2(p.y*2.2,p.x*1.7),tileSeeds.y+601.)-.5)*.32;float streak=pow(.5+.5*sin((p.x+meander)*19.0+tileSeeds.z*.013),8.0);float carrier=smoothstep(.34,.72,tmFbm(p*3.2+vec2(5.,-8.),tileSeeds.x+647.));return streak*carrier*tmTop();}
 float tmWeatherMask(){return clamp(tileAge.y*tmShelter()*.50+tileAge.z*tmFlow()*.70+tileAge.w*(vTileCavity*.62+tmShelter()*.25)+tileWear.y*tmShelter()*.35,0.,1.);}
 float tmAO(){float cavity=vTileCavity*(.26+.16*tileAge.x);float settled=tileAge.y*tmShelter()*.055;return clamp(1.-cavity-settled,.56,1.);}
 vec3 tmAlbedoSrgb(){
   vec2 p=tmP();
   vec2 warp=.105*(vec2(tmFbm(p*2.8,tileSeeds.z+7.),tmFbm(p*2.8+31.,tileSeeds.z+11.))-.5);
   p+=warp;
   float macro=tmMacro(),meso=tmMeso(),grain=tmGrain();
   float islands=tmFbm(p*3.25+vec2(7.,-4.),tileSeeds.x+139.);
   float broken=tmFbm(p*15.5+vec2(-2.,9.),tileSeeds.y+181.);
   float warm=smoothstep(.45,.69,islands+(broken-.5)*.19+tileTint.y);
   float cool=smoothstep(.49,.72,tmFbm(p*3.0+vec2(-11.,5.),tileSeeds.x+239.)+(macro-.5)*.22+tileTint.z);
   float pale=smoothstep(.57,.80,tmFbm(p*7.4+vec2(5.,12.),tileSeeds.y+307.)+(broken-.5)*.13);
   float smoke=smoothstep(.69,.87,tmFbm(p*4.2+vec2(-4.,-13.),tileSeeds.z+367.)+(meso-.5)*.13);
   vec3 coolGray=vec3(.405,.435,.455);
   vec3 neutralAsh=vec3(.485,.455,.415);
   vec3 warmBrown=vec3(.625,.425,.285);
   vec3 paleFired=vec3(.690,.655,.600);
   vec3 smokeDark=vec3(.245,.270,.280);
   vec3 c=mix(neutralAsh,coolGray,clamp(.43+cool*.45-warm*.13,0.,.92));
   c=mix(c,warmBrown,warm*.60*tileControls.x);
   c=mix(c,paleFired,pale*.27*tileControls.x);
   c=mix(c,smokeDark,smoke*.18*tileControls.x);
   c+=vec3((macro-.5)*.115*tileControls.y+(meso-.5)*.086*tileControls.z+(grain-.5)*.058*tileControls.w);
   c+=tileTint.x*vec3(1.,.92,.84);
   c.r+=tileTint.y*.115;c.g+=tileTint.y*.038;c.b-=tileTint.y*.078;
   c.b+=tileTint.z*.095;c.g+=tileTint.z*.028;c.r-=tileTint.z*.058;
   c=mix(c,c*vec3(1.045,.95,.86),vTileFlake*.24);
   float ageFade=tileAge.x;
   c=mix(c,c*vec3(.95,.98,1.015),ageFade*.20);
   float dustMask=tileAge.y*tmShelter()*(.38+.62*tmFbm(p*8.2,tileSeeds.w+811.));
   float washMask=tileAge.z*tmFlow();
   float sootMask=tileWear.y*tmShelter()*smoothstep(.46,.76,tmFbm(p*5.0,tileSeeds.z+859.));
   float bioMask=tileAge.w*smoothstep(.54,.80,tmFbm(p*7.1+vec2(3.,-5.),tileSeeds.y+907.))*(.35+.65*vTileCavity);
   c=mix(c,vec3(.405,.395,.365),dustMask*.18);
   c=mix(c,coolGray,washMask*.16);
   c=mix(c,smokeDark,sootMask*.18);
   c=mix(c,vec3(.275,.300,.270),bioMask*.13);
   c-=tmScuff()*.034;
   c*=1.-vTileCavity*.055;
   c*=1.-tileWear.z*.17;
   c+=tmEdge()*((vTileSection-.5)*.018+tileWear.x*.018);
   if(tileMode>.5&&tileMode<1.5){float g=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(g),.26);}
   if(tileMode>1.5){c*=vec3(.97,.99,1.015);}
   return clamp(c,vec3(.15),vec3(.79));
 }
 float tmRough(){float r=tileState.z+tileState.y*.025+(tmMeso()-.5)*.12+(tmGrain()-.5)*.072+vTileFlake*.065+vTileCavity*.055+tileAge.y*.055+tileAge.w*.045+tileWear.x*.038-tileWear.z*.22-tileAge.z*tmFlow()*.025;return clamp(r,.54,.985);}
 float tmMicroHeight(){float h=(tmGrain()-.5)*.00020+(tmMeso()-.5)*.000090-tmScuff()*.000052-vTileCavity*.000115+vTileFlake*.000045;return h*tileState.w;}
`;

const CHANNEL_INDEX = Object.freeze({final:0,albedo:1,roughness:2,ao:3,normal:4,weather:5});
function makeFullMaterial(data) {
  const family = data.family || data.profile || data.tile?.profile || 'pan';
  const familyProfile = P.families[family];
  const seed = data.seeds || data.tile?.seeds || {};
  const variation = materialSettings.colorVariation / 100;
  const tint = new T.Vector3(
    (random01(seed.color, 0x7135) - 0.5) * 0.125 * variation,
    (random01(seed.color, 0x2997) - 0.5) * 0.42 * variation,
    (random01(seed.color, 0x8f31) - 0.5) * 0.34 * variation
  );
  const s = data.state || {};
  const uniforms = {
    tileSeeds: { value: new T.Vector4((seed.color||11)%8191, (seed.micro||17)%8191, (seed.shape||23)%8191, (seed.structure||31)%8191) },
    tileControls: { value: new T.Vector4(variation, P.material.macroStrength, P.material.mesoStrength, P.material.grainStrength) },
    tileState: { value: new T.Vector4(s.wetness || 0, s.damage || 0, clamp(familyProfile.roughness + (s.roughnessShift || 0), .54, .98), materialSettings.microRelief / 100) },
    tileDims: { value: new T.Vector4(data.tile?.dimensions.width || .22, data.tile?.dimensions.length || .32, data.tile?.dimensions.thickness || .011, data.tile?.dimensions.curve || .046) },
    tileTint: { value: tint },
    tileAge: { value: new T.Vector4(s.normalizedAge || 0, s.dust || 0, s.wash || 0, s.biofilm || 0) },
    tileWear: { value: new T.Vector4(s.edgeWear || 0, s.soot || 0, s.wetness || 0, family === 'cover' ? .90 : .82) },
    tilePBR: { value: new T.Vector4(P.material.metalness, P.material.dielectricF0, 1, CHANNEL_INDEX[state.channel] || 0) },
    tileMode: { value: state.mode === 'neutral_inspection' ? 1 : state.mode === 'raking_light' ? 2 : 0 }
  };
  const material = new T.MeshStandardMaterial({ color: 0xffffff, roughness: familyProfile.roughness, metalness: P.material.metalness, side: T.FrontSide });
  material.userData.uniforms = uniforms;
  material.userData.pbr = { workflow:P.material.pbrWorkflow, metalness:P.material.metalness, dielectricF0:P.material.dielectricF0, baseColorSpace:P.material.baseColorSpace, dataChannelsSpace:P.material.dataChannelsSpace };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 tileRestPosition;attribute float tileCavity;attribute float tileFlake;attribute float tileRelief;attribute float tileFace;attribute float tileSection;varying vec2 vTileUV;varying vec3 vTileLocal;varying float vTileCavity;varying float vTileFlake;varying float vTileRelief;varying float vTileFace;varying float vTileSection;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTileUV=uv;vTileLocal=tileRestPosition;vTileCavity=tileCavity;vTileFlake=tileFlake;vTileRelief=tileRelief;vTileFace=tileFace;vTileSection=tileSection;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + shaderFunctions)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=tmLinear(tmAlbedoSrgb());')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=tmRough();')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=tmAO();')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nfloat bh=tmMicroHeight();vec3 qx=dFdx(-vViewPosition),qy=dFdy(-vViewPosition),rx=cross(qy,normal),ry=cross(normal,qx);float det=dot(qx,rx);if(abs(det)>1.e-14)normal=normalize(abs(det)*normal-sign(det)*(dFdx(bh)*rx+dFdy(bh)*ry));`)
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\nfloat ch=tilePBR.w;if(ch>.5&&ch<1.5)outgoingLight=diffuseColor.rgb;else if(ch>1.5&&ch<2.5)outgoingLight=vec3(tmRough());else if(ch>2.5&&ch<3.5)outgoingLight=vec3(tmAO());else if(ch>3.5&&ch<4.5)outgoingLight=normal*.5+.5;else if(ch>4.5)outgoingLight=vec3(tmWeatherMask(),tileAge.z*tmFlow(),tileAge.w*(.35+.65*vTileCavity));`);
  };
  material.customProgramCacheKey = () => 'tiles-mother-yunnan-pbr-v08';
  return material;
}

const mix1 = (a,b,t) => a + (b-a)*t;
const smooth1 = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const mix3 = (a,b,t) => [mix1(a[0],b[0],t),mix1(a[1],b[1],t),mix1(a[2],b[2],t)];
const srgbLinear = value => value <= .04045 ? value/12.92 : Math.pow((value+.055)/1.055,2.4);
function bakeMobilePBR(data) {
  const count = data.uv.length / 2;
  const colors = new Float32Array(count*3);
  const roughness = new Float32Array(count);
  const ao = new Float32Array(count);
  const weather = new Float32Array(count*3);
  const seed = data.seeds || data.tile?.seeds || {};
  const s = data.state || {};
  const family = data.family || data.profile || data.tile?.profile || 'pan';
  const familyProfile = P.families[family];
  const variation = materialSettings.colorVariation / 100;
  const tint = [
    (random01(seed.color,0x7135)-.5)*.125*variation,
    (random01(seed.color,0x2997)-.5)*.42*variation,
    (random01(seed.color,0x8f31)-.5)*.34*variation
  ];
  const coolGray=[.405,.435,.455], neutralAsh=[.485,.455,.415], warmBrown=[.625,.425,.285], paleFired=[.690,.655,.600], smokeDark=[.245,.270,.280];
  for(let i=0;i<count;i++){
    const rest=data.materialPositions||data.positions;
    const u=rest[i*3]/Math.max(data.tile.dimensions.width,.001)*2, v=rest[i*3+2]/Math.max(data.tile.dimensions.length,.001)*2;
    const cavity=data.cavities[i]||0, flake=data.flakes[i]||0, face=data.face[i]||0, section=data.section[i]||0;
    const top=face>.5, back=face>-.5&&face<.5, edge=face<-.5;
    const macro=C.fbm(u*1.55+2.7,v*1.55-4.1,(seed.color||11)+19);
    const meso=C.fbm(u*5.6-7.3,v*5.6+3.4,(seed.micro||17)+53);
    const islands=C.fbm(u*3.25+7,v*3.25-4,(seed.color||11)+139);
    const broken=C.fbm(u*15.5-2,v*15.5+9,(seed.micro||17)+181);
    const warm=smooth1(.45,.69,islands+(broken-.5)*.19+tint[1]);
    const cool=smooth1(.49,.72,C.fbm(u*3-11,v*3+5,(seed.color||11)+239)+(macro-.5)*.22+tint[2]);
    const pale=smooth1(.57,.80,C.fbm(u*7.4+5,v*7.4+12,(seed.micro||17)+307)+(broken-.5)*.13);
    const smoke=smooth1(.69,.87,C.fbm(u*4.2-4,v*4.2-13,(seed.shape||23)+367)+(meso-.5)*.13);
    let c=mix3(neutralAsh,coolGray,clamp(.43+cool*.45-warm*.13,0,.92));
    c=mix3(c,warmBrown,warm*.60*variation);
    c=mix3(c,paleFired,pale*.27*variation);
    c=mix3(c,smokeDark,smoke*.18*variation);
    const grain=C.noise(u*52,v*52,(seed.structure||31)+97)-.5;
    const delta=(macro-.5)*.115+(meso-.5)*.086+grain*.050;
    c=[c[0]+delta+tint[0],c[1]+delta+tint[0]*.92,c[2]+delta+tint[0]*.84];
    c[0]+=tint[1]*.115-tint[2]*.058;c[1]+=tint[1]*.038+tint[2]*.028;c[2]-=tint[1]*.078;c[2]+=tint[2]*.095;
    c=mix3(c,[c[0]*1.045,c[1]*.95,c[2]*.86],flake*.24);
    const shelter=clamp(smooth1(.22,.96,v)*.72+cavity*.45+(back?.18:0),0,1);
    const meander=(C.fbm(v*2.2,u*1.7,(seed.micro||17)+601)-.5)*.32;
    const streak=Math.pow(.5+.5*Math.sin((u+meander)*19+(seed.shape||23)*.013),8);
    const flow=streak*smooth1(.34,.72,C.fbm(u*3.2+5,v*3.2-8,(seed.color||11)+647))*(top?1:0);
    const dust=(s.dust||0)*shelter*(.38+.62*C.fbm(u*8.2,v*8.2,(seed.structure||31)+811));
    const wash=(s.wash||0)*flow;
    const soot=(s.soot||0)*shelter*smooth1(.46,.76,C.fbm(u*5,v*5,(seed.shape||23)+859));
    const bio=(s.biofilm||0)*smooth1(.54,.80,C.fbm(u*7.1+3,v*7.1-5,(seed.micro||17)+907))*(.35+.65*cavity);
    c=mix3(c,[.405,.395,.365],dust*.18);
    c=mix3(c,coolGray,wash*.16);
    c=mix3(c,smokeDark,soot*.18);
    c=mix3(c,[.275,.300,.270],bio*.13);
    const wear=(s.edgeWear||0);
    c=[c[0]*(1-cavity*.055-wear*(edge?.12:.03)),c[1]*(1-cavity*.055-wear*(edge?.12:.03)),c[2]*(1-cavity*.055-wear*(edge?.12:.03))];
    c=c.map(value=>clamp(value*.84,.13,.72));
    colors[i*3]=srgbLinear(c[0]);colors[i*3+1]=srgbLinear(c[1]);colors[i*3+2]=srgbLinear(c[2]);
    roughness[i]=clamp(familyProfile.roughness+(meso-.5)*.11+grain*.06+flake*.055+cavity*.055+(s.dust||0)*.055+(s.biofilm||0)*.045+wear*.038-(s.wetness||0)*.22-wash*.025,.56,.985);
    ao[i]=clamp(1-cavity*(.26+.16*(s.normalizedAge||0))-(s.dust||0)*shelter*.055,.58,1);
    weather[i*3]=clamp((s.dust||0)*shelter*.5+(s.wash||0)*flow*.7+(s.biofilm||0)*(cavity*.62+shelter*.25),0,1);
    weather[i*3+1]=wash;weather[i*3+2]=bio;
  }
  return {colors,roughness,ao,weather};
}

function makeMobileMaterial(data) {
  const family=data.family||data.profile||data.tile?.profile||'pan';
  const familyProfile=P.families[family];
  const uniforms={
    tilePBR:{value:new T.Vector4(P.material.metalness,P.material.dielectricF0,1,CHANNEL_INDEX[state.channel]||0)},
    tileMode:{value:state.mode==='neutral_inspection'?1:state.mode==='raking_light'?2:0},
    mobileReliefStrength:{value:materialSettings.microRelief/100}
  };
  const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:familyProfile.roughness,metalness:0,side:T.FrontSide});
  material.userData.uniforms=uniforms;
  material.userData.pbr={workflow:P.material.pbrWorkflow,metalness:0,dielectricF0:P.material.dielectricF0,baseColorSpace:P.material.baseColorSpace,dataChannelsSpace:P.material.dataChannelsSpace,mobileBakedChannels:true};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float tileRoughness;attribute float tileAO;attribute vec3 tileWeather;attribute float tileRelief;varying float vMobileRoughness;varying float vMobileAO;varying vec3 vMobileWeather;varying float vMobileRelief;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvMobileRoughness=tileRoughness;vMobileAO=tileAO;vMobileWeather=tileWeather;vMobileRelief=tileRelief;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform vec4 tilePBR;uniform float mobileReliefStrength;varying float vMobileRoughness;varying float vMobileAO;varying vec3 vMobileWeather;varying float vMobileRelief;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vMobileRoughness;')
      .replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=vMobileAO;')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nfloat bh=vMobileRelief*mobileReliefStrength*.52;vec3 qx=dFdx(-vViewPosition),qy=dFdy(-vViewPosition),rx=cross(qy,normal),ry=cross(normal,qx);float det=dot(qx,rx);if(abs(det)>1.e-14)normal=normalize(abs(det)*normal-sign(det)*(dFdx(bh)*rx+dFdy(bh)*ry));')
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;','vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\nfloat ch=tilePBR.w;if(ch>.5&&ch<1.5)outgoingLight=diffuseColor.rgb;else if(ch>1.5&&ch<2.5)outgoingLight=vec3(vMobileRoughness);else if(ch>2.5&&ch<3.5)outgoingLight=vec3(vMobileAO);else if(ch>3.5&&ch<4.5)outgoingLight=normal*.5+.5;else if(ch>4.5)outgoingLight=vMobileWeather;');
  };
  material.customProgramCacheKey=()=> 'tiles-mother-mobile-pbr-v081';
  return material;
}
function makeMaterial(data){return RUNTIME.mobile?makeMobileMaterial(data):makeFullMaterial(data);}

function makeThreeMesh(data) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('tileRestPosition', new T.BufferAttribute(data.materialPositions || data.positions,3));
  geo.setAttribute('position', new T.BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new T.BufferAttribute(data.normals, 3));
  geo.setAttribute('uv', new T.BufferAttribute(data.uv, 2));
  geo.setAttribute('tileCavity', new T.BufferAttribute(data.cavities, 1));
  geo.setAttribute('tileFlake', new T.BufferAttribute(data.flakes, 1));
  geo.setAttribute('tileRelief', new T.BufferAttribute(data.relief, 1));
  geo.setAttribute('tileFace', new T.BufferAttribute(data.face, 1));
  geo.setAttribute('tileSection', new T.BufferAttribute(data.section, 1));
  if (RUNTIME.mobile) {
    const baked=bakeMobilePBR(data);
    geo.setAttribute('color',new T.BufferAttribute(baked.colors,3));
    geo.setAttribute('tileRoughness',new T.BufferAttribute(baked.roughness,1));
    geo.setAttribute('tileAO',new T.BufferAttribute(baked.ao,1));
    geo.setAttribute('tileWeather',new T.BufferAttribute(baked.weather,3));
  }
  geo.setIndex(new T.BufferAttribute(data.indices, 1));
  geo.computeBoundingSphere();
  const mesh = new T.Mesh(geo, makeMaterial(data));
  mesh.castShadow = RUNTIME.shadows;
  mesh.receiveShadow = RUNTIME.shadows;
  mesh.userData.source = data;
  return mesh;
}

function disposeObject(child) {
  child.geometry?.dispose?.();
  if (Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
  else child.material?.dispose?.();
}
function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];group.remove(child);
    if(child.traverse)child.traverse(disposeObject);else disposeObject(child);
  }
}

let current = null;
function singleData(family, variant, budget = RUNTIME.singleBudget, ageYears=state.physicalTime, sourceProfiles=profiles) {
  const profile = sourceProfiles[family];
  const bank = childSeeds(profile.seeds, variant);
  const id = `jiangwutang/single/${family}/${variant}`;
  const tile = G.tile(family, id, bank.master, profile.controls, bank);
  const evolved = window.TilesMotherHistoricWeathering.evolve(tile, ageYears, family === 'cover' ? 0.90 : 0.82);
  const mesh = G.mesh(tile, { ...budget, damage: evolved.damage });
  return { ...mesh, family, profile: family, seeds: bank, state: evolved, meta: { entityId: id } };
}

function addEdgeHelper(source) {
  const groups = source.edgeGroups || [];
  const selected = groups.filter(group => state.focus === 'side-edge' ? ['eave','right'].includes(group.name) : group.name === 'eave');
  for (const group of selected) {
    const positions = [];
    const stride = group.depthSegments + 1;
    for (let k = 0; k <= group.segments; k += 1) {
      const a = group.vertexStart + k * stride;
      const b = group.vertexStart + k * stride + group.depthSegments;
      positions.push(...source.positions.slice(a*3,a*3+3), ...source.positions.slice(b*3,b*3+3));
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(positions),3));
    overlays.add(new T.LineSegments(geometry,new T.LineBasicMaterial({color:0xe5c889,transparent:true,opacity:.94})));
  }
}

function addContactOverlays(result) {
  const wantsContacts = state.mode === 'contact_diagnostic' || state.focus === 'pan-overlap' || state.focus === 'cover-seat';
  if (!wantsContacts) return;
  let contacts = result.diagnostics.contacts;
  if (state.focus === 'pan-overlap') contacts = contacts.filter(contact => contact.kind === 'pan-longitudinal-lap');
  if (state.focus === 'cover-seat') contacts = contacts.filter(contact => contact.kind.startsWith('cover-seat'));
  for (const contact of contacts) {
    const positions = new Float32Array(contact.line.flat());
    if (!positions.length) continue;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
    const color = contact.status === 'penetration' ? 0xff5347 : contact.kind === 'pan-lateral-clearance' ? 0x70c8ff : contact.status === 'supported' ? 0x67e3a7 : 0xf3bd62;
    overlays.add(new T.LineSegments(geometry, new T.LineBasicMaterial({ color, transparent: true, opacity: state.focus === 'all' ? 0.42 : 0.88 })));
  }
}

function addDrainageOverlays(result) {
  if (state.mode !== 'drainage_diagnostic' && state.focus !== 'drainage') return;
  for (const path of result.diagnostics.drainage.paths) {
    const points = path.points.map(point => new T.Vector3(...point));
    const geometry = new T.BufferGeometry().setFromPoints(points);
    overlays.add(new T.Line(geometry, new T.LineBasicMaterial({ color: path.continuous ? 0x55d7ff : 0xff5b5b, transparent: true, opacity: 0.98 })));
    for (let i = 0; i < points.length; i += 6) {
      const dot = new T.Mesh(new T.SphereGeometry(0.0056, 10, 8), new T.MeshBasicMaterial({ color: 0xa3ecff }));
      dot.position.copy(points[i]);
      overlays.add(dot);
    }
  }
}

function applyFocusVisibility() {
  for (const mesh of world.children) {
    const source = mesh.userData.source;
    if (!source) continue;
    mesh.visible = true;
    if (state.view !== 'roof') continue;
    if (state.focus === 'pan-overlap') mesh.visible = source.family === 'pan' && source.col === 1;
    if (state.focus === 'cover-seat') mesh.visible = (source.family === 'cover' && source.seam === 1 && source.row === 1) || (source.family === 'pan' && source.row === 1 && [0,1].includes(source.col));
  }
}


let buildTicket=0, debounceTimer=0;
const yieldFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
function cancelBuild(){buildTicket++;clearTimeout(debounceTimer);}
async function buildScene({preserveCamera=false}={}){
  const ticket=++buildTicket;RUNTIME.requestedBuilds++;RUNTIME.building=true;
  const start=performance.now(), request={view:state.view,focus:state.focus,family:state.activeFamily,variant:state.variant,age:state.physicalTime,profiles:JSON.parse(JSON.stringify(profiles))};
  const cancelled=()=>ticket!==buildTicket;
  const check=()=>{if(cancelled()){const e=Error('Superseded build');e.name='AbortError';throw e;}};
  const staged=new T.Group();
  const report=(title,detail,ratio)=>{if(!cancelled())bootProgress(title,detail,ratio);};
  try{
    report('分阶段生成瓦片','保留当前视图，正在准备新的瓦片状态',.08);await yieldFrame();check();
    let result;
    if(request.view==='roof'){
      result=await R.buildRoofAsync({profiles:request.profiles,childSeeds,variant:request.variant,physicalTime:request.age,history:C.historyDefaults},{
        yieldControl:yieldFrame,cancelled,progress:step=>{
          const count=step.phase==='orientation'?step.done:step.family==='pan'?step.done:12+step.done;
          report(step.phase==='orientation'?'逐瓦核查外表面':'按铺瓦次序生成',`${step.phase==='orientation'?'方向检查':'瓦件生成'} ${count}/28`,step.phase==='orientation'?.55+count/28*.15:.10+count/28*.43);
        }});
    }else{
      const meshes=[];const count=request.view==='trio'?3:1;
      for(let i=0;i<count;i++){
        check();let source=singleData(request.family,count===3?i:request.variant,count===3?RUNTIME.trioBudget:RUNTIME.singleBudget,request.age,request.profiles);
        if(count===3){
          const placed=G.transform(source,{x:(i-1)*(request.family==='pan'?.31:.25),y:0,z:0},{entityId:source.meta.entityId});
          source={...placed,family:source.family,profile:source.profile,seeds:source.seeds,state:source.state,tile:source.tile};
        }
        meshes.push(source);await yieldFrame();
      }
      result={meshes,diagnostics:{tileCount:count,relationCount:0,support:null,drainage:null,meshes:meshes.map(m=>({geometry:G.quickDiagnostics(m),edgeProfile:G.edgeProfile(m)}))}};
    }
    check();
    for(let i=0;i<result.meshes.length;i++){
      check();staged.add(makeThreeMesh(result.meshes[i]));
      report('正在准备PBR通道',`材质 ${i+1}/${result.meshes.length}`, .72+(i+1)/result.meshes.length*.20);
      await yieldFrame();
    }
    check();
    // Compile against an equivalent lit scene without replacing the current visible scene.
    const compileScene=new T.Scene();for(const light of Object.values(lights))compileScene.add(light.clone());compileScene.add(staged);
    if(renderer.compileAsync)await renderer.compileAsync(compileScene,camera);
    else{await yieldFrame();renderer.compile(compileScene,camera);}
    check();
    if(RUNTIME.shaderErrors.length||renderer.getContext().isContextLost())throw Error('图形上下文不可用，保留旧视图');
    clearGroup(world);clearGroup(overlays);clearGroup(contextGroup);
    current=result;
    for(const mesh of [...staged.children])world.add(mesh);
    applyFocusVisibility();applyMode();settleFloor();addModeOverlays();
    if(!preserveCamera)fitView();
    updateDiagnostics(result.diagnostics);RUNTIME.lastBuildMs=performance.now()-start;
    RUNTIME.renderedAgeYears=request.age;state.lastWeatherRebuildAge=request.age;RUNTIME.completedBuilds++;
    updateUI();resize();renderer.render(scene,camera);
    if(renderer.info.render.triangles===0)throw Error('首帧没有绘制任何瓦片三角形');
    RUNTIME.frameCount++;RUNTIME.startupMs??=performance.now()-RUNTIME.startupStarted;
    window.__tilesBoot.ready({detail:`三维已运行 · ${result.meshes.length}块瓦 · ${Math.round(request.age)}年`});
    return result.diagnostics;
  }catch(error){
    clearGroup(staged);
    if(error.name==='AbortError'){RUNTIME.cancelledBuilds++;return null;}
    if(!cancelled()){RUNTIME.running=false;window.__tilesBoot.fail(error);}
    return null;
  }finally{if(!cancelled())RUNTIME.building=false;}
}
function scheduleBuild(options={preserveCamera:true},delay=RUNTIME.mobile?180:80){
  cancelBuild();RUNTIME.building=false;
  debounceTimer=setTimeout(()=>buildScene(options),delay);
}
function settleFloor() {
  const box = new T.Box3().setFromObject(contextGroup.children.length ? contextGroup : world);
  if (!box.isEmpty()) floor.position.y = box.min.y - 0.045;
  floor.visible = state.view !== 'roof';
}

function updateMaterials(){
  for(const mesh of world.children){
    const u=mesh.material?.userData?.uniforms;if(!u)continue;
    u.tilePBR.value.w=CHANNEL_INDEX[state.channel]||0;
    u.tileMode.value=state.mode==='neutral_inspection'?1:state.mode==='raking_light'?2:0;
  }
}
function applyMode() {
  const mode = state.mode;
  $('app').dataset.mode = mode;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = Studio.modeInfo(state).exposure;
  if (mode === 'neutral_inspection') {
    scene.background.set(P.studio.neutralBackground);
    lights.hemi.intensity=.92;lights.key.intensity=1.38;lights.fill.intensity=.68;lights.rim.intensity=.35;lights.top.intensity=.42;lights.ambient.intensity=.52;
    lights.key.position.set(3.2,4.7,-2.0);lights.key.color.set(0xffffff);lights.fill.color.set(0xffffff);lights.rim.color.set(0xffffff);lights.top.color.set(0xffffff);
    floorMat.color.set(0xbec1bb);
  } else if (mode === 'raking_light') {
    scene.background.set(P.studio.rakingBackground);
    lights.hemi.intensity=.62;lights.key.intensity=3.75;lights.fill.intensity=.52;lights.rim.intensity=.78;lights.top.intensity=.25;lights.ambient.intensity=.34;
    lights.key.position.set(4.8,.82,-2.4);lights.key.color.set(0xffd0a1);lights.fill.color.set(0x91b9ff);lights.rim.color.set(0xe6efff);
    floorMat.color.set(0x171b19);
  } else {
    scene.background.set(P.studio.background);
    lights.hemi.intensity=.92;lights.key.intensity=1.48;lights.fill.intensity=.58;lights.rim.intensity=.72;lights.top.intensity=.32;lights.ambient.intensity=.58;
    lights.key.position.set(3.6,5.2,2.2);lights.key.color.set(0xffdfbd);lights.fill.color.set(0xc9dcff);lights.rim.color.set(0xf4f7ff);lights.top.color.set(0xffffff);
    floorMat.color.set(0x282b28);
  }
  if(RUNTIME.mobile){lights.hemi.intensity*=.72;lights.key.intensity*=.88;lights.fill.intensity*=.52;lights.rim.intensity*=.72;lights.top.intensity*=.78;lights.ambient.intensity*=.48;}
  for (const mesh of world.children) {
    const uniforms = mesh.material?.userData?.uniforms;
    if (uniforms) uniforms.tileMode.value = mode === 'neutral_inspection' ? 1 : mode === 'raking_light' ? 2 : 0;
  }
}


function visibleBounds(){const b=new T.Box3();for(const obj of world.children)if(obj.visible!==false)b.expandByObject(obj);return b;}
function frameBounds(direction,detail=false){
  const box=visibleBounds();if(box.isEmpty())return;
  const center=box.getCenter(new T.Vector3()),dir=direction.clone().normalize();
  const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),dir).normalize();
  const up=new T.Vector3().crossVectors(dir,right).normalize();
  const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect;
  let distance=.18;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const q=new T.Vector3(x,y,z).sub(center),depth=q.dot(dir);
    distance=Math.max(distance,depth+Math.abs(q.dot(right))/(tanH*.86),depth+Math.abs(q.dot(up))/(tanV*.78));
  }
  if(detail)distance*=.72;
  controls.target.copy(center);camera.position.copy(center).addScaledVector(dir,distance);
  camera.near=.002;camera.far=Math.max(30,distance*6);camera.updateProjectionMatrix();controls.update();
}
function fitView(){
  let dir;
  if(state.focus==='side-edge')dir=new T.Vector3(1.25,.24,-.15);
  else if(state.focus==='cross-section')dir=new T.Vector3(.12,.16,-1);
  else if(state.focus==='pan-overlap')dir=new T.Vector3(1,.42,-1.45);
  else if(state.focus==='cover-seat')dir=new T.Vector3(1.35,.4,-1.05);
  else if(state.focus==='surface-micro')dir=new T.Vector3(.8,.52,-1.05);
  else dir=new T.Vector3(1.18,.86,-1.55);
  frameBounds(dir,state.focus==='surface-micro');
}
function updateDiagnostics(d) {
  const meshDiags=d.meshes||[];
  const tangent=meshDiags.length?Math.max(...meshDiags.map(value=>value.geometry?.maxNormalTangentDot??0)):0;
  const thickness=meshDiags.length?Math.min(...meshDiags.map(value=>value.edgeProfile?.thicknessMin??99)):null;
  const support=d.support;
  const drainage=d.drainage;
  $('diagTiles').textContent=String(d.tileCount??current?.meshes?.length??0);
  $('diagRelations').textContent=String(d.relationCount??0);
  $('diagPenetration').textContent=support?String(support.penetrations):'0';
  $('diagDrain').textContent=drainage?`${drainage.continuousCount}/${drainage.total}`:'单瓦';
  $('diagClearance').textContent=support?`${(support.minimumPanLateralClearance*1000).toFixed(1)} mm`:'单瓦';
  $('diagCourse').textContent=d.courseStack?`${(d.courseStack.visibleCourseRise*1000).toFixed(1)} mm`:'单瓦';
  $('diagThickness').textContent=thickness===null?'待生成':`${(thickness*1000).toFixed(2)} mm`;
  $('diagTangent').textContent=tangent.toExponential(1);
  const deferredWinding=meshDiags.some(value=>value.geometry?.deferred);
  const flipped=meshDiags.reduce((sum,value)=>sum+(value.geometry?.flippedWindingTriangles||0),0);
  $('diagWinding').textContent=deferredWinding?'待复核':String(flipped);
  $('diagAge').textContent=Math.round(state.physicalTime)+' 年';
  const source=current?.meshes?.[0];
  const metrics=source?.metrics;
  $('metricText').textContent=metrics?`外表面已校正 · 峰谷 ${(metrics.topPeakToValley*1000).toFixed(2)} mm · 最小实体厚度 ${(metrics.minThickness*1000).toFixed(2)} mm · ${Math.round(state.physicalTime)} 年`:'筒瓦盖缝、PBR 通道与百年风化正在运行';
}

function updateUI() {
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===state.view));
  document.querySelectorAll('[data-mode]').forEach(button=>button.classList.toggle('active',button.dataset.mode===state.mode));
  document.querySelectorAll('[data-family]').forEach(button=>button.classList.toggle('active',button.dataset.family===state.activeFamily));
  document.querySelectorAll('[data-focus]').forEach(button=>button.classList.toggle('active',button.dataset.focus===state.focus));
  document.querySelectorAll('[data-channel]').forEach(button=>button.classList.toggle('active',button.dataset.channel===state.channel));
  $('variantValue').textContent=String(state.variant+1);
  $('timeValue').textContent=Math.round(state.physicalTime)+' 年';
  $('play').textContent=state.playing?'暂停演化':'播放百年演化';
  $('rotate').textContent=state.autoRotate?'停止旋转':'自动旋转';
  $('ageStatus').textContent=`当前三维 ${RUNTIME.renderedAgeYears===null?'待生成':Math.round(RUNTIME.renderedAgeYears)+'年'} / 目标 ${Math.round(state.physicalTime)}年`;
  $('status').textContent=`Tiles Mother V0.8.2 · ${Studio.MODES[state.mode].label} · ${state.view==='roof'?'12 板瓦与 16 筒瓦':state.view==='trio'?'三件变体':'单瓦特写'} · ${state.channel} · ${RUNTIME.mobile?'手机轻量PBR':'完整PBR'}`;
}

function syncSliders(){
  const c=profiles[state.activeFamily].controls;
  $('variant').value=state.variant;$('warp').value=c.warp;$('pores').value=c.pores;$('damage').value=c.damage;$('thickness').value=c.thickness;$('curve').value=c.curve;$('time').value=state.physicalTime;$('colorVariation').value=materialSettings.colorVariation;$('microRelief').value=materialSettings.microRelief;
  $('warpOut').textContent=c.warp;$('poresOut').textContent=c.pores;$('damageOut').textContent=c.damage;$('thicknessOut').textContent=c.thickness.toFixed(2);$('curveOut').textContent=c.curve.toFixed(1);$('colorOut').textContent=materialSettings.colorVariation;$('microOut').textContent=materialSettings.microRelief;
}

function bindControls() {
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{state.view=button.dataset.view;state.focus='all';buildScene();});
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{state.mode=button.dataset.mode;applyMode();updateMaterials();addModeOverlays();updateUI();});
  document.querySelectorAll('[data-family]').forEach(button=>button.onclick=()=>{state.activeFamily=button.dataset.family;if(state.view==='roof')state.view='single';state.focus='all';syncSliders();buildScene();});
  document.querySelectorAll('[data-channel]').forEach(button=>button.onclick=()=>{state.channel=button.dataset.channel;for(const mesh of world.children){const u=mesh.material?.userData?.uniforms;if(u)u.tilePBR.value.w=CHANNEL_INDEX[state.channel]||0;}updateUI();});
  document.querySelectorAll('[data-focus]').forEach(button=>button.onclick=()=>{
    state.focus=button.dataset.focus;
    if(['side-edge','cross-section','surface-micro'].includes(state.focus))state.view='single';
    if(['pan-overlap','cover-seat','drainage'].includes(state.focus))state.view='roof';
    buildScene();
  });
  $('variant').oninput=event=>{state.variant=Number(event.target.value);$('variantValue').textContent=String(state.variant+1);scheduleBuild({preserveCamera:true});};
  $('warp').oninput=event=>{profiles[state.activeFamily].controls.warp=Number(event.target.value);$('warpOut').textContent=event.target.value;scheduleBuild({preserveCamera:true});};
  $('pores').oninput=event=>{profiles[state.activeFamily].controls.pores=Number(event.target.value);$('poresOut').textContent=event.target.value;scheduleBuild({preserveCamera:true});};
  $('damage').oninput=event=>{profiles[state.activeFamily].controls.damage=Number(event.target.value);$('damageOut').textContent=event.target.value;scheduleBuild({preserveCamera:true});};
  $('thickness').oninput=event=>{profiles[state.activeFamily].controls.thickness=Number(event.target.value);$('thicknessOut').textContent=Number(event.target.value).toFixed(2);scheduleBuild({preserveCamera:true});};
  $('curve').oninput=event=>{profiles[state.activeFamily].controls.curve=Number(event.target.value);$('curveOut').textContent=Number(event.target.value).toFixed(1);scheduleBuild({preserveCamera:true});};
  $('colorVariation').oninput=event=>{materialSettings.colorVariation=Number(event.target.value);$('colorOut').textContent=event.target.value;scheduleBuild({preserveCamera:true});};
  $('microRelief').oninput=event=>{materialSettings.microRelief=Number(event.target.value);$('microOut').textContent=event.target.value;scheduleBuild({preserveCamera:true});};
  $('time').oninput=event=>{state.playing=false;state.physicalTime=Number(event.target.value);$('timeValue').textContent=Math.round(state.physicalTime)+' 年';$('diagAge').textContent=Math.round(state.physicalTime)+' 年';scheduleBuild({preserveCamera:true},RUNTIME.mobile?260:100);};
  $('play').onclick=()=>{state.playing=!state.playing;RUNTIME.running=true;if(!state.playing)scheduleBuild({preserveCamera:true},0);updateUI();};
  $('rotate').onclick=()=>{RUNTIME.running=true;state.autoRotate=!state.autoRotate;controls.autoRotate=state.autoRotate&&state.focus==='all';updateUI();};
  $('reset').onclick=()=>{state.playing=false;Object.assign(profiles.pan.controls,defaultControls.pan);Object.assign(profiles.cover.controls,defaultControls.cover);materialSettings.colorVariation=P.material.colorVariationDefault;materialSettings.microRelief=92;state.variant=0;state.physicalTime=0;state.focus='all';state.view='roof';syncSliders();buildScene();};
  $('resume').onclick=()=>{RUNTIME.running=true;state.lastTick=performance.now();if(renderer.getContext().isContextLost())retry();else{$('runStatus').textContent='三维运行已恢复';window.__tilesBoot.ready();}};
  $('cameraTop').onclick=()=>setCamera('top');
  $('cameraSide').onclick=()=>setCamera('side');
  $('cameraFront').onclick=()=>setCamera('front');
  $('snapshot').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='Tiles-Mother-V081-Yunnan.png';a.click();};
  $('mobileParams').onclick=()=>{$('app').classList.toggle('show-left');$('app').classList.remove('show-right');};
  $('mobileInspect').onclick=()=>{$('app').classList.toggle('show-right');$('app').classList.remove('show-left');};
  window.addEventListener('resize',()=>{resize();if(current)fitView();});
  window.visualViewport?.addEventListener('resize',resize);
}

function addModeOverlays(){
  clearGroup(overlays);
  if(state.view==='roof'&&current?.diagnostics){addContactOverlays(current);addDrainageOverlays(current);}
  if(state.view==='single'&&['side-edge','cross-section'].includes(state.focus)&&current?.meshes?.[0])addEdgeHelper(current.meshes[0]);
}

function setCamera(kind){
 const dirs={top:new T.Vector3(0,1,.001),side:new T.Vector3(1,.1,0),front:new T.Vector3(0,.20,-1)};
 frameBounds(dirs[kind]);
}
function resize(){const host=$('stage');const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}

let lastRender=0,fpsStarted=0,fpsFrames=0;
function animate(now){
  requestAnimationFrame(animate);
  const rawDt=Math.max(0,(now-state.lastTick)/1000);state.lastTick=now;
  if(document.hidden||!RUNTIME.running||renderer.getContext().isContextLost())return;
  if(state.playing){
    state.physicalTime=Math.min(P.weathering.maxAgeYears,state.physicalTime+Math.min(rawDt,.15));
    $('time').value=state.physicalTime;
    if(!RUNTIME.building&&Math.abs(state.physicalTime-(RUNTIME.renderedAgeYears||0))>=2)buildScene({preserveCamera:true});
    if(state.physicalTime>=P.weathering.maxAgeYears){state.playing=false;scheduleBuild({preserveCamera:true},0);}
    if(now-(state.lastUiTick||0)>200){state.lastUiTick=now;updateUI();}
  }
  if(RUNTIME.mobile&&now-lastRender<30)return;
  lastRender=now;controls.autoRotate=state.autoRotate&&state.focus==='all';controls.update();
  if(!RUNTIME.dirty&&!state.autoRotate&&!state.playing){if(!RUNTIME.building)$('fps').textContent='按需渲染';return;}
  RUNTIME.dirty=false;
  try{renderer.render(scene,camera);RUNTIME.frameCount++;fpsFrames++;
    if(now-fpsStarted>=1000){RUNTIME.fps=fpsFrames*1000/(now-fpsStarted);$('fps').textContent=RUNTIME.fps.toFixed(0)+' FPS';fpsFrames=0;fpsStarted=now;}
  }catch(error){RUNTIME.running=false;window.__tilesBoot.fail(error);}
}
async function retry(){
 cancelBuild();RUNTIME.shaderErrors=[];window.__tilesBoot.recover();RUNTIME.running=true;state.lastTick=performance.now();
 if(renderer.getContext().isContextLost()){
   window.__tilesBoot.progress('等待图形上下文恢复','参数保留，正在请求浏览器恢复WebGL2',.15);
   renderer.forceContextRestore();return;
 }
 await buildScene({preserveCamera:Boolean(current)});
}
renderer.domElement.addEventListener('webglcontextlost',event=>{
 event.preventDefault();cancelBuild();RUNTIME.building=false;RUNTIME.running=false;state.playing=false;RUNTIME.contextLossCount++;
 window.__tilesBoot.fail(Error('WebGL上下文已丢失，正在等待恢复。参数仍保留。'));
});
renderer.domElement.addEventListener('webglcontextrestored',()=>{
 RUNTIME.contextRestoreCount++;RUNTIME.running=true;window.__tilesBoot.recover();buildScene({preserveCamera:true});
});
document.addEventListener('visibilitychange',()=>{state.lastTick=performance.now();if(!document.hidden&&RUNTIME.running)resize();});
window.addEventListener('pageshow',()=>{state.lastTick=performance.now();resize();});
const health=()=>({version:'0.8.2',boot:window.__tilesBoot.state,runtime:{...RUNTIME},userAgent:navigator.userAgent,protocol:location.protocol,
 contextLost:renderer.getContext().isContextLost(),render:renderer.info.render,memory:renderer.info.memory,renderedAgeYears:RUNTIME.renderedAgeYears,targetAgeYears:state.physicalTime,
 physicalIPhoneTested:false,visualApproved:false,productionApproved:false});
window.TilesMotherV082Workbench={
 version:'0.8.2',state,profiles,materialSettings,runtime:RUNTIME,buildScene,retry,getHealth:health,
 getDiagnostics:()=>current?.diagnostics,
 getSceneState:()=>({roofBedChildren:contextGroup.children.length,floorVisible:floor.visible,worldMeshes:world.children.length,channel:state.channel,
 ageYears:RUNTIME.renderedAgeYears,targetAgeYears:state.physicalTime,mobile:RUNTIME.mobile,rendererPath:RUNTIME.rendererPath,buildMs:RUNTIME.lastBuildMs}),
 getMaterialFingerprint:()=>world.children.map(m=>({id:m.userData.source.meta?.entityId,colorHash:m.geometry.attributes.color?R.positionHash(m.geometry.attributes.color.array):null,
 metalness:m.material.metalness,side:m.material.side})),
 getProjectedBounds:()=>{const pts=[];for(const m of world.children)if(m.visible){const b=new T.Box3().setFromObject(m);for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])pts.push(new T.Vector3(x,y,z).project(camera));}return {minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))};},
 testContextLoss:()=>renderer.forceContextLoss(),testContextRestore:()=>renderer.forceContextRestore(),
 approval:{visualApproved:false,productionApproved:false,distillationComplete:false}
};
controls.addEventListener('change',()=>{RUNTIME.dirty=true;});
document.addEventListener('click',()=>{RUNTIME.dirty=true;});
document.addEventListener('input',()=>{RUNTIME.dirty=true;});
window.TilesMotherV08Workbench=window.TilesMotherV082Workbench;
window.TilesMotherV081Workbench=window.TilesMotherV082Workbench;
function startup(){
 try{bindControls();syncSliders();resize();requestAnimationFrame(animate);buildScene();}
 catch(error){window.__tilesBoot.fail(error);}
}
startup();
})();
