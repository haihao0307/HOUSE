const VERT=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aMeta;
layout(location=3) in mat4 aModel;
layout(location=7) in vec4 aState;
uniform mat4 uVP,uLightVP;
uniform int uType;
out vec3 vWorld,vLocal,vNormal;
out vec4 vShadow;
out vec2 vMeta;
flat out vec4 vState;
void main(){
 vec4 p=aModel*vec4(aPosition,1.);
 vec3 a=aModel[0].xyz,b=aModel[1].xyz,c=aModel[2].xyz;
 vNormal=normalize(a*aNormal.x/dot(a,a)+b*aNormal.y/dot(b,b)+c*aNormal.z/dot(c,c));
 vLocal=aPosition;
 if(uType==1) vLocal=aPosition*vec3(length(a),length(b),length(c))+vec3(0,0,aState.w);
 vWorld=p.xyz;vShadow=uLightVP*p;vMeta=aMeta;vState=aState;gl_Position=uVP*p;
}`;
const DEPTH_VERTEX=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=3) in mat4 aModel;
uniform mat4 uLightVP;
void main(){gl_Position=uLightVP*aModel*vec4(aPosition,1.);}`;
const DEPTH_FRAGMENT=`#version 300 es
precision highp float;
precision highp int;
void main(){}
`;
const FRAG=`#version 300 es
precision highp float;
precision highp int;
in vec3 vWorld,vLocal,vNormal;
in vec4 vShadow;
in vec2 vMeta;
flat in vec4 vState;
uniform vec3 uEye,uLight;
uniform vec4 uSurface,uColor,uBio;
uniform int uType,uDiagnostic;
uniform float uShadowTexel,uShadowEnabled;
uniform highp sampler2DShadow uShadow;
out vec4 fragColor;
uint hashU(ivec3 p){uvec3 a=uvec3(p);uint h=a.x*1597334677u^a.y*3812015801u^a.z*2798796415u;h^=h>>16;h*=2146121005u;h^=h>>15;h*=2221713035u;h^=h>>16;return h;}
vec3 gradient(ivec3 i){uint h=hashU(i)%12u;float a=(h&1u)==0u?1.:-1.,b=(h&2u)==0u?1.:-1.;return h<4u?vec3(a,b,0):h<8u?vec3(a,0,b):vec3(0,a,b);}
float corner(vec3 x,ivec3 i){float w=max(.6-dot(x,x),0.);w*=w;return w*w*dot(gradient(i),x);}
// Tetrahedral gradient field avoids axis-aligned value-cell patches.
float n3(vec3 p){vec3 ii=floor(p+dot(p,vec3(1./3.))),x=p-ii+dot(ii,vec3(1./6.));
 vec3 g=step(x.yzx,x.xyz),l=1.-g,i1=min(g,l.zxy),i2=max(g,l.zxy);
 ivec3 i=ivec3(ii);
 float n=corner(x,i)+corner(x-i1+1./6.,i+ivec3(i1))+corner(x-i2+1./3.,i+ivec3(i2))+corner(x-.5,i+ivec3(1));
 return clamp(.5+16.*n,0.,1.);}
// Film footprint gates only displayed frequencies, never object geometry/history.
float band(float footprint,float scale){return 1.-smoothstep(.35,.95,footprint*scale);}
vec3 srgb(vec3 c){c=max(c,vec3(0));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 perturb(vec3 N,vec3 p,float height){
 vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,N),r2=cross(N,dx);
 float det=dot(dx,r1);vec3 g=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
 return normalize(abs(det)*N-g);
}
float segdist(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/max(dot(d,d),1e-8),0.,1.));}
float ceramicCrack(vec2 p,float seed,float damage,float footprint){
 if(damage<.11)return 0.;
 float x=p.x,z=p.y;
 float path=.012*sin(x*87.+seed)+.004*sin(x*231.+seed*.7)+.036*x;
 float width=mix(.00007,.00042,damage),aa=max(footprint*.70,.000035);
 float gate=1.-smoothstep(.050,.105,abs(x-(seed-.5)*.055));
 float crack=1.-smoothstep(width,width+aa,abs(z-path));
 float branch=segdist(p,vec2(.02,path),vec2(.065,path+.028));
 return max(crack*gate,(1.-smoothstep(width*.7,width+aa,branch))*.7)*smoothstep(.11,.47,damage);
}
void main(){
 vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
 vec3 p=vLocal;
 float seed=vState.x,damage=vState.y,tint=vState.z;
 float fp=max(length(dFdx(p)),length(dFdy(p)));
 vec3 base;float rough=.86,height=0.,ao=1.;
 vec3 q=p+vec3(seed*.017,seed*.023,seed*.019);
 // Stable, smoothly varying material rotation. Geometry / view never enters identity.
 float turn=uBio.z*.37*sin(p.z*11.0+seed*.17),cs=cos(turn),sn=sin(turn);
 if(uType==1)q.xy=mat2(cs,-sn,sn,cs)*p.xy+vec2(seed*.017,seed*.023);
 else if(uType==0)q.xz=mat2(.932,-.362,.362,.932)*p.xz+vec2(seed*.017,seed*.019);
 float macro=.5,middle=.5;
 if(uType!=3){macro=n3(q*17.3);middle=mix(.5,n3(q*63.7+vec3(8.1,1.7,3.8)),band(fp,63.7));}
 if(uType==0){
   float fired=n3(q*8.2+vec3(8.1,2.6,5.4));
   float weather=clamp(uSurface.z,0.,1.);
   float grain=.5,micro=.5;
   if(fp*390.<.95)grain=mix(.5,n3(q*390.1),band(fp,390.));
   if(fp*1167.<.95)micro=mix(.5,n3(q*1167.),band(fp,1167.));
   // Broad mineral skin, broken edges at a different scale, and sparse iron clay.
   float wash=smoothstep(.26,.84,macro*.72+middle*.25+grain*.03)*(.15+.44*weather);
   float oxide=smoothstep(.73,.90,fired*.76+macro*.20+grain*.04)*uSurface.y;
   float individual=clamp(.50+(tint-.5)*uColor.z,0.,1.);
   vec3 body=mix(vec3(.077,.078,.075),vec3(.183,.180,.169),individual);
   body=mix(body,vec3(.221,.225,.212),wash);
   body=mix(body,vec3(.235,.160,.080),oxide*.30);
   float soot=smoothstep(.59,.88,middle)*smoothstep(.46,.74,1.-macro);
   body*=1.-.11*soot;
   body*=.97+.06*(grain-.5)*band(fp,390.);
   body*=vec3(1.+.13*uColor.y,1.+.015*uColor.y,1.-.14*uColor.y)*uColor.x;
   float scrape=smoothstep(.65,.83,n3(vec3(q.x*880.,q.y*390.,q.z*64.)))*smoothstep(.48,.68,middle)*band(fp,800.);
   body+=vec3(.014,.015,.014)*scrape;
   float pit=smoothstep(.73,.92,grain)*band(fp,390.);
   body*=1.-pit*.16;
   height=((middle-.5)*.00021+(grain-.5)*.00014*band(fp,390.)+(micro-.5)*.000055*band(fp,1167.)-pit*.00013-scrape*.000035)*uSurface.x;
   float crack=ceramicCrack(p.xz,fract(seed*.73),damage,fp);
   base=mix(body,vec3(.026,.027,.022),crack*.86);
   height-=crack*.00038;
   // Exposed clay is a specific reference-guided recipe, not a universal tile core.
   vec3 core=mix(vec3(.245,.182,.102),vec3(.38,.245,.102),uColor.w)*(.83+.30*grain+.08*middle);
   float skin=smoothstep(.05,.92,vMeta.x);
   base=mix(core,base,skin);
   height+= (1.-skin)*(grain-.5)*.00018*band(fp,390.);
   rough=mix(.92,.78,wash*.5)*(1.-uSurface.w*.16);base*=1.-uSurface.w*.15;
   ao=1.-crack*.25-pit*.15;
   if(uBio.x>.001&&vMeta.x>.6){
    float colony=.44*vState.w+.37*macro+.19*middle;
    float edge=.86-.50*uBio.x;
    float cover=smoothstep(edge-.07,edge+.07,colony);
    cover*=smoothstep(-.15,.35,N.y);
    vec3 moss=mix(vec3(.026,.035,.010),vec3(.110,.125,.040),clamp(middle*.65+grain*.35,0.,1.));
    base=mix(base,moss,cover*.94);height+=(grain-.5)*.00020*cover*uSurface.x;
    rough=mix(rough,.98,cover);ao*=1.-cover*.08;
   }

 }
 else if(uType==1){
   // Axial wood recipe: nested, nonuniform growth layers and long fibre grooves.
   float fibre=n3(vec3(q.x*480.,q.y*480.,q.z*13.));
   float warp=n3(vec3(q.x*49.,q.y*49.,q.z*9.));
   vec2 center=vec2(.0034*sin(p.z*9.+seed)+.006*exp(-pow((p.z-.068)/.036,2.)),.0021*sin(p.z*6.+seed*.3));
   float radius=length(p.xy-center);
   float rings=radius*5100.+warp*6.5+sin(radius*1210.+seed)*1.6;
   float ringMask=pow(.5+.5*sin(rings),8.)*band(fp,810.);
   float fibres=smoothstep(.48,.78,fibre);
   float streak=n3(vec3(q.x*96.,q.y*96.,q.z*2.8));
   float soft=.5;if(fp*1510.<.95)soft=n3(vec3(q.x*1510.,q.y*1510.,q.z*83.));
   base=mix(vec3(.073,.039,.016),vec3(.196,.146,.078),middle*.58+macro*.22);
   float weather=clamp(uSurface.z*.75+damage*.3,0.,1.);
   base=mix(base,vec3(.134,.125,.099)*(.73+.51*streak),weather*.72);
   base*=1.-.19*ringMask-.23*fibres;
   float longCrack=smoothstep(.72,.91,n3(vec3(q.x*153.,q.y*153.,q.z*3.4)))*band(fp,140.);
   base=mix(base,vec3(.043,.032,.019),longCrack*.6);
   height=((fibre-.5)*.00054*band(fp,440.)-ringMask*.00024+(soft-.5)*.000061*band(fp,1400.)-longCrack*.00055)*uSurface.x;
   if(vMeta.x<.1){base=mix(vec3(.154,.099,.041),vec3(.28,.19,.085),middle)*(.94-ringMask*.27);height+=(middle-.5)*.00043;}
   rough=.95;ao=1.-longCrack*.26;base*=uColor.x;
 }
 else if(uType==2){
   float tufts=n3(q*1791.),fine=n3(q*4073.);
   base=mix(vec3(.018,.030,.006),vec3(.085,.112,.020),clamp(vMeta.x*.58+middle*.18+macro*.11+tufts*.17,0.,1.));
   base=mix(base,vec3(.14,.11,.033),smoothstep(.60,.83,macro)*.46);
   height=((tufts-.5)*.00020*band(fp,1791.)+(fine-.5)*.000043*band(fp,4073.))*uSurface.x;
   rough=.97;ao=.83+.17*tufts;
 }
 else{base=vec3(.68,.685,.663);rough=.94;}
 if(uType!=3 && uDiagnostic!=1)N=perturb(N,vWorld,height);
 if(uDiagnostic==1){base=vec3(.30);rough=.88;}
 if(uDiagnostic==2){fragColor=vec4(N*.5+.5,1);return;}
 vec3 L=normalize(uLight),V=normalize(uEye-vWorld),H=normalize(V+L);
 float NoL=max(dot(N,L),0.),NoV=max(dot(N,V),.05),NoH=max(dot(N,H),0.),VoH=max(dot(V,H),0.);
 vec3 sc=vShadow.xyz/vShadow.w*.5+.5;float shadow=1.;
 if(uShadowEnabled>.5&&sc.x>0.&&sc.x<1.&&sc.y>0.&&sc.y<1.&&sc.z<1.){
   float z=sc.z-max(.000065,.00021*(1.-NoL));shadow=0.;
   for(int y=0;y<2;y++)for(int x=0;x<2;x++)shadow+=texture(uShadow,vec3(sc.xy+(vec2(x,y)-.5)*uShadowTexel*1.8,z))*.25;
 }
 float alpha=rough*rough,a2=alpha*alpha,den=NoH*NoH*(a2-1.)+1.;
 float D=a2/(3.14159265*den*den);
 float k=(rough+1.)*(rough+1.)*.125,G=(NoV/(NoV*(1.-k)+k))*(NoL/(NoL*(1.-k)+k));
 float F=.034+.966*pow(1.-VoH,5.);
 float spec=D*G*F/(4.*NoV*max(NoL,.04));
 vec3 sky=mix(vec3(.31,.29,.26),vec3(.69,.75,.78),N.y*.5+.5);
 float fill=max(0.,dot(N,normalize(vec3(1.2,.6,-.8))));
 vec3 col=base*(sky*.57+vec3(.24,.26,.28)*fill)*ao+base*NoL*1.25*shadow+spec*NoL*vec3(1.15,1.11,1.03)*shadow;
 if(uType==3)col=base*(.77+.23*NoL)*(.72+.28*shadow);
 // A restrained shoulder; linear light is converted once to sRGB.
 col=col/(1.+col*.18);fragColor=vec4(srgb(col),1.);
}`;
