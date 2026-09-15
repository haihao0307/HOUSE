// 08F.2: unified full-shell Microscope geometry. Coordinates are metres; amplitudes are production controls,
// not direct measurements from the scan. One stable scalar field drives top, side wall, front/rear edge and underside.
// Only the real bearing/seating/overlap patches constrain selected motion components.
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
 float scale=uMicroscope.y,strength=min(uMicroscope.x,3.6);

 // Exactly one stochastic field. Top, side and underside never receive separate seeds or amplitudes.
 float broad=clamp(shapeBand(p,seed,6.*scale,.0012),-1.,1.);
 float middle=clamp(shapeBand(p,seed,26.*scale,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,shapeBand(p,seed,80.*scale,.0012));
 float common=.00150*broad+.00062*middle-.00138*pores;
 float rawShell=clamp(strength*common,-.0048,.0042);
 float dy=rawShell;

 // Structural boundary conditions only. The pan outer bearing lands and the cover underside flanks
 // suppress vertical motion, while still inheriting the same rawShell field in their silhouette.
 float isCover=step(1.5,meta.y),isPan=1.-isCover;
 float bottomW=smoothstep(.54,.92,q);
 float panVertical=isPan*smoothstep(.46,.62,abs(u));
 float coverVertical=isCover*smoothstep(.36,.74,q)*smoothstep(.34,.56,abs(u));
 float verticalGuard=max(panVertical,coverVertical);
 dy*=1.-.9998*clamp(verticalGuard,0.,1.);

 // Longitudinal cover overlap is another real seating boundary; only its vertical component is constrained.
 float coverRearOverlap=isCover*smoothstep(.72,.82,t);
 dy*=1.-.998*coverRearOverlap;

 // Side wall and lips are projections of THE SAME rawShell value. Lower contact patches taper lateral
 // motion only where a rafter or adjacent tile actually bears, leaving the visible side wall irregular.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float sideCarrier=smoothstep(.58,.96,abs(u));
 float panLateral=isPan*smoothstep(.72,.90,abs(u))*smoothstep(.42,.82,q);
 float coverLateral=isCover*smoothstep(.56,.76,abs(u))*smoothstep(.48,.86,q);
 float lateralGuard=max(panLateral,coverLateral);
 float dx=sign(u)*rawShell*(.36+.24*wall)*sideCarrier*(1.-.985*lateralGuard);

 // Front/rear lips keep the same field and rounded corner carry. Only the front bearing corners taper
 // longitudinal motion so contact is not hidden by a later rigid translation.
 float front=1.-smoothstep(.025,.18,t),rearLip=smoothstep(.82,.98,t);
 float cornerCarry=.42+.58*(1.-smoothstep(.58,.94,abs(u)));
 float dz=rawShell*(front+.28*rearLip)*cornerCarry*(.34+.30*wall);
 float frontBearing=max(panVertical,coverVertical)*(1.-smoothstep(.10,.24,t));
 dz*=1.-.97*frontBearing;
 return vec3(dx,dy,dz);
}
