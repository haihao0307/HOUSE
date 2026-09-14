// 08F: full-shell Microscope geometry. Coordinates are metres; amplitudes are production controls,
// not direct measurements from the scan. The same stable field is carried through top, side and underside.
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
 float scale=uMicroscope.y,strength=min(uMicroscope.x,3.);
 float broad=clamp(shapeBand(p,seed,6.*scale,.0012),-1.,1.);
 float middle=clamp(shapeBand(p,seed,26.*scale,.0012),-1.,1.);
 float pores=smoothstep(.56,.67,shapeBand(p,seed,80.*scale,.0012));
 float under=clamp(shapeBand(p,seed,18.*scale,.0015),-1.,1.);
 float underPores=smoothstep(.60,.73,shapeBand(p,seed,58.*scale,.0011));
 float sideField=clamp(shapeBand(p,seed,11.*scale,.012),-1.,1.);

 // Preserve the accepted 08D top-face response at q=0, then carry the body field through the shell.
 float topW=1.-smoothstep(.34,.84,q);
 float bottomW=smoothstep(.60,.90,q);
 float rear=smoothstep(.86,1.,t),back=1.-rear;
 float bottomBack=1.-.70*rear;
 float bodyBack=mix(back,bottomBack,bottomW);
 float supportTop=1.-.55*smoothstep(.80,.96,abs(u))*smoothstep(.20,.35,t)*(1.-smoothstep(.65,.80,t));

 // The underside is allowed to vary, but the narrow lateral seating rails are a structural boundary condition.
 // This is not a return to the obsolete flat-bottom target: the centre and most of the underside remain displaced.
 // It only damps vertical displacement where pan/rafter and cover/pan contact must remain mechanically plausible.
 float seatRail=smoothstep(.55,.75,abs(u));
 float supportBottom=1.-.995*seatRail;
 float bodySupport=mix(supportTop,supportBottom,bottomW);

 float bodyDy=strength*(.00140*broad+.00055*middle)*bodyBack*bodySupport;
 float topDy=strength*(.00100*broad+.00045*middle-.00220*pores)*topW*back*supportTop;
 float underDy=strength*(.00022*broad+.00028*under-.00055*underPores)*bottomW*bottomBack*supportBottom;
 float dy=clamp(bodyDy+topDy+underDy,-.0045,.0035);
 // Retain the established lateral seating-edge guard; contact is re-solved after this field is applied.
 if(meta.y<1.5)dy-=max(dy,0.)*smoothstep(.35,.50,abs(u));
 else dy+=max(-dy,0.)*smoothstep(.50,.70,abs(u));

 // Side-wall silhouette inherits the same fields all the way through thickness instead of vanishing at q=0/1.
 // Lateral motion is retained at the seating rail because the contact constraint is vertical-gap based;
 // the rail guard above neutralizes only the vertical support error.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float through=.28+.72*wall;
 float sideCarrier=smoothstep(.90,.985,abs(u));
 float dx=sign(u)*strength*(.00026*sideField-.00042*pores+.00014*under)*through*sideCarrier;

 // Front/rear edge changes are continuous through the shell; the rear overlap receives only a small carrier.
 float notch=smoothstep(-.35,.55,shapeBand(p,seed,8.*scale,.018));
 float front=1.-smoothstep(.025,.16,t),rearLip=smoothstep(.88,.98,t);
 float lip=1.-smoothstep(.35,.50,abs(u));
 float dz=strength*(.00025+.0020*notch)*topW*front*lip;
 dz+=strength*(.00010+.00075*notch)*bottomW*front*lip;
 dz+=strength*.00022*sideField*through*(front+.20*rearLip);
 dz+=strength*.00055*pores*through*front;
 return vec3(dx,dy,dz);
}
