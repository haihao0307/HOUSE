// 08C adapter: the same pole-free domain and 17-level kernel as the PBR field.
// Geometry uses a fixed mesh footprint, never a camera-dependent footprint.
// All metre amplitudes are conservative design limits, not recovered measurements.
uniform vec4 uMicroscope;
float shapeField(vec3 p,float seed){
 vec3 q=vec3(p.x+(fract(sin(seed*12.9898+78.233)*43758.5453)-.5)*.11,p.z+.40,p.y+.27);
 float r=length(q),density=24.*uMicroscope.y;
 vec3 xi=vec3(log2(r)-2.,-q.z/r,atan(q.x,q.y))*density;
 float span=.006*density/max(length(q.xy),.20),s=1.,value=0.;
 for(int j=0;j<17;j++){
  float weight=1.-smoothstep(.8,2.4,span*s);
  vec3 c=cos(xi*s);value+=weight*(cos(dot(c.zyy,c.xyx))-.6556965)/s;s*=2.;
 }
 return clamp(value,-1.,1.);
}
vec3 microshape(vec3 p,vec4 meta,float seed){
 if(meta.y<.5||uMicroscope.x<=0.)return vec3(0.);
 float len=meta.y>1.5?.222:.238;
 float u=meta.w,t=clamp(p.z/len+.5,0.,1.),q=meta.z;
 float field=shapeField(p,seed),strength=min(uMicroscope.x,3.);
 // Top relief retreats into the existing closed shell. Bottom and side seating
 // rails stay exact. Both lap ends are protected from vertical displacement.
 float top=1.-smoothstep(0.,.50,q);
 float side=1.-smoothstep(.70,.90,abs(u));
 float lap=smoothstep(.12,.25,t)*(1.-smoothstep(.72,.85,t));
 float dy=-.00035*strength*(.5+.5*field)*top*side*lap;
 // Exposed front lip retreats <=0.6 mm; rear lap, bottom and side rails stay put.
 float dz=.00020*strength*(.5+.5*field)*top*side*(1.-smoothstep(.015,.08,t));
 // Mid-thickness side-wall recess, with top/bottom contact rims fixed.
 float wall=16.*q*q*(1.-q)*(1.-q);
 float dx=-sign(u)*.00012*strength*(.5+.5*field)*wall*smoothstep(.88,1.,abs(u))*lap;
 return vec3(dx,dy,dz);
}
