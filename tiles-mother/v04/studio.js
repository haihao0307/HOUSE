/* Reuses the already bundled Three.js 0.180.0. No HDRI, image texture or source model. */
(function(root){'use strict';const T=root.TilesReferenceRuntime;
const functions=`
 varying vec2 vTileUV;varying float vTileCavity;varying float vTileFlake;varying float vTileRelief;varying float vTileFace;
 uniform vec4 tileSeeds;uniform vec4 tileControls;uniform vec4 tileState;uniform float tileChannel;uniform float tileDamage;
 float tmHash(vec2 p,float s){return fract(sin(dot(p,vec2(127.1,311.7))+s)*43758.5453123);}
 float tmNoise(vec2 p,float s){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(tmHash(i,s),tmHash(i+vec2(1.,0.),s),f.x),mix(tmHash(i+vec2(0.,1.),s),tmHash(i+1.,s),f.x),f.y);}
 float tmFbm(vec2 p,float s){return .58*tmNoise(p,s)+.28*tmNoise(p*2.07,s+13.)+.14*tmNoise(p*4.13,s+37.);}
 vec3 tmLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
 vec3 tmSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
 float tmWet(){return tileState.x*mix(.24,1.-smoothstep(.78,1.,vTileUV.y)*.40,step(.5,vTileFace));}
 float tmMeso(){return tmFbm(vTileUV*19.+vec2(2.,-7.),tileSeeds.x+19.);}
 float tmGrain(){vec2 q=vTileUV*230.;float aa=1.-smoothstep(.6,1.7,max(length(dFdx(q)),length(dFdy(q))));return .5+(tmNoise(q,tileSeeds.y)-.5)*aa;}
 // Coarse formation variation plus broken local boundaries, no source UV pixels.
 float tmScuff(){vec2 p=vTileUV*2.-1.;vec2 q=p*vec2(73.,15.);q.x+=1.6*(tmFbm(p*7.,tileSeeds.z)-.5);float aa=1.-smoothstep(.7,1.7,max(length(dFdx(q)),length(dFdy(q))));return smoothstep(.69,.84,tmNoise(q,tileSeeds.z+83.))*smoothstep(.42,.63,tmFbm(p*8.,tileSeeds.z+107.))*aa;}
 vec3 tmAlbedo(){vec2 p=vTileUV*2.-1.;p+=.06*vec2(tmFbm(p*4.,tileSeeds.z),tmFbm(p*4.+31.,tileSeeds.z))-.03;
  float macro=tmFbm(p*2.2,tileSeeds.x),meso=tmMeso(),grain=tmGrain();
  float islands=tmFbm(p*3.7+vec2(7.,-4.),tileSeeds.x+53.);
  float broken=tmFbm(p*28.+vec2(-2.,9.),tileSeeds.x+139.);
  float stain=smoothstep(.54,.68,islands+(broken-.5)*.21);
  float pale=smoothstep(.48,.70,tmFbm(p*8.3,tileSeeds.x+97.));
  vec3 c=mix(vec3(.455,.472,.482),vec3(.48,.367,.275),clamp(stain*.62+tileControls.z*.13,0.,.78));
  c+=vec3((macro-.5)*.16*tileControls.x+(meso-.5)*.145*tileControls.y+pale*.045);
  c=mix(c,c*vec3(1.055,.94,.82),vTileFlake*.27);c*=1.-vTileCavity*.17;
  c+=(grain-.5)*.115*tileControls.w;c-=tmScuff()*.042;
  c*=1.-tmWet()*.25;c*=1.-clamp(tileState.y/70.,0.,1.)*.055;
  return tmLinear(clamp(c,vec3(.075),vec3(.77)));
 }
 float tmRough(){return clamp(tileState.z+(tmMeso()-.5)*.14+vTileFlake*.055-tmWet()*.22,.42,.97);}
`;
function material(d){const uniforms={tileSeeds:{value:new T.Vector4()},tileControls:{value:new T.Vector4(1,1,0,1)},tileState:{value:new T.Vector4(0,0,.84,.35)},tileChannel:{value:0},tileDamage:{value:0}};
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.84,metalness:0,side:T.DoubleSide});m.userData.uniforms=uniforms;
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float tileCavity;attribute float tileFlake;attribute float tileRelief;attribute float tileFace;varying vec2 vTileUV;varying float vTileCavity;varying float vTileFlake;varying float vTileRelief;varying float vTileFace;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTileUV=uv;vTileCavity=tileCavity;vTileFlake=tileFlake;vTileRelief=tileRelief;vTileFace=tileFace;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+functions).replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=tileChannel==1.?vec3(.43):tmAlbedo();').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=tmRough();');
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 if(tileChannel!=1.){float bh=(tmGrain()-.5)*.00020*tileState.w+(tmMeso()-.5)*.000055*tileState.w-tmScuff()*.000030*tileState.w;vec3 qx=dFdx(-vViewPosition),qy=dFdy(-vViewPosition),rx=cross(qy,normal),ry=cross(normal,qx);float det=dot(qx,rx);if(abs(det)>1.e-14)normal=normalize(abs(det)*normal-sign(det)*(dFdx(bh)*rx+dFdy(bh)*ry));}
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
 if(tileChannel==2.)gl_FragColor=vec4(tmSrgb(tmAlbedo()),1.);
 if(tileChannel==3.)gl_FragColor=vec4(normal*.5+.5,1.);
 if(tileChannel==4.)gl_FragColor=vec4(mix(vec3(.91,.93,.94),vec3(.14,.32,.49),vTileCavity),1.);
 if(tileChannel==5.)gl_FragColor=vec4(vec3(tmRough()),1.);
 if(tileChannel==6.)gl_FragColor=vec4(mix(vec3(.94,.89,.77),vec3(.18,.40,.66),clamp(tileState.y/40.,0.,1.)),1.);
 if(tileChannel==7.)gl_FragColor=vec4(vec3(tmFbm(vTileUV*4.,tileSeeds.x)),1.);
 if(tileChannel==8.)gl_FragColor=vec4(vec3(tmMeso()),1.);
 if(tileChannel==9.)gl_FragColor=vec4(mix(vec3(.14,.34,.58),vec3(.89,.60,.28),clamp(.5+vTileRelief/.006,0.,1.)),1.);
 if(tileChannel==10.)gl_FragColor=vec4(mix(vec3(.93,.90,.83),vec3(.14,.37,.60),tmWet()),1.);
 if(tileChannel==11.)gl_FragColor=vec4(mix(vec3(.91,.91,.87),vec3(.63,.21,.12),tileDamage),1.);
 `);};m.customProgramCacheKey=()=> 'tiles-procedural-surface-0.4.0';return m;}
function kelvin(k){const t=Math.max(1000,Math.min(12000,k))/100;const r=t<=66?255:329.698727446*((t-60)**-.1332047592),g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*((t-60)**-.0755148492),b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;return new T.Color().setRGB(...[r,g,b].map(x=>Math.min(255,Math.max(0,x))/255),T.SRGBColorSpace);}
class Studio{
 constructor(canvas){this.canvas=canvas;this.renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(37.24,1,.003,40);this.group=new T.Group();this.scene.add(this.group);this.meshes=[];
 this.hemi=new T.HemisphereLight(0xffffff,0x777a7b,1);this.scene.add(this.hemi);this.lights={};for(const role of['key','fill','rim']){const l=new T.DirectionalLight(0xffffff,1);l.userData.role=role;this.lights[role]=l;this.scene.add(l,l.target);}const k=this.lights.key;k.castShadow=true;k.shadow.mapSize.set(2048,2048);k.shadow.camera.left=-1.6;k.shadow.camera.right=1.6;k.shadow.camera.top=1.6;k.shadow.camera.bottom=-1.6;k.shadow.camera.near=.01;k.shadow.camera.far=8;k.shadow.bias=-.00005;k.shadow.normalBias=.00035;k.shadow.radius=3;
 this.ground=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0xd6d4cf,roughness:1,metalness:0}));this.ground.rotation.x=-Math.PI/2;this.ground.receiveShadow=true;this.scene.add(this.ground);this.frameCount=0;
 }
 clear(){for(const m of this.meshes){this.group.remove(m);m.geometry.dispose();m.material.dispose();}this.meshes=[];}
 setMeshes(ds){this.clear();for(const d of ds){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(d.positions,3));g.setAttribute('normal',new T.BufferAttribute(d.normals,3));g.setAttribute('uv',new T.BufferAttribute(d.uv,2));for(const [name,key]of[['tileCavity','cavities'],['tileFlake','flakes'],['tileRelief','relief'],['tileFace','face']])g.setAttribute(name,new T.BufferAttribute(d[key],1));g.setIndex(new T.BufferAttribute(d.indices,1));const m=new T.Mesh(g,material(d));m.userData.data=d;m.position.fromArray(d.offset||[0,0,0]);m.rotation.x=d.slope||0;m.castShadow=true;m.receiveShadow=true;this.group.add(m);this.meshes.push(m);}
 this.group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(this.group);this.ground.position.y=box.min.y-.009;this.bounds=box;
 }
 draw(view,project,controlsFor,seedsFor){const s=project.study,stage=s.presentation,rect=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h)this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const e=[view.target[0]+view.distance*Math.cos(view.pitch)*Math.sin(view.yaw),view.target[1]+view.distance*Math.sin(view.pitch),view.target[2]+view.distance*Math.cos(view.pitch)*Math.cos(view.yaw)];this.camera.position.fromArray(e);this.camera.lookAt(...view.target);
 const mode=stage.mode;this.renderer.toneMapping=mode==='studio_beauty'?T.ACESFilmicToneMapping:T.NoToneMapping;this.renderer.toneMappingExposure=mode==='studio_beauty'?stage.exposure:1;
 const background=project.channel==='final'&&mode==='studio_beauty'?0xd4d2cc:0xe0e1df;this.scene.background=new T.Color(background);this.ground.material.color.setHex(background);this.ground.visible=project.channel==='final'&&view.pitch>0;this.hemi.intensity=mode==='studio_beauty'?.38:mode==='diagnostic'?.65:1.7;
 const positions={key:[-1.3,.82,1.0],fill:[1.4,.70,.8],rim:[.3,1.15,-1.8]},angle=(mode==='studio_beauty'?stage.rotation:0)*Math.PI/180;
 for(const [role,l]of Object.entries(this.lights)){const v=positions[role],x=v[0]*Math.cos(angle)-v[2]*Math.sin(angle),z=v[0]*Math.sin(angle)+v[2]*Math.cos(angle);l.position.set(x,mode==='diagnostic'&&role==='key'?.27:v[1],z);l.target.position.set(0,0,0);const p=stage[role];l.intensity=mode==='studio_beauty'?(p.enabled?p.intensity:0):mode==='diagnostic'?(role==='key'?2.5:role==='fill'?.35:0):(role==='key'?2.1:role==='fill'?1.0:.45);l.color=mode==='studio_beauty'?kelvin(p.kelvin):new T.Color(0xffffff);}
 const channels=['final','source','albedo','normal','cavity','roughness','weather','macro','meso','relief','wetness','damage','wire'];let channel=channels.indexOf(project.channel);if(mode==='diagnostic'&&channel===0)channel=1;
 for(const m of this.meshes){const d=m.userData.data,t=d.tile,c=controlsFor(d.profile),seed=seedsFor(d),u=m.material.userData.uniforms;const color=seed.color??t.seeds.color,micro=seed.micro??t.seeds.micro;u.tileSeeds.value.set(color%65521/23.7,micro%65519/19.3,t.seeds.forming%65513/17.1,0);u.tileControls.value.set((c.richness??58)/58,(c.mottle??54)/54,(c.temperature??0)/100,(c.grain??28)/28);u.tileState.value.set(d.state.wetness,d.state.exposureDoseDays*((c.weather??25)/25),(c.roughness??84)/100,(c.microRelief??18)/50);u.tileDamage.value=d.state.damage;u.tileChannel.value=channel;m.material.wireframe=channel===12;}
 this.renderer.render(this.scene,this.camera);this.frameCount++;this.last={nativePixels:[w,h],postUpscalePixels:null,mode,toneMapping:this.renderer.toneMapping,autoExposure:false,whiteBalance:'D65 pipeline; studio approximate Kelvin role colors',lightUnits:'Three.js directional intensity, relative preview units',kelvinConversion:'Tanner-Helland approximate RGB 1000..12000K; non-spectral',renderer:'Three.js '+T.REVISION,frames:this.frameCount};
 }
}
root.TilesStudyStudio=Studio;
})(globalThis);
