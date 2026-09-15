// 08F.2: unified full-shell Microscope geometry. Coordinates are metres; amplitudes are production controls,
// not direct measurements from the scan. One stable scalar field drives top, side wall, front/rear edge and underside.
// Only narrow real bearing/seating/overlap bands are protected as structural boundary conditions.
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
 if(meta.y<.5||uMicroscope.x<=0.)return vec3(0.);
 float len=meta.y>1.5?.222:.238;
 float u=meta.w,t=clamp(p.z/len+.5,0.,1.),q=clamp(meta.z,0.,1.);
 float scale=uMicroscope.y,strength=min(uMicroscope.x,4.5);

 // Exactly one stochastic field. Top, side and underside never get separate noise states or amplitudes.
 float broad=clamp(shapeBand(p,seed,6.*scale,.0012),-1.,1.);
 float middle=clamp(shapeBand(p,seed,26.*scale,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,shapeBand(p,seed,80.*scale,.0012));
 float common=.00150*broad+.00062*middle-.00138*pores;
 float rawShell=clamp(strength*common,-.0048,.0042);
 float dy=rawShell;

 // Structural exceptions only. They suppress VERTICAL motion on the real contact strips while leaving
 // the same scalar field available to the side silhouette, so the edge does not become a machined extrusion.
 float bottomW=smoothstep(.78,.98,q);
 float seatRail=bottomW*smoothstep(.40,.62,abs(u));
 dy*=1.-.9995*seatRail;
 float panBearing=(1.-step(1.5,meta.y))*(1.-bottomW)*smoothstep(.26,.52,abs(u));
 float coverBearing=step(1.5,meta.y)*bottomW*(1.-smoothstep(.28,.56,abs(u)));
 float bearingGuard=max(panBearing,coverBearing);
 dy*=1.-.9995*bearingGuard;
 // Cover longitudinal overlap is another real structural boundary. Protect only its vertical seating zone.
 float coverRearOverlap=step(1.5,meta.y)*smoothstep(.72,.82,t);
 dy*=1.-.998*coverRearOverlap;

 // Side wall and lips are projections of THE SAME rawShell value. No second amplitude law exists here.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float sideCarrier=smoothstep(.58,.96,abs(u));
 float dx=sign(u)*rawShell*(.36+.24*wall)*sideCarrier;

 // Round the front/rear silhouette with the same rawShell signal, carrying deformation through corners.
 float front=1.-smoothstep(.025,.18,t),rearLip=smoothstep(.82,.98,t);
 float cornerCarry=.42+.58*(1.-smoothstep(.58,.94,abs(u)));
 float dz=rawShell*(front+.28*rearLip)*cornerCarry*(.34+.30*wall);
 return vec3(dx,dy,dz);
}
