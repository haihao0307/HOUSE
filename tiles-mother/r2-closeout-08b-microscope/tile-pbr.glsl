 if(uType==0){
   MicroSurface micro=microscopeSurface(p,seed);
   float skin=smoothstep(.05,.92,vMeta.x);
   float individual=clamp(.50+(tint-.5)*uColor.z,0.,1.);
   float kilnDelta=(tint-.5)*uColor.z;
   // Preserve the existing cool-grey tile palette and stable whole-tile differences.
   vec3 body=mix(vec3(.050,.064,.071),vec3(.142,.151,.149),individual);
   body=mix(body,vec3(.238,.229,.204),uSurface.z*.18);
   body*=1.+.18*kilnDelta;
   body+=vec3(-.008,-.002,.009)*kilnDelta;
   // The SAME Microscope field feeds PBR. No strokes, rings, colony or pore masks.
   float colorVariation=clamp(micro.value*.15,-.12,.12)*uMicroscope.z;
   body*=1.+colorVariation;
   body+=vec3(.010,.002,-.006)*clamp(micro.value,-1.,1.)*uMicroscope.z*uSurface.y;
   body*=vec3(1.+.13*uColor.y,1.+.015*uColor.y,1.-.14*uColor.y)*uColor.x;
   vec3 core=mix(vec3(.245,.182,.102),vec3(.38,.245,.102),uColor.w)*(.98+micro.fine*.10);
   base=mix(core,body,skin);
   rough=clamp(.855+micro.fine*uMicroscope.w*.60,.69,.985);
   rough*=1.-uSurface.w*.16;base*=1.-uSurface.w*.15;
   if(uDiagnostic!=1 && uMicroscope.x>0.)
     N=microscopeNormal(N,vWorld,p,micro.gradient*(.0012*uMicroscope.x));
   // Existing year-dependent damage is retained, not used as an intact-surface pattern.
   float crack=ceramicCrack(p.xz,fract(seed*.73),damage,fp);
   base=mix(base,vec3(.026,.027,.022),crack*.82);
   height=-crack*.00038*uSurface.x;
   ao=1.-crack*.25;
   // Keep the established moss exposure/age mechanism; only its carrier material changed.
   if(uBio.x>.001&&vMeta.x>.6&&vState.w>.015){
     float env=clamp(vState.w,0.,1.);
     float broad=clamp(.5+micro.value*.22,0.,1.);
     float fine=clamp(.5+micro.fine*2.,0.,1.);
     float bioColony=.50*env+.50*broad;
     float edge=.90-.34*uBio.x;
     float cover=smoothstep(edge-.06,edge+.06,bioColony)*smoothstep(-.10,.38,N.y);
     vec3 moss=mix(vec3(.026,.035,.010),vec3(.110,.125,.040),broad*.65+fine*.35);
     base=mix(base,moss,cover*.94);rough=mix(rough,.98,cover);ao*=1.-cover*.08;
   }
 }
