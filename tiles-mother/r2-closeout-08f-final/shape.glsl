// 08F.2: unified full-shell Microscope geometry. Coordinates are metres; amplitudes are production controls,
// not direct measurements from the scan. One stable scalar field drives top, side wall, front/rear edge and underside.
// Only the real bearing/seating/overlap patches constrain motion; the visible mid-wall remains fully irregular.
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
 float shellValue=.00150*broad+.00062*middle-.00138*pores;
 float rawShell=clamp(strength*shellValue,-.0048,.0042);

 // Contact patches are thin in shell depth. Their rigid seating is preserved in all three axes while the
 // q-middle side wall still inherits the full rawShell field, removing the machine-extruded edge reading.
 float isCover=step(1.5,meta.y),isPan=1.-isCover;
 float topW=1.-smoothstep(.12,.36,q),bottomW=smoothstep(.64,.88,q);
 float panTopBearing=isPan*topW*smoothstep(.46,.62,abs(u));
 float panBottomBearing=isPan*bottomW*smoothstep(.58,.76,abs(u));
 // Actual retained-contact triangles show two cover underside bearing zones: the left lip at u=-1 and
 // a narrow right seat centred near u=.075. Keep only those zones rigid; the rest of the underside varies.
 float coverLeftBearing=isCover*bottomW*smoothstep(.82,.96,-u);
 float coverRightBearing=isCover*bottomW*(1.-smoothstep(.045,.12,abs(u-.075)));
 float coverBottomBearing=max(coverLeftBearing,coverRightBearing);
 float contactPatch=max(max(panTopBearing,panBottomBearing),coverBottomBearing);
 float contactFree=1.-.9998*clamp(contactPatch,0.,1.);
 float dy=rawShell*contactFree;

 // Longitudinal cover overlap is another real seating boundary; only its vertical component is constrained.
 float coverRearOverlap=isCover*smoothstep(.72,.82,t);
 dy*=1.-.998*coverRearOverlap;

 // Side wall and lips are projections of THE SAME rawShell value. Only exact contact patches are fixed;
 // all middle side-wall bands and non-bearing corners retain full irregular silhouette motion.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float sideCarrier=smoothstep(.58,.96,abs(u));
 float dx=sign(u)*rawShell*(.36+.24*wall)*sideCarrier*contactFree;

 // Front/rear lips keep the same field and rounded corner carry. Bearing corners remain seated, while the
 // centre and the visible q-middle edge continue to move with the same field.
 float front=1.-smoothstep(.025,.18,t),rearLip=smoothstep(.82,.98,t);
 float cornerCarry=.42+.58*(1.-smoothstep(.58,.94,abs(u)));
 float dz=rawShell*(front+.28*rearLip)*cornerCarry*(.34+.30*wall)*contactFree;
 return vec3(dx,dy,dz);
}
