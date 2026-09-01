import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {assertPolicy,validateLights,sha256,canonical,deepFreeze} from './guards.js';
const PRESETS={overview:{p:[18,14,-20],t:[0,2.5,0]},front:{p:[1,6,-22],t:[0,2.6,-2]},roof:{p:[7,27,-8],t:[0,2.5,0]},courtyard:{p:[-0.6,12,-7],t:[0,2.4,3]}};
export async function createViewer(container,policy,build){
 assertPolicy(policy);
 const deps=build.dependencies;
 await Promise.all(deps.map(async d=>{const response=await fetch('../'+d.path,{cache:'no-store'});if(!response.ok)throw new Error(`依赖不可用 ${d.path} (${response.status})`);if(await sha256(await response.arrayBuffer())!==d.sha256)throw new Error(`既有依赖发生变化：${d.path}。停止载入，避免跨版本拼接。`);}));
 const {createYunnanCourtyardPrototype}=await import('../../threejs/YunnanCourtyardProduction.js');
 const {resolveSurfaceProfile}=await import('../../threejs/YunnanSurfaceProfiles.js');
 const seedResponse=await fetch('../data/production/yunnan_surface_weathering_seed_v5_5_0.json');
 if(!seedResponse.ok)throw new Error('既有展示配置无法读取');
 const seedConfig=await seedResponse.json();
 const options={seed:401,tileArcSegments:6,renderQualityProfileId:'blueprint-readonly-legacy-6-span',surfaceProfile:resolveSurfaceProfile(seedConfig,'museum1940sBalanced')};
 const sourceRoot=createYunnanCourtyardPrototype(options);
 sourceRoot.updateMatrixWorld(true);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xe7e9df);scene.add(sourceRoot);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;renderer.localClippingEnabled=true;
 renderer.domElement.style.position='absolute';renderer.domElement.style.inset='0';renderer.domElement.style.zIndex='0';container.append(renderer.domElement);
 for(const overlay of container.querySelectorAll('.view-nav,.canvas-hint'))overlay.style.zIndex='2';
 window.addEventListener('hashchange',()=>window.__BLUEPRINT_WORKBENCH__?.showPage(location.hash.slice(1)||'overview'));
 const camera=new THREE.PerspectiveCamera(39,1,0.1,300);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.49;
 const ambient=new THREE.HemisphereLight(0xfffdf6,0x758271,1.45);scene.add(ambient);
 const rig=new THREE.Group();scene.add(rig);
 const lights={key:new THREE.DirectionalLight('#fff1df',2),fill:new THREE.DirectionalLight('#dfebff',1.2),rim:new THREE.DirectionalLight('#fff6ea',1.8)};
 lights.key.position.set(-9,17,-11);lights.fill.position.set(12,9,-6);lights.rim.position.set(3,12,13);Object.values(lights).forEach(l=>rig.add(l));
 const normalMaterial=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
 let mode='neutral_inspection',dirty=true,frames=0,clipped=false,lightSettings={rotation:0,key:{enabled:true,intensity:2,color:'#fff1df'},fill:{enabled:true,intensity:1.2,color:'#dfebff'},rim:{enabled:true,intensity:1.8,color:'#fff6ea'}};
 const frozenInput=deepFreeze(JSON.parse(JSON.stringify(options)));
 const box=new THREE.Box3().setFromObject(sourceRoot);const modelStats=sourceRoot.userData.stats;
 const center=box.getCenter(new THREE.Vector3());
 const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z));
 let lastSize=[0,0],lastPreset='overview';
 function fitOverview(){const direction=new THREE.Vector3(18,11.5,-20).normalize();const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();const up=new THREE.Vector3().crossVectors(direction,right);const tv=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),th=tv*camera.aspect;let distance=0;for(const c of corners){const d=c.clone().sub(center),z=d.dot(direction);distance=Math.max(distance,Math.abs(d.dot(right))/(th*.84)+z,Math.abs(d.dot(up))/(tv*.76)+z);}camera.position.copy(center).addScaledVector(direction,distance*1.03);controls.target.copy(center);controls.update();}
 function frameBounds(){camera.updateMatrixWorld(true);const points=corners.map(c=>c.clone().project(camera));const min=[0,1,2].map(i=>Math.min(...points.map(p=>p.getComponent(i)))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p.getComponent(i))));return {min,max,fullyInView:min.every(n=>n>=-1)&&max.every(n=>n<=1)};}
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(w<2||h<2)return;const changed=w!==lastSize[0]||h!==lastSize[1];renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(changed&&lastPreset==='overview')fitOverview();lastSize=[w,h];dirty=true;document.querySelector('#pixelSize').textContent=`原生 ${renderer.domElement.width} × ${renderer.domElement.height} px`;}
 function render(){renderer.render(scene,camera);frames++;dirty=false;}
 function setView(id){const v=PRESETS[id];if(!v)throw new Error('未知视角');lastPreset=id;if(id==='overview'){fitOverview();dirty=true;return;}camera.position.fromArray(v.p);controls.target.fromArray(v.t);camera.updateProjectionMatrix();controls.update();dirty=true;}
 function applyLights(){validateLights(lightSettings);for(const id of Object.keys(lights)){const cfg=lightSettings[id];lights[id].visible=cfg.enabled;lights[id].intensity=cfg.intensity;lights[id].color.set(cfg.color);}rig.rotation.y=THREE.MathUtils.degToRad(lightSettings.rotation);}
 function setMode(next){assertPolicy(policy);if(!policy.presentation.requiredModes.includes(next))throw new Error('未声明的展示模式');mode=next;scene.overrideMaterial=mode==='diagnostic'?normalMaterial:null;renderer.toneMapping=mode==='diagnostic'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  if(mode==='studio_beauty'){ambient.intensity=.8;applyLights();scene.background.set(0xe4e5da);}else{ambient.intensity=1.45;rig.rotation.y=0;lights.key.visible=true;lights.key.color.set('#fffdf7');lights.key.intensity=1.8;lights.fill.visible=true;lights.fill.color.set('#f6f9ff');lights.fill.intensity=.9;lights.rim.visible=true;lights.rim.color.set('#fffdf7');lights.rim.intensity=.7;scene.background.set(0xe7e9df);}
  renderer.clippingPlanes=mode==='diagnostic'&&clipped?[new THREE.Plane(new THREE.Vector3(0,0,1),0)]:[];dirty=true;render();return mode;
 }
 function setLights(next){assertPolicy(policy);validateLights(next);lightSettings=structuredClone(next);if(mode==='studio_beauty')applyLights();dirty=true;render();}
 function setClip(enabled){if(typeof enabled!=='boolean')throw new Error('剖切开关无效');clipped=enabled;renderer.clippingPlanes=mode==='diagnostic'&&clipped?[new THREE.Plane(new THREE.Vector3(0,0,1),0)]:[];dirty=true;render();}
 async function sourceFingerprint(){
  const parts=[];const geometrySeen=new Set(),materialSeen=new Set();const text=[];
  const addArray=a=>{if(a)parts.push(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));};
  sourceRoot.traverse(o=>{text.push(o.name,JSON.stringify(o.matrix.elements));if(o.geometry&&!geometrySeen.has(o.geometry)){geometrySeen.add(o.geometry);for(const key of Object.keys(o.geometry.attributes).sort()){text.push(key);addArray(o.geometry.attributes[key].array);}addArray(o.geometry.index?.array);}if(o.isInstancedMesh){addArray(o.instanceMatrix.array);addArray(o.instanceColor?.array);text.push(String(o.count));}
   for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m&&!materialSeen.has(m)){materialSeen.add(m);text.push(canonical({type:m.type,color:m.color?.getHex()??null,roughness:m.roughness??null,metalness:m.metalness??null,opacity:m.opacity,vertexColors:m.vertexColors,fragmentShader:m.fragmentShader??null,vertexShader:m.vertexShader??null}));}}
  });
  parts.push(new TextEncoder().encode(text.join('|')+canonical(frozenInput)));
  const total=parts.reduce((s,a)=>s+a.length,0),bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return sha256(bytes);
 }
 function snapshot(){return {renderer:'Three.js r'+THREE.REVISION,adapterVersion:'0.1.0',presentationMode:mode,frameBounds:frameBounds(),camera:{position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov},lights:{rotation:THREE.MathUtils.radToDeg(rig.rotation.y),...Object.fromEntries(Object.entries(lights).map(([id,l])=>[id,{enabled:l.visible,intensity:l.intensity,color:'#'+l.color.getHexString()}]))},studioLightConfig:structuredClone(lightSettings),hemisphereLight:{intensity:ambient.intensity,skyColor:'#'+ambient.color.getHexString(),groundColor:'#'+ambient.groundColor.getHexString()},lightUnits:'viewer_relative_uncalibrated',lightColorEncoding:'sRGB_hex',toneMapping:mode==='diagnostic'?'NoToneMapping':'ACESFilmic',exposure:1,autoExposure:false,whiteBalance:'fixed_renderer_input_no_auto_white_balance',nativePixelSize:[renderer.domElement.width,renderer.domElement.height],postProcessUpscaling:false,seed:401,generatorVersion:'5.5.0',sourceCaseId:sourceRoot.userData.caseId,exactDimensionsStatus:sourceRoot.userData.exactDimensionsStatus,sourceOptions:structuredClone(frozenInput),rootBounds:{min:box.min.toArray(),max:box.max.toArray()},sourceStats:structuredClone(modelStats),physicalTime:null,solverStep:null,displayTime:0,timeState:'static_legacy_preview_no_evolution',frames};}
 controls.addEventListener('change',()=>{dirty=true;});new ResizeObserver(resize).observe(container);setView('overview');resize();setMode(mode);
 function tick(){requestAnimationFrame(tick);if(controls.update())dirty=true;if(dirty&&container.clientWidth>0)render();}requestAnimationFrame(tick);
 const baselineFingerprint=await sourceFingerprint();
 document.querySelector('#renderStatus').textContent=`WebGL · ${Math.round(modelStats.triangleCount/1000)}k 三角面 · 既有候选`;
 return Object.freeze({setMode,setLights,setClip,setView,sourceFingerprint,snapshot,baselineFingerprint,refresh:()=>{resize();render();}});
}
