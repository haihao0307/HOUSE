// User-taught Macroscopic microscope core 01/02; NOT a standalone renderer.
// Source and unverified rotation-node boundary: SOURCE_AND_SCOPE.json.
// Call in stable material coordinates; time is frozen by the tile adapter.
struct MicroscopeField { float value; vec3 gradient; };
MicroscopeField microscopeCore(vec3 q, float time, int levels, vec3 pixelSpanXi) {
    MicroscopeField result;
    result.value=0.0; result.gradient=vec3(0.0);
    float radius=length(q), radialXY2=dot(q.xy,q.xy);
    // Singular points must be excluded by a verified caller domain. Not noise-filled.
    if(radius<=1e-8 || radialXY2<=1e-16) return result;
    vec3 xi=vec3(log2(radius)-2.0-0.3*time,-q.z/radius,atan(q.x,q.y));
    vec3 gradXi=vec3(0.0);
    float scale=1.0;
    for(int j=0;j<17;j++) {
        if(j>=levels)break;
        // Filtering is a DISPLAY adapter. With pixelSpanXi=0 all weights are exactly 1.
        float phaseSpan=max(pixelSpanXi.x,max(pixelSpanXi.y,pixelSpanXi.z))*scale;
        float weight=1.0-smoothstep(0.35,0.95,phaseSpan);
        vec3 phase=xi*scale,c=cos(phase),sn=sin(phase);
        float argument=dot(c.zyy,c.xyx);
        result.value+=weight*cos(argument)/scale;
        float factor=weight*sin(argument);
        gradXi+=factor*vec3(sn.x*(c.z+c.y),sn.y*(2.0*c.y+c.x),sn.z*c.x);
        scale+=scale;
    }
    vec3 J0=q/(radius*radius*log(2.0));
    vec3 J1=q.z*q/(radius*radius*radius)-vec3(0.0,0.0,1.0/radius);
    vec3 J2=vec3(q.y,-q.x,0.0)/radialXY2;
    result.gradient=gradXi.x*J0+gradXi.y*J1+gradXi.z*J2;
    return result;
}
vec3 microscopePbrNormal(vec3 originalNormal, vec3 localGradient, float amplitude, float maxSlope) {
    vec3 n=normalize(originalNormal);
    vec3 slope=(localGradient-n*dot(localGradient,n))*amplitude;
    slope*=min(1.0,maxSlope/max(length(slope),1e-10));
    return normalize(n-slope);
}
struct MicroscopePBR { vec3 baseColor; vec3 normal; float roughness; float height; };
MicroscopePBR microscopeApplyPBR(
    vec3 existingBaseColor, vec3 existingNormal, float existingRoughness,
    MicroscopeField field, vec4 gains, float referenceValue, float maxSlope) {
    MicroscopePBR m;
    m.baseColor=existingBaseColor; m.normal=existingNormal;
    m.roughness=existingRoughness; m.height=0.0;
    if(gains.x<=0.0)return m;
    float centered=field.value-referenceValue;
    m.height=centered*gains.x*gains.y;
    // field.gradient must already be in the same coordinates as existingNormal.
    m.normal=microscopePbrNormal(existingNormal,field.gradient,gains.x*gains.y,maxSlope);
    float colorDelta=clamp(centered*gains.x*gains.z,-0.10,0.10);
    m.baseColor=clamp(existingBaseColor*(1.0+colorDelta),0.0,1.0);
    m.roughness=clamp(existingRoughness+centered*gains.x*gains.w,0.04,1.0);
    return m;
}
