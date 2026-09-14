// 08D: geometry adapter. Coordinates in metres; depth limits are design controls.
// All three scales use the supplied Microscope kernel, not a texture/noise substitute.
uniform vec4 uMicroscope;
float shapeBand(vec3 p,float seed,float density,float footprint){
 vec3 q=vec3(p.x+(fract(sin(seed*12.9898+78.233)*43758.5453)-.5)*.11,p.z+.40,p.y+.27);
 float r=length(q);
 vec3 xi=vec3(log2(r)-2.,-q.z/r,atan(q.x,q.y))*density;
 float span=footprint*density/max(length(q.xy),.20),s=1.,value=0.;
 for(int j=0;j<17;j++){
  if(span*s>=2.4)break;
  float weight=1.-smoothstep(.8,2.4,span*s);
  vec3 c=cos(xi*s);value+=weight*(cos(dot(c.zyy,c.xyx))-.6556965)/s;s*=2.;
 }
 return value;
}
vec3 microshape(vec3 p,vec4 meta,float seed){
 if(meta.y<.5||uMicroscope.x<=0.||meta.z>=1.)return vec3(0.);
 float len=meta.y>1.5?.222:.238;
 float u=meta.w,t=clamp(p.z/len+.5,0.,1.),q=meta.z;
 float scale=uMicroscope.y,strength=min(uMicroscope.x,3.);
 float broad=clamp(shapeBand(p,seed,6.*scale,.0012),-1.,1.);
 float middle=clamp(shapeBand(p,seed,26.*scale,.0012),-1.,1.);
 // Thresholded peaks of the same field create sparse rounded, closed cavities.
 float pores=smoothstep(.56,.67,shapeBand(p,seed,80.*scale,.0012));
 float top=1.-smoothstep(.14,1.,q);
 float back=1.-smoothstep(.86,1.,t);
 float support=1.-.55*smoothstep(.80,.96,abs(u))*smoothstep(.20,.35,t)*(1.-smoothstep(.65,.80,t));
 float dy=strength*(.0024*broad+.0010*middle-.0022*pores)*top*back*support;
 dy=clamp(dy,-.0045,.0033);
 // Recess the pan beneath the cover; do not lower the cover's outer support lip.
 // This same rule applies to the specimen and the assembly, preserving identity.
 if(meta.y<1.5)dy-=max(dy,0.)*smoothstep(.35,.50,abs(u));
 else dy+=max(-dy,0.)*smoothstep(.50,.70,abs(u));
 // Exposed lip and side edges move in the actual silhouette. Bottom stays exact.
 // The edge carrier is low-pass filtered independently so inward notches
 // cannot reverse the surface parameterization at the maximum control value.
 float notch=smoothstep(-.35,.55,shapeBand(p,seed,8.*scale,.018));
 float edge=pow(abs(u),10.);
 float wall=16.*q*q*(1.-q)*(1.-q);
 float dx=-sign(u)*.00055*strength*pores*wall*smoothstep(.94,1.,abs(u));
 float dz=strength*(.00025+.0020*notch)*top*(1.-smoothstep(.025,.16,t))*(1.-smoothstep(.35,.50,abs(u)));
 dz+=.00070*strength*pores*wall*(1.-smoothstep(.01,.04,t));
 return vec3(dx,dy,dz);
}
