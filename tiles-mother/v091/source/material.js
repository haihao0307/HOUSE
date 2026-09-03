
/* Multi-channel procedural fired-clay candidate. No source image is baked into albedo. */
(()=>{'use strict';const T=TilesReferenceRuntime;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function makeDetail(size=768){
 const n=size*size,h=new Float32Array(n),cavity=new Float32Array(n),mineral=new Float32Array(n),scratch=new Float32Array(n);
 let rng=2737649;const rnd=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return(rng>>>0)/4294967296};
 const idx=(x,y)=>((y+size)%size)*size+(x+size)%size;
 const scale=.096;
 for(let i=0;i<n;i++){h[i]=(rnd()-.5)*.000030;mineral[i]=.5+(rnd()-.5)*.14;}
 // Broad broken grain clusters. Fine particles vary in radius, lip, and depth.
 const stamp=(cx,cy,rx,ry,depth,kind,phase)=>{
  const bx=Math.ceil(rx*1.3),by=Math.ceil(ry*1.3);
  for(let j=-by;j<=by;j++)for(let i=-bx;i<=bx;i++){
   const a=Math.atan2(j/ry,i/rx),r=Math.hypot(i/rx,j/ry)/(1+.14*Math.sin(a*5+phase)+.06*Math.cos(a*9-phase));
   if(r>1.2)continue;const id=idx(cx+i,cy+j);
   if(kind===0){const u=clamp((r-.50)/.48);const bowl=1-u*u*(3-2*u),lip=Math.exp(-(((r-1.01)/.085)**2));
    h[id]-=depth*bowl;h[id]+=depth*.10*lip;cavity[id]=Math.max(cavity[id],bowl*.86);
   } else{const f=Math.max(0,1-r);h[id]+=depth*f;mineral[id]=clamp(mineral[id]+f*(Math.sin(phase*3.1)>.12?.40:-.38));}
  }
 };
 for(let k=0;k<6500;k++){
  const rx=(.10+rnd()**2*.37)/1000/scale*size,ry=rx*(.48+rnd());
  stamp(Math.floor(rnd()*size),Math.floor(rnd()*size),rx,ry,.000025+rnd()*.000070,1,rnd()*6.28);
 }
 for(let k=0;k<360;k++){
  const rx=(.17+rnd()**2*.95)/1000/scale*size,ry=rx*(.5+rnd()*.85);
  stamp(Math.floor(rnd()*size),Math.floor(rnd()*size),rx,ry,.00007+rnd()*.00027,0,rnd()*6.28);
 }
 for(let k=0;k<130;k++){
  const x=rnd()*size,y=rnd()*size,len=(.003+rnd()*.015)/scale*size,ang=(rnd()-.5)*.6;
  for(let q=0;q<len;q+=.6){const xx=Math.floor(x+q*Math.sin(ang)+Math.sin(q*.02)*.8),yy=Math.floor(y+q*Math.cos(ang));const f=Math.sin(Math.PI*q/len);const id=idx(xx,yy);h[id]-=.000048*f;scratch[id]=Math.max(scratch[id],f);}
 }
 const gradients=new Uint8Array(n*4),fields=new Uint8Array(n*4),du=scale/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,j=i*4;
  const dx=(h[idx(x+1,y)]-h[idx(x-1,y)])/(2*du),dy=(h[idx(x,y+1)]-h[idx(x,y-1)])/(2*du);
  gradients[j]=Math.round(clamp(.5+dx*.5)*255);gradients[j+1]=Math.round(clamp(.5+dy*.5)*255);
  gradients[j+2]=Math.round(clamp(.68+cavity[i]*.15-Math.abs(mineral[i]-.5)*.25+scratch[i]*.03)*255);gradients[j+3]=Math.round(clamp(1-cavity[i]*.38)*255);
  fields[j]=Math.round(clamp(.5+h[i]/.0012)*255);fields[j+1]=Math.round(clamp(mineral[i])*255);fields[j+2]=Math.round(scratch[i]*255);fields[j+3]=Math.round(cavity[i]*255);
 }
 const tex=d=>{const t=new T.DataTexture(d,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=T.NoColorSpace;t.needsUpdate=true;return t;};
 return {normalRoughAO:tex(gradients),fields:tex(fields),scale,resolution:size};
}
const shader=`
varying vec3 vRest;varying vec3 vRestN;varying vec3 vAxisX;varying vec3 vAxisY;varying vec3 vAxisZ;
varying float vCavity;varying float vFace;varying float vRelief;varying vec2 vTileUV;
uniform sampler2D detailNR;uniform sampler2D detailF;
uniform vec4 ceramic;uniform vec4 history;uniform vec4 identity;uniform vec4 geom;
uniform float channel;uniform float roofMode;
float th(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float tn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(th(i),th(i+vec3(1,0,0)),f.x),mix(th(i+vec3(0,1,0)),th(i+vec3(1,1,0)),f.x),f.y),mix(mix(th(i+vec3(0,0,1)),th(i+vec3(1,0,1)),f.x),mix(th(i+vec3(0,1,1)),th(i+vec3(1,1,1)),f.x),f.y),f.z);}
float tf(vec3 p){return .58*tn(p)+.28*tn(p*2.03+7.1)+.14*tn(p*4.09+19.7);}
vec3 srgbLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 weights(){vec3 w=pow(abs(normalize(vRestN)),vec3(6.));return w/max(dot(w,vec3(1.)),.0001);}
vec4 tri(sampler2D tex){vec3 p=vRest/.096+identity.xyz;vec3 w=weights();return texture2D(tex,p.yz)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}
vec3 clayGradient(){
 vec3 p=vRest/.096+identity.xyz;vec3 w=weights();
 vec2 gx=(texture2D(detailNR,p.yz).rg*2.-1.);
 vec2 gy=(texture2D(detailNR,p.xz).rg*2.-1.);
 vec2 gz=(texture2D(detailNR,p.xy).rg*2.-1.);
 return vec3(0.,gx.x,gx.y)*w.x+vec3(gy.x,0.,gy.y)*w.y+vec3(gz.x,gz.y,0.)*w.z;
}
vec3 fields(){vec3 p=vRest*35.+identity.xyz;return vec3(tf(p*.24),tf(p),tf(p*3.7));}
float shelter(){return clamp(smoothstep(.05,.40,vTileUV.y)*roofMode*.74+vCavity*.26+(1.-step(.5,vFace))*.15,0.,1.);}
float runoff(){vec3 p=vRest;float panLane=exp(-pow(p.x/(geom.x*.23),2.));float capShed=smoothstep(.18,.78,abs(p.x)/(geom.x*.5));float lane=mix(panLane,capShed,geom.w);float stripe=smoothstep(.36,.64,tn(vec3(p.x*280.,p.y*28.,p.z*6.)+identity.xyz));return lane*stripe*step(.5,vFace);}
vec3 clayColor(){
 vec3 p=vRest*29.+identity.xyz;vec3 f=fields();vec4 m=tri(detailF);
 float broken=tn(p*8.1),warm=smoothstep(.52,.67,f.x+(f.z-.5)*.16+identity.w);
 float pale=smoothstep(.56,.70,tf(p*1.6+31.)+(broken-.5)*.14+(m.g-.5)*.24);
 float dark=smoothstep(.64,.80,tf(p*.9-12.));
 vec3 cool=vec3(.365,.397,.415),neutral=vec3(.445,.436,.410),ochre=vec3(.49,.399,.321),ash=vec3(.60,.589,.555),soot=vec3(.218,.238,.246);
 vec3 c=mix(cool,neutral,.38+identity.w*.6);
 c=mix(c,ochre,warm*.73*ceramic.x);
 c=mix(c,ash,pale*.16*ceramic.x);
 c=mix(c,soot,dark*.44*ceramic.x);
 c+=(f.y-.5)*.056+(f.z-.5)*.035+(m.g-.5)*.205;
 c=mix(c,ash,smoothstep(.76,.92,m.g)*.24*ceramic.x);
 c-=m.b*.018;
 float eroded=(1.-smoothstep(.06,.28,m.r))*m.a;
 c=mix(c,neutral,m.a*.05);
 c+=identity.w*.13;
 float dust=history.x*shelter()*smoothstep(.32,.68,f.z),wash=history.y*runoff();
 float bio=history.z*shelter()*smoothstep(.59,.73,tf(p*2.4));
 c=mix(c,vec3(.435,.420,.388),dust*.30);c=mix(c,cool,wash*.20);
 c=mix(c,vec3(.243,.270,.235),bio*.5);c=mix(c,soot,dust*history.w*.12);
 c*=1.-ceramic.z*.28;
 return clamp(c,vec3(.12),vec3(.76));
}
float clayRough(){vec4 d=tri(detailNR);return clamp(d.b+.05+(fields().y-.5)*.12+vCavity*.055+history.x*shelter()*.06-ceramic.z*.30,.29,.94);}
float clayAO(){return clamp(tri(detailNR).a*(1.-vCavity*.20),.55,1.);}
`;
function material(record,detail,settings){
 const seed=record.tile.seeds.color,rand=(k)=>TilesStudyCore.hash(seed+'/'+k)/4294967296;
 const u={detailNR:{value:detail.normalRoughAO},detailF:{value:detail.fields},ceramic:{value:new T.Vector4(settings.color/100,settings.micro/100,settings.wet,0)},history:{value:new T.Vector4()},identity:{value:new T.Vector4(rand(1)*97,rand(2)*97,rand(3)*97,(rand(4)-.5)*.26)},geom:{value:new T.Vector4(record.tile.dimensions.width,record.tile.dimensions.length,record.tile.dimensions.thickness,record.family==='cover'?1:0)},channel:{value:0},roofMode:{value:1}};
 const m=new T.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:.74,side:T.FrontSide,transparent:false,opacity:1,envMapIntensity:.70});m.userData.u=u;
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,u);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float tileCavity;attribute float tileFace;attribute float tileRelief;varying vec3 vRest;varying vec3 vRestN;varying vec3 vAxisX;varying vec3 vAxisY;varying vec3 vAxisZ;varying float vCavity;varying float vFace;varying float vRelief;varying vec2 vTileUV;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvRest=position;vRestN=normal;vCavity=tileCavity;vFace=tileFace;vRelief=tileRelief;vTileUV=uv;vAxisX=normalMatrix*vec3(1,0,0);vAxisY=normalMatrix*vec3(0,1,0);vAxisZ=normalMatrix*vec3(0,0,1);');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+shader)
   .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=srgbLinear(clayColor());')
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clayRough();')
   .replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=clayAO();')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 grad=clayGradient();vec3 gv=vAxisX*grad.x+vAxisY*grad.y+vAxisZ*grad.z;
    gv-=normal*dot(gv,normal);normal=normalize(normal-gv*ceramic.y*1.28);
   `)
   .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
    if(channel>.5&&channel<1.5)outgoingLight=srgbLinear(clayColor());
    else if(channel>1.5&&channel<2.5)outgoingLight=vec3(clayRough());
    else if(channel>2.5&&channel<3.5)outgoingLight=vec3(clayAO());
    else if(channel>3.5&&channel<4.5)outgoingLight=normal*.5+.5;
    else if(channel>4.5&&channel<5.5)outgoingLight=vec3(clamp(.5+vRelief*180.,0.,1.));
    else if(channel>5.5&&channel<6.5)outgoingLight=vec3(history.x*shelter(),history.y*runoff(),history.z);
    else if(channel>6.5)outgoingLight=totalDiffuse+totalSpecular;
   `);
  m.userData.compiled=true;
 };
 m.customProgramCacheKey=()=> 'tiles091-triplanar-fired-clay';
 return m;
}
function update(m,s){const u=m.userData.u;if(!u)return;u.ceramic.value.set(s.color/100,s.micro/100,s.wet,0);const curve=(on,tau)=>1-Math.exp(-Math.max(0,s.age-on)/tau);u.history.value.set(curve(0,18),curve(5,55),curve(28,65),curve(12,70));u.channel.value=s.channel;u.roofMode.value=s.view==='single'||s.view==='trio'?0:1;const mapped=s.channel===0;if(m.toneMapped!==mapped){m.toneMapped=mapped;m.needsUpdate=true;}}
function environment(renderer){
 const w=256,h=128,data=new Float32Array(w*h*4),dirs=[[.4,.8,.3,3.2],[-.8,.3,-.1,1.3],[.3,.45,-.8,2.0]];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const v=(y+.5)/h,u=(x+.5)/w,phi=u*Math.PI*2,theta=v*Math.PI;
  const n=[-Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
  let b=.11+.35*Math.max(0,n[1]);for(const d of dirs){const l=Math.hypot(d[0],d[1],d[2]),dot=(n[0]*d[0]+n[1]*d[1]+n[2]*d[2])/l;b+=d[3]*Math.pow(Math.max(0,dot),26);}
  const i=(y*w+x)*4;data[i]=b;data[i+1]=b;data[i+2]=b*1.02;data[i+3]=1;
 }
 const tex=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.LinearSRGBColorSpace;tex.needsUpdate=true;
 const pm=new T.PMREMGenerator(renderer);const target=pm.fromEquirectangular(tex);tex.dispose();pm.dispose();return target;
}
window.TilesMaterial091={makeDetail,material,update,environment};
})();

