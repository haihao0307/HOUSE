// 08F.1: unified full-shell Microscope geometry. Coordinates are metres; amplitudes are production controls,
// not direct measurements from the scan. One stable field drives top, side wall, front/rear edge and underside.
// Only real longitudinal overlap, rafter seating and cover-flank bearing bands are protected structurally.
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
 float scale=uMicroscope.y,strength=min(uMicroscope.x,3.3);

 // One field only. No dedicated top/side/underside random state exists.
 float broad=clamp(shapeBand(p,seed,6.*scale,.0012),-1.,1.);
 float middle=clamp(shapeBand(p,seed,26.*scale,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,shapeBand(p,seed,80.*scale,.0012));
 float common=.00150*broad+.00062*middle-.00138*pores;
 float dy=clamp(strength*common,-.0048,.0042);

 // Structural end bands are symmetric for every face and both tile types. They suppress only vertical motion
 // where consecutive tiles actually overlap; this is an assembly boundary, not a different face state.
 float frontOverlap=1.-smoothstep(.16,.28,t);
 float rearOverlap=smoothstep(.74,.86,t);
 float overlapGuard=max(frontOverlap,rearOverlap);
 dy*=1.-.9995*overlapGuard;

 // Narrow structural bands. Most of every underside and side wall still uses the full common field.
 float bottomW=smoothstep(.78,.98,q);
 float seatRail=bottomW*smoothstep(.52,.70,abs(u));
 dy*=1.-.9998*seatRail;
 // The actual cover-to-pan bearing wing spans the lower sidewall into the underside, not q==1 alone.
 // Protect only vertical motion there; lateral silhouette remains driven by the common field.
 float coverBearingDepth=smoothstep(.08,.28,q);
 float coverFlank=step(1.5,meta.y)*coverBearingDepth*smoothstep(.60,.74,abs(u));
 dy*=1.-.9995*coverFlank;

 // The same broad/middle/pore field moves the side silhouette continuously through shell thickness.
 // The rafter rail also stabilizes horizontal seat drift, but does not flatten the visible side wall.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float through=.42+.58*wall;
 float sideCarrier=smoothstep(.68,.985,abs(u));
 float dx=sign(u)*strength*(.00040*broad+.00018*middle-.00027*pores)*through*sideCarrier;
 dx*=1.-.985*seatRail;

 // Front/rear lips use the same field. They keep lateral/longitudinal irregularity even when vertical overlap
 // motion is protected, so visible corners remain hand-formed instead of becoming square CNC cuts.
 float front=1.-smoothstep(.025,.16,t),rearLip=smoothstep(.84,.98,t);
 float cornerCarry=.38+.62*(1.-smoothstep(.70,.96,abs(u)));
 float edgeField=.00031*broad+.00015*middle-.00021*pores;
 float dz=strength*edgeField*(front+.05*rearLip)*cornerCarry*(.46+.54*wall);
 return vec3(dx,dy,dz);
}
