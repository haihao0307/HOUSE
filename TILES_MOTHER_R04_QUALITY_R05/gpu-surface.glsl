// Continuous R04-derived bounded sheet; no object vertex or index buffers.
__R04_TILE__
__SHARED_FIELD__
struct Geom {vec4 size;vec4 end;vec4 curve;vec4 neckA;vec4 neckB;vec4 extra;};
struct TileSample {vec3 position;vec3 materialPoint;vec3 color;float roughness;float displacement;vec3 microGradient;};
uniform vec4 uS,uE,uC,uNA,uNB,uX,rS,rE,rC,rNA,rNB,rX;
uniform vec4 uWave,uHand;uniform vec4 uMaterial0,uMaterial1;uniform float uMaterialCore;
Geom activeGeom(){return Geom(uS,uE,uC,uNA,uNB,uX);}
Geom referenceGeom(){return Geom(rS,rE,rC,rNA,rNB,rX);}
uint hashU(uint n){n=(n^(n>>16u))*0x7feb352du;n=(n^(n>>15u))*0x846ca68bu;return n^(n>>16u);}
float hashV(int n){return float(hashU(uint(n)))/4294967295.;}
float noise2(float x,float y,int seed){
 ivec2 ij=ivec2(floor(vec2(x,y)));vec2 f=fract(vec2(x,y));f=f*f*(3.-2.*f);
 uint s=uint(seed);uint a=(uint(ij.x)*73856093u)^(uint(ij.y)*19349663u)^s;
 uint b=(uint(ij.x+1)*73856093u)^(uint(ij.y)*19349663u)^s;
 uint c=(uint(ij.x)*73856093u)^(uint(ij.y+1)*19349663u)^s;
 uint d=(uint(ij.x+1)*73856093u)^(uint(ij.y+1)*19349663u)^s;
 return mix(mix(float(hashU(a))/4294967295.,float(hashU(b))/4294967295.,f.x),mix(float(hashU(c))/4294967295.,float(hashU(d))/4294967295.,f.x),f.y);
}
vec4 sect(Geom g,float t){
 float v=g.neckB.z>.5?min(t/g.neckA.x,1.):t;
 vec4 q=vec4(mix(g.size.x,g.end.x,v),mix(g.curve.x,g.curve.y,v),mix(g.curve.z,g.curve.w,v),mix(g.size.z,g.end.y,v));
 if(g.neckB.z>.5)q=mix(q,vec4(g.neckA.z,g.neckA.w,g.neckB.x,g.neckB.y),smoothstep(g.neckA.x-g.neckA.y,g.neckA.x,t));return q;
}
vec3 basePoint(Geom g,float u,float t,float amount){
 vec4 sec=sect(g,t);float w=mix(g.size.x,sec.x,amount),x=u*w*.5,h=sec.y*amount,k=2.*h/(w*w*.25+h*h);
 float height=0.;if(k!=0.){float arcWidth=2.*asin(k*w*.5)/k,angle=asin(k*x);height=tile(vec3(0.,angle/(k*arcWidth),0.),vec4(1.,arcWidth,1.,k)).z;}
 float gain=g.end.w*amount;int seed=int(g.size.w);
 float side=(noise2(t*1.35,1.,seed+7)-.5)*(1.-u)*.00082+(noise2(t*1.55,1.,seed+97)-.5)*(1.+u)*.00082;
 float z=(t-.5)*g.size.y+gain*(mix((noise2(u*1.45,2.,seed+113)-.5)*.00135,(noise2(u*1.72,2.,seed+311)-.5)*.00135,t)+(noise2(u*1.55,5.,seed+211)-.5)*.00110*pow(abs(2.*t-1.),8.));
 float bow=(noise2(u*1.15+2.3,t*1.35+1.7,seed)-.5)*.00220+(noise2(u*2.10+.7,t*2.35+4.1,seed+11)-.5)*.00100+(hashV(seed+331)-.5)*.00120*u*sin(3.141592653589793*t);
 return vec3(x+side*gain,amount*sec.z+height+gain*pow(max(0.,1.-u*u),1.45)*bow*pow(sin(3.141592653589793*t),2.),z);
}
vec3 normalAt(Geom g,float u,float t,float a){vec3 du=basePoint(g,u+.0001,t,a)-basePoint(g,u-.0001,t,a),dv=basePoint(g,u,t+.0001,a)-basePoint(g,u,t-.0001,a);return normalize(g.neckB.w>.5?cross(dv,du):vec3(-du.y,du.x,0.));}
vec3 skinAt(Geom g,float u,float t,float q,float a){
 vec3 p=basePoint(g,u,t,a),n=normalAt(g,u,t,a);vec4 sc=sect(g,t);int seed=int(g.size.w);
 float th=mix(g.size.z,sc.w,a)*(1.+g.end.w*a*(.070*(noise2(t*1.55,u*1.35,seed+37)-.5)+.035*(noise2(t*4.1,u*3.1,seed+137)-.5)));
 float inset=q<.14?1.-sqrt(max(0.,1.-pow(1.-q/.14,2.))):q>.86?1.-sqrt(max(0.,1.-pow(1.-(1.-q)/.14,2.))):0.;
 vec3 edge=vec3(sign(u)*pow(abs(u),18.),0.,sign(t-.5)*pow(abs(2.*t-1.),18.));edge-=n*dot(edge,n);
 return p-n*(q*th)-edge*g.extra.x*(.00050+.00030*noise2(u*1.8,t*2.2,seed+1901))*inset;
}
vec3 handAt(Geom g,vec3 p){
 float u=clamp(p.x/g.extra.z,-1.,1.),t=clamp(p.z/g.extra.w+.5,0.,1.);float a=uHand.x,b=uHand.y,c=uHand.z,d=uHand.w;
 return vec3(pow(abs(u),12.)*(a*.00034+b*.00018*sin(t*7.1+d*3.))*sign(u),pow(1.-u*u,2.)*pow(sin(3.141592653589793*t),2.)*(a*.0028+b*.0014*sin(2.3*u+1.7*t+c*4.)+c*.0009*(2.*t-1.)+d*.0007*u),pow(abs(2.*t-1.),12.)*(c*.00055+d*.00028*sin(u*5.3+a*4.)));
}
TileSample evaluateTile(float u,float t,float q,float footprint){
 Geom g=activeGeom(),refG=referenceGeom();vec3 ref=skinAt(refG,u,t,q,1.),p=ref+vec3(0.,0.,max(0.,refG.size.y*.6-.4));
 MotherWave broad=fieldRule(p.x,p.y,p.z,uWave.x,6.*uWave.y,.0012,.8,2.4),mid=fieldRule(p.x,p.y,p.z,uWave.x,26.*uWave.y,.0012,.8,2.4),pore=fieldRule(p.x,p.y,p.z,uWave.x,80.*uWave.y,.0012,.8,2.4),fine=fieldRule(p.x,p.y,p.z,uWave.x,24.*uWave.y,footprint,.30,.85);
 float po=smoothstep(.56,.67,pore.value),vt=clamp(ref.z/refG.size.y+.5,0.,1.),edge=smoothstep(.85,1.,abs(u)),end=pow(abs(2.*vt-1.),8.),neck=refG.neckB.z>.5?smoothstep(refG.neckA.x-.005/refG.size.y,refG.neckA.x,vt):0.,amp=mix(1.,.52,max(max(q,edge),max(end,neck)));
 float height=uWave.z*amp*(.00135*clamp(broad.value,-1.,1.)+.00045*clamp(mid.value,-1.,1.)-.00075*po),side=.00018*uWave.z*clamp(mid.value,-1.,1.);
 vec3 outp=skinAt(g,u,t,q,g.end.z)+normalAt(g,u,vt,g.end.z)*height+handAt(refG,ref)*g.extra.y*g.end.z+vec3(sign(u)*edge*side,0.,sign(vt-.5)*end*side);
 MotherMaterial mat=MotherMaterial(uMaterial0.x,uMaterial0.y,uMaterial0.z,uMaterial0.w,uMaterial1.x,uMaterial1.y,uMaterial1.z,uMaterial1.w,uMaterialCore);
 MotherSurface surf=materialRule(fine.value,fine.fine,fine.gradient.x,fine.gradient.y,fine.gradient.z,mat,uWave.z,skinRule(q));
 return TileSample(outp,p,surf.color,surf.roughness,height,surf.microGradient);
}
