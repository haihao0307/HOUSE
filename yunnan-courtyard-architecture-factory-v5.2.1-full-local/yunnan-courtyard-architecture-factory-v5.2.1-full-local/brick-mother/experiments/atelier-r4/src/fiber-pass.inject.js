// Fiber fragments have their own small shader. Soil noise is never evaluated for straw.
const fiberVS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aNormal;layout(location=2)in vec4 aData;
uniform mat4 uVP;uniform mat4 uLightVP;out vec3 vP;out vec3 vN;out vec4 vD;out vec4 vShadow;
void main(){vP=aPosition;vN=aNormal;vD=aData;vShadow=uLightVP*vec4(aPosition,1.);gl_Position=uVP*vec4(aPosition,1.);}`;
const fiberFS=`#version 300 es
precision highp float;
in vec3 vP;in vec3 vN;in vec4 vD;in vec4 vShadow;
uniform vec3 uEye;uniform vec3 uLight;uniform float uWet;uniform float uGrain;uniform float uExposure;uniform float uClip;uniform int uMode;uniform highp sampler2DShadow uDepth;
out vec4 frag;
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 linear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
float shadow(vec3 n){vec3 q=vShadow.xyz/vShadow.w*.5+.5;if(any(lessThan(q,vec3(0)))||any(greaterThan(q,vec3(1))))return 1.;float bias=max(.0005*(1.-dot(n,uLight)),.00012);float s=0.;for(int i=0;i<4;i++){vec2 offset=vec2(float(i%2),float(i/2))-.5;s+=texture(uDepth,vec3(q.xy+offset/1024.,q.z-bias));}return s*.25;}
void main(){
 if(uClip>.5&&vP.x>0.)discard;
 vec3 N=normalize(vN),V=normalize(uEye-vP);if(!gl_FrontFacing)N=-N;
 float fiber=sin(vD.z*6.283185*3.+sin(vD.x*5.)*.3);
 vec3 base=mix(vec3(.39,.315,.193),vec3(.66,.544,.327),.56+.12*fiber)*(1.-vD.y*.32);
 base=mix(base,vec3(.43,.329,.211),clamp(vD.w*.72,0.,.9));
 float ht=fiber*.00025*uGrain;vec3 x=dFdx(vP),y=dFdy(vP),r1=cross(y,N),r2=cross(N,x);float dt=dot(x,r1);
 N=normalize(N-sign(dt)*(dFdx(ht)*r1+dFdy(ht)*r2)/max(abs(dt),1e-8));
 if(uMode==1){base=vec3(.49);N=normalize(vN);}if(uMode==2){frag=vec4(base,1);return;}if(uMode==3){frag=vec4(N*.5+.5,1);return;}if(uMode==4){frag=vec4(.5,.5,.5,1);return;}
 float rough=clamp(.93-uWet*.30,.30,1.);
 if(uMode==5){frag=vec4(vec3(rough),1);return;}if(uMode==6){frag=vec4(vec3(.04),1);return;}if(uMode==7){frag=vec4(0,0,0,1);return;}
 base=linear(clamp(base,0.,1.))*(1.-uWet*.24);
 vec3 H=normalize(V+uLight);float nl=max(dot(N,uLight),0.),nv=max(dot(N,V),.03),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
 float alpha=rough*rough,aa=alpha*alpha,den=nh*nh*(aa-1.)+1.,D=aa/(3.14159265*den*den);
 float gv=nl*sqrt(max(nv*nv*(1.-aa)+aa,0.)),glh=nv*sqrt(max(nl*nl*(1.-aa)+aa,0.));
 float f=1.-vh,f2=f*f;vec3 F=vec3(.04)+vec3(.96)*(f2*f2*f);
 vec3 color=base*mix(vec3(.18,.174,.16),vec3(.44,.455,.47),N.y*.5+.5)*.92;
 color+=((1.-F)*base/3.14159+D*.5/max(gv+glh,1e-5)*F)*vec3(3.6,3.4,3.17)*nl*shadow(N);
 color+=base*vec3(.29,.31,.34)*max(dot(N,normalize(vec3(3.,1.,-2.))),0.);
 color=max(color*uExposure,vec3(0));frag=vec4(srgb(color/(1.+color)),1.);
}`;
const fiberProg=program(fiberVS,fiberFS),fiberU={};for(const n of ['uVP','uLightVP','uEye','uLight','uWet','uGrain','uExposure','uClip','uMode','uDepth'])fiberU[n]=gl.getUniformLocation(fiberProg,n);
