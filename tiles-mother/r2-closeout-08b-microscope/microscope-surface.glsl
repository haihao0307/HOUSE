// Yohei Nishitsuji: Macroscopic microscope, published 2025-01-18.
// Formula: cos(dot(cos(xi.zyy*s),cos(xi.xyx*s)))/s; s=1,2,...,65536.
// Static tile adapter uses the user's xi1=-q.z/r convention (no extra -1).
// The primary source's ray march/camera/illumination are NOT copied into the tile.
// Domain scale, offset, display filtering and PBR gains below are adapter parameters.
// They are not claimed author rotation-node constants or measured tile depths.
uniform vec4 uMicroscope; // intensity, spatial scale, subtle color, roughness response
struct MicroSurface { float value; float fine; vec3 gradient; };
float tileIdentity(float seed){return fract(sin(seed*12.9898+78.233)*43758.5453);}
MicroSurface microscopeSurface(vec3 p,float seed){
    MicroSurface f; f.value=0.;f.fine=0.;f.gradient=vec3(0.);
    // A pole-free 3D material domain for all existing pan/cover shell templates.
    // Only the stable instance identity shifts the domain; no camera/time noise.
    vec3 q=vec3(p.x+(tileIdentity(seed)-.5)*.11,p.z+.40,p.y+.27);
    float radius=length(q),r2=radius*radius,xy2=dot(q.xy,q.xy);
    float density=24.*uMicroscope.y;
    vec3 xi=vec3(log2(radius)-2.,-q.z/radius,atan(q.x,q.y))*density;
    vec3 J0=q/(r2*log(2.))*density;
    vec3 J1=(q.z*q/(r2*radius)-vec3(0.,0.,1./radius))*density;
    vec3 J2=vec3(q.y,-q.x,0.)/xy2*density;
    vec3 dqdx=dFdx(q),dqdy=dFdy(q);
    vec3 xspan=vec3(dot(J0,dqdx),dot(J1,dqdx),dot(J2,dqdx));
    vec3 yspan=vec3(dot(J0,dqdy),dot(J1,dqdy),dot(J2,dqdy));
    float span=max(length(xspan),length(yspan));
    vec3 gradientXi=vec3(0.);float scale=1.;
    for(int j=0;j<17;j++){
        float weight=1.-smoothstep(.30,.85,span*scale);
        // Zero weights omit unresolved display detail, not object identity.
        if(weight<=0.)break;
        {
            vec3 phase=xi*scale,c=cos(phase),sn=sin(phase);
            float argument=dot(c.zyy,c.xyx);
            float centered=cos(argument)-.6556965;
            f.value+=weight*centered/scale;
            if(j>=3)f.fine+=weight*centered/scale;
            gradientXi+=weight*sin(argument)*vec3(sn.x*(c.z+c.y),sn.y*(2.*c.y+c.x),sn.z*c.x);
        }
        scale+=scale;
    }
    vec3 g=gradientXi.x*J0+gradientXi.y*J1+gradientXi.z*J2;
    f.gradient=g.xzy; // q=(p.x+offset,p.z+.40,p.y+.27)
    return f;
}
vec3 microscopeNormal(vec3 N,vec3 world,vec3 local,vec3 heightGradient){
    // Analytic chain rule: avoid screen-space differencing of high-frequency heights.
    vec3 dx=dFdx(world),dy=dFdy(world),r1=cross(dy,N),r2=cross(N,dx);
    float det=dot(dx,r1);
    float hx=dot(heightGradient,dFdx(local)),hy=dot(heightGradient,dFdy(local));
    vec3 slope=sign(det)*(hx*r1+hy*r2)/max(abs(det),1e-12);
    slope*=min(1.,.95/max(length(slope),1e-12));
    return normalize(N-slope);
}
