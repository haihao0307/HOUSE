/* New map-free material program. Local matter coordinates + bounded bands.
 * Analytic derivatives provide a lighting direction, no authored UV/normal maps.
 * No material sampler declarations. Rasterization and GPU work still exist.
 */
const FieldMaterial=(()=>{
 const vertex=`
 attribute vec3 rest;attribute vec3 matterScale;attribute vec2 tag;attribute vec4 params;
 varying vec3 vQ,vP,vN;varying vec2 vTag;varying vec4 vParams;
 varying vec3 vT0,vT1,vT2;
 void main(){mat4 M=modelMatrix;
 #ifdef USE_INSTANCING
 M=M*instanceMatrix;
 #endif
 vec3 a=M[0].xyz,b=M[1].xyz,c=M[2].xyz;float det=dot(a,cross(b,c));
 vT0=cross(b,c)/det;vT1=cross(c,a)/det;vT2=cross(a,b)/det;
 vN=normalize(vT0*normal.x+vT1*normal.y+vT2*normal.z);
 vT0*=matterScale.x;vT1*=matterScale.y;vT2*=matterScale.z;vQ=rest*matterScale;vTag=tag;vParams=params;vP=(M*vec4(position,1.)).xyz;
 gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}`;
 const fragment=`
 precision highp float;precision highp int;
 uniform float uKind,uDetail,uWarm,uWet,uExposure,uDiagnostic,uMicro;
 uniform vec3 uLight;
 varying vec3 vQ,vP,vN,vT0,vT1,vT2;varying vec2 vTag;varying vec4 vParams;
 // Four-corner simplex gradient field. Original kernel from the published simplex construction.
 // Hash, gradient palette, band mixing and derivative implementation are local to this project.
 uint hashI(ivec3 p){uint h=uint(p.x)*374761393u^uint(p.y)*668265263u^uint(p.z)*1442695041u;h=(h^(h>>13u))*1274126177u;return h^(h>>16u);}
 vec3 direction(ivec3 p){uint h=hashI(p);uint a=h%12u;vec3 v=a<4u?vec3(1.,1.,0.):a<8u?vec3(1.,0.,1.):vec3(0.,1.,1.);if((h&16u)!=0u)v=-v;if((h&32u)!=0u){if(a<8u)v.x=-v.x;else v.y=-v.y;}return v;}
 vec4 corner(ivec3 i,vec3 d){float t=max(.6-dot(d,d),0.);vec3 g=direction(i);float v=dot(g,d),t2=t*t,t3=t2*t,t4=t2*t2;return vec4(t4*v,t4*g-8.*t3*v*d);}
 vec4 field(vec3 p){float skew=(p.x+p.y+p.z)/3.;ivec3 i=ivec3(floor(p+skew));vec3 x=p-vec3(i)+float(i.x+i.y+i.z)/6.;vec3 u=step(x.yzx,x.xyz),lo=1.-u,rank1=min(u,lo.zxy),rank2=max(u,lo.zxy);vec4 sum=corner(i,x)+corner(i+ivec3(rank1),x-rank1+1./6.)+corner(i+ivec3(rank2),x-rank2+1./3.)+corner(i+ivec3(1),x-.5);return vec4(.5+16.*sum.x,16.*sum.yzw);}
 // Macroscopic microscope: bounded, rotated material subexpression.
 // Fixed approximate centering (0.6565) is a recipe constant, not a physical mean.
 // Return [value, derivative w.r.t. p]; no finite difference resampling.
 vec4 microCell(vec3 p){vec3 c=cos(p),s=sin(p);float a=c.z*c.x+c.y*c.y+c.y*c.x,ds=-sin(a);
  return vec4(cos(a)-.6565,ds*vec3(-s.x*(c.z+c.y),-s.y*(2.*c.y+c.x),-s.z*c.x));}
 float band(float f){float p=max(length(dFdx(vQ)),length(dFdy(vQ)))*f;return 1.-smoothstep(.24,.85,p);}
 vec4 microSpectrum(vec3 p,vec3 phase,float f){
  vec4 r=vec4(0.);float amp=.55;
  mat3 B=mat3(.80,.60,0.,-.48,.64,.60,.36,-.48,.80);
  mat3 T=mat3(1.);
  for(int j=0;j<3;j++){float w=band(f);if(w>.005){vec4 q=microCell(T*(p*f)+phase+vec3(float(j)*2.31,float(j)*4.12,float(j)*.79));
   r.x+=amp*w*q.x;r.yzw+=amp*w*(transpose(T)*q.yzw)*(f/210.);}
   T=B*T;f*=2.03;amp*=.34;
  }return r;
 }
 vec3 linear(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
 void main(){vec3 q=vQ;float seed=vParams.x,age=vParams.y,moist=clamp(vParams.z*uWet,0.,1.),sel=vParams.w;vec3 off=vec3(mod(seed,137.),mod(floor(seed/137.),179.),mod(seed*.317,131.));
 vec4 macro=field(q*18.+off),mid=field(q*110.+off+vec3(17.,0.,4.));vec3 grad=vec3(0.),base;float rough=.88,interior=vTag.x;
 if(uKind<.5){
  float cloud=clamp(macro.x,0.,1.),chalk=smoothstep(.56,.86,.6*mid.x+.4*macro.x),warm=smoothstep(.45,.86,macro.x+.28*(sel-.5))*uWarm;
  base=mix(vec3(.32,.334,.335),vec3(.405,.416,.402),cloud);
  base=mix(base,vec3(.45,.375,.275),warm*.20);
  base=mix(base,vec3(.57,.556,.496),chalk*(.07+.10*age));base*=mix(.85,1.14,sel);base*=.94+.12*mid.x;
  vec4 micro=microSpectrum(q,off*.11,210.);float mGate=uMicro*(.4+.6*smoothstep(.25,.78,mid.x));
  base*=1.+micro.x*.10*mGate;grad+=micro.yzw*.13*mGate*uDetail;
  grad+=(macro.yzw*.004+mid.yzw*.026)*uDetail;
  float fineWeight=band(520.);if(fineWeight>.01){vec4 fine=field(q*520.+off+31.);base*=1.+(fine.x-.5)*.22*fineWeight;grad+=fine.yzw*.12*fineWeight*uDetail;}
  float poreWeight=band(1300.);if(poreWeight>.01){vec4 pore=field(q*1300.+off+74.);float hole=smoothstep(.69,.86,pore.x);base*=1.-hole*.43*poreWeight;grad+=pore.yzw*hole*.16*poreWeight*uDetail;}
  // A geological colour source is never inferred from intensity alone.
  vec3 core=mix(vec3(.46,.350,.205),vec3(.70,.567,.365),mid.x);core*=.9+.22*macro.x;core*=1.+micro.x*.18*uMicro;grad+=micro.yzw*.07*uMicro*interior*uDetail;
  base=mix(base,core,smoothstep(.25,.8,interior));rough=mix(.88,.99,interior);
 }else if(uKind<1.5){
  vec4 fibers=field(q*vec3(950.,950.,26.)+off),bundles=field(q*vec3(155.,155.,6.)+off+33.);
  float theta=atan(q.y,q.x),ang=atan(sin(theta-1.0),cos(theta-1.0)),dk=length(vec2(ang*.057,(q.z+.12)*.38));float knot=1.-smoothstep(.015,.057,dk),phase=length(q.xy-vec2(.006*sin(q.z*7.+seed),.004*sin(q.z*11.+.8)))*1120.+4.*bundles.x+knot*7.*sin((q.z+.12)*27.);
  float footprint=fwidth(phase),line=(1.-smoothstep(.45,2.4,footprint))*pow(.5+.5*sin(phase),18.);
  float grain=smoothstep(.57,.80,bundles.x);vec3 tang=vec3(-q.y,q.x,0.)/max(.012,length(q.xy));
  base=mix(vec3(.34,.285,.215),vec3(.48,.439,.352),macro.x);
  base=mix(base,vec3(.48,.474,.435),age*.50);base*=1.-line*.13-grain*.17;float checkA=abs(atan(sin(theta-1.75-.035*sin(q.z*19.)),cos(theta-1.75-.035*sin(q.z*19.))));float splitMask=(1.-smoothstep(.006,.024,checkA))*exp(-pow((q.z+.045)/.19,4.));base*=1.-splitMask*.56;
  base*=.90+.18*fibers.x;float kr=.5+.5*sin(dk*1350.+macro.x*2.);base*=1.-knot*(.06+.12*kr);base*=1.-(1.-smoothstep(.001,.012,dk))*.35;
  grad=tang*(line*.12)+bundles.yzw*vec3(.027,.027,.001)+fibers.yzw*vec3(.05,.05,.003);
  float rings=.5+.5*sin(length(q.xy)*1160.+macro.x*2.2),ringsAA=1.-smoothstep(.35,2.2,fwidth(length(q.xy)*1160.));
  vec3 fresh=mix(vec3(.48,.382,.254),vec3(.62,.505,.346),fibers.x);fresh*=1.-rings*ringsAA*.08;
  base=mix(base,fresh,smoothstep(.3,.8,interior));rough=.98;grad*=uDetail;
  vec4 mw=microSpectrum(vec3(q.x,q.y,q.z*.055),off*.17,210.);base*=1.+mw.x*.12*uMicro;grad+=mw.yzw*vec3(.04,.04,.002)*uMicro*uDetail;
 }else{
  float b=band(1200.);vec4 tuft=field(q*1200.+off);float tipped=smoothstep(.51,.78,tuft.x);
  base=mix(vec3(.145,.177,.072),vec3(.305,.330,.137),macro.x);base=mix(base,vec3(.425,.449,.210),tipped*.47*b);base*=.86+.28*mid.x;
  vec4 mm=microSpectrum(q,off*.1,260.);base*=1.+mm.x*.16*uMicro;grad=(tuft.yzw*.20*b+mid.yzw*.09+mm.yzw*.16*uMicro)*.025;rough=1.;
 }
 base*=1.-moist*.18;vec3 N=normalize(vN),G=vT0*grad.x+vT1*grad.y+vT2*grad.z;G-=N*dot(G,N);G/=max(1.,length(G)*.65);N=normalize(N-G);
 if(!gl_FrontFacing)N=-N;
 vec3 L=normalize(uLight),V=normalize(cameraPosition-vP),H=normalize(L+V);float nl=max(dot(N,L),0.),nv=max(dot(N,V),.02),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
 float alpha=rough*rough,a2=alpha*alpha,den=nh*nh*(a2-1.)+1.,D=a2/(3.14159*den*den),k=(rough+1.)*(rough+1.)*.125;
 float GG=(nl/(nl*(1.-k)+k))*(nv/(nv*(1.-k)+k));vec3 F=vec3(.035)+(vec3(1.)-.035)*pow(1.-vh,5.);
 vec3 spec=F*D*GG/max(.06,4.*nl*nv);
 float hemi=.28+.25*(.5+.5*N.y),fill=.12*max(dot(N,normalize(vec3(.6,.2,-.7))),0.);
 vec3 col=linear(base)*(hemi+fill+nl*1.62)*vTag.y+spec*nl*.48;
 if(uKind>1.5)col+=linear(base)*.17*pow(max(dot(-N,L),0.),2.);
 if(uDiagnostic>.5&&uDiagnostic<1.5)col=vec3(.22)*(hemi+nl*1.25);
 if(uDiagnostic>1.5)col=linear(mix(vec3(.17,.28,.32),vec3(.81,.52,.20),macro.x));
 col*=uExposure;col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);
 }`;
 function create(kind){return new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uKind:{value:kind},uMicro:{value:.75},uDetail:{value:1},uWarm:{value:.8},uWet:{value:.65},uExposure:{value:1},uDiagnostic:{value:0},uLight:{value:new THREE.Vector3(-.6,1,.7)}},side:THREE.FrontSide});}
 return {create};
})();
