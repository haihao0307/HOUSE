
struct MotherWave {float value;float fine;vec3 gradient;};
struct MotherMaterial {float color;float roughness;float brightness;float warmth;float patina;float wet;float tint;float variation;float core;};
struct MotherSurface {vec3 color;float roughness;float metallic;float microHeight;vec3 microGradient;};
MotherWave waveResult(float value,float fine,float x,float y,float z){return MotherWave(value,fine,vec3(x,y,z));}
MotherSurface surfaceResult(float r,float g,float b,float rough,float h,float x,float y,float z){return MotherSurface(vec3(r,g,b),rough,0.,h,vec3(x,y,z));}
MotherWave fieldRule(float px,float py,float pz,float shift,float density,float footprint,float lo,float hi){
 float x=px+(shift-.5)*.11,y=pz+.4,z=py+.27,r=sqrt(x*x+y*y+z*z),xy2=x*x+y*y;
 float a=(log2(r)-2.)*density,b=-z/r*density,c=atan(x,y)*density;
 float value=0.,fine=0.,gx=0.,gy=0.,gz=0.,scale=1.,span=footprint*density/max(sqrt(xy2),.2);
 for(int j=0;j<17;j++){
  float w=1.-smoothstep(lo,hi,span*scale);if(w<=0.)break;
  float cx=cos(a*scale),cy=cos(b*scale),cz=cos(c*scale),v=cx*cz+cy*cy+cy*cx;
  float term=w*(cos(v)-.6556965)/scale,fac=w*sin(v);value+=term;if(j>=3)fine+=term;
  gx+=fac*sin(a*scale)*(cz+cy);gy+=fac*sin(b*scale)*(2.*cy+cx);gz+=fac*sin(c*scale)*cx;scale*=2.;
 }
 float d0=density/(r*r*.6931471805599453),d1=density/(r*r*r),d2=density/xy2;
 return waveResult(value,fine,gx*x*d0+gy*z*x*d1+gz*y*d2,gx*z*d0+gy*(z*z*d1-density/r),gx*y*d0+gy*z*y*d1-gz*x*d2);
}
float colorChannel(float value,float individual,float delta,float a,float b,float patina,float warm,float neutral,float cool,float bias,float added,float temperature,MotherMaterial M){
 float body=mix(mix(a,b,individual),patina,M.patina*.18)*(1.+.18*delta)+bias*delta;
 float family=clamp(.5+value*.30,0.,1.),tone=mix(mix(warm,neutral,smoothstep(.46,.66,family)),cool,smoothstep(.83,.94,family));
 return (mix(body,tone*(.80+.40*individual),M.color*.65)*(1.+clamp(value*.25,-.20,.20)*M.color)+added*clamp(value,-1.,1.)*M.color*M.warmth)*(1.+temperature*-.06)*M.brightness*(1.-M.wet*.15);
}
float skinRule(float q){return smoothstep(.05,.92,.78+.22*max(1.-smoothstep(0.,.14,q),smoothstep(.86,1.,q)));}
MotherSurface materialRule(float value,float fine,float gx,float gy,float gz,MotherMaterial M,float strength,float skin){
 float individual=clamp(.5+(M.tint-.5)*M.variation,0.,1.),delta=(M.tint-.5)*M.variation;
 float r=colorChannel(value,individual,delta,.050,.142,.238,.102,.092,.075,-.008,.010,.13,M);
 float g=colorChannel(value,individual,delta,.064,.151,.229,.082,.089,.088,-.002,.002,.015,M);
 float b=colorChannel(value,individual,delta,.071,.149,.204,.067,.083,.096,.009,-.006,-.14,M);
 r=mix(mix(.245,.38,M.core)*(.98+fine*.10),r,skin);g=mix(mix(.182,.245,M.core)*(.98+fine*.10),g,skin);b=mix(.102*(.98+fine*.10),b,skin);
 return surfaceResult(r,g,b,clamp(.86+fine*M.roughness*.32,.76,.97)*(1.-M.wet*.16),.00018*strength*value,.00018*strength*gx,.00018*strength*gy,.00018*strength*gz);
}