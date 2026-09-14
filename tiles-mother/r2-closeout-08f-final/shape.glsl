// 08F.1: unified full-shell Microscope geometry. Coordinates are metres; amplitudes are production controls,
// not direct measurements from the scan. One stable field drives top, side wall, front/rear edge and underside.
// Only real bearing/seating/overlap bands are protected as structural boundary conditions.
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

 // One field only. No dedicated "top", "side" or "underside" noise source is allowed here.
 float broad=clamp(shapeBand(p,seed,6.*scale,.0012),-1.,1.);
 float middle=clamp(shapeBand(p,seed,26.*scale,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,shapeBand(p,seed,80.*scale,.0012));
 float common=.00150*broad+.00062*middle-.00138*pores;

 // The same field continues through the whole shell. Only the longitudinal overlap end is faded as a
 // structural assembly boundary; this fade is independent of face orientation/q.
 float rearCarrier=1.-.94*smoothstep(.82,.98,t);
 float dy=clamp(strength*common*rearCarrier,-.0048,.0042);

 // Real structural support zones. These are local bearing bands, not alternate shape states.
 float bottomW=smoothstep(.78,.98,q);
 float seatRail=bottomW*smoothstep(.58,.76,abs(u));
 dy*=1.-.9998*seatRail;
 float panBearing=(1.-step(1.5,meta.y))*(1.-bottomW)*smoothstep(.44,.58,abs(u))*(1.-smoothstep(.92,.985,abs(u)));
 float coverBearing=step(1.5,meta.y)*bottomW*smoothstep(.52,.66,abs(u));
 float bearingGuard=max(panBearing,coverBearing);
 dy*=1.-.9995*bearingGuard;

 // The same broad/middle/pore field also moves the side silhouette. q only controls geometric carrier,
 // not a different random state. This removes the machine-extruded side-wall reading.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float through=.42+.58*wall;
 float sideCarrier=smoothstep(.72,.985,abs(u));
 float dx=sign(u)*strength*(.00042*broad+.00018*middle-.00030*pores)*through*sideCarrier;

 // Front/rear lips inherit the same field as well. Rear movement is nearly neutral inside the overlap.
 // Corner carry remains non-zero so front corners do not read as CNC-cut right angles.
 float front=1.-smoothstep(.025,.16,t),rearLip=smoothstep(.84,.98,t);
 float cornerCarry=.34+.66*(1.-smoothstep(.72,.96,abs(u)));
 float edgeField=.00034*broad+.00015*middle-.00024*pores;
 float dz=strength*edgeField*(front+.04*rearLip)*cornerCarry*(.46+.54*wall);
 return vec3(dx,dy,dz);
}
