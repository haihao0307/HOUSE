from pathlib import Path
import re
H=Path(__file__).parent
# Immutable input: the accepted 09D geometry and assembly.
h=(H.parent/'tiles-mother-09d-material-fit-20261024/START_HERE.html').read_text(encoding='utf8')
old="curves:t.curves.map(c=>({...c,points:c.points.map(p=>[p[0],p[1]+cy])}))"
new="""curves:t.curves.map(c=>({...c,points:c.points.map(p=>{let x=mix(xmin,xmax,clamp((p[0]-omin)/(omax-omin))),s=section(t.outline,p[0]),u=clamp((p[1]-s[0])/Math.max(1e-8,s[1]-s[0])),j=0;while(j<xs.length-2&&xs[j+1]<x)j++;let a=clamp((x-xs[j])/(xs[j+1]-xs[j])),lo=mix(bottom[j][1],bottom[j+1][1],a),hi=mix(top[j][1],top[j+1][1],a);return[x,mix(lo,hi,u)]})}))"""
assert old in h
h=h.replace(old,new).replace('source interior motif translated without arbitrary new motifs','09D outline frozen; retained source motif warped by cross-section fractions to the full face')
a=h.index('   // Axial wood recipe:');b=h.index('\n else if(uType==2)',a)
h=h[:a]+'''   // 09E: bounded coordinates avoid large-seed float quantization.
   // p.z follows each member axis / curved-member arc length in metres.
   float identity=tileIdentity(vState.x);
   vec3 w=p+vec3(identity*.13,identity*.09,identity*.23);
   w.xy+=vec2(.004*sin(p.z*1.7+identity*6.),.003*sin(p.z*2.3+1.2));
   float broad=n3(vec3(w.xy*21.,w.z*.65));
   float streak=n3(vec3(w.xy*112.,w.z*1.9));
   float fibre=n3(vec3(w.xy*430.,w.z*6.));
   float warp=n3(vec3(w.xy*43.,w.z*1.1));
   float rings=length(w.xy-vec2(.013,-.018))*690.+warp*3.8;
   float ringMask=pow(.5+.5*sin(rings),7.)*band(fp,110.);
   float longCrack=smoothstep(.67,.88,n3(vec3(w.xy*165.,w.z*2.1)))*band(fp,150.);
   MicroSurface grainMicro=microscopeSurface(vec3(w.x,w.y,w.z*.045),31.);
   float grain=clamp(.5+grainMicro.value*.55,0.,1.);
   float tone=clamp(.12+.48*broad+.30*streak+.10*grain,0.,1.);
   base=mix(vec3(.050,.026,.011),vec3(.235,.167,.082),tone);
   base*=mix(.83,1.16,identity)*(1.-.22*ringMask-.25*longCrack);
   float weather=clamp(uSurface.z*.65,0.,1.);
   base=mix(base,base*vec3(.88,.98,1.14),weather);
   height=((fibre-.5)*.00032*band(fp,410.)-ringMask*.00019-longCrack*.00032+grainMicro.value*.00020*uMicroscope.x)*uSurface.x;
   rough=clamp(.84+.12*grain+.035*longCrack,.82,.99);
   if(v_surfaceClass>.5&&v_surfaceClass<2.5){float endRings=.5+.5*sin(length(w.xy)*940.+warp*3.);base=mix(vec3(.105,.060,.025),vec3(.24,.16,.074),.35+.5*endRings);height=(endRings-.5)*.00016;rough=.96;}
   ao=1.-longCrack*.18;base*=uColor.x;
 }
'''+h[b:]
a=h.index('function wood09Macro(p){');b=h.index('\nfunction woodMesh(',a)
h=h[:a]+'''function wood09Macro(p){
 const w=[p[1]+.004*Math.sin(p[0]*1.7),p[2]+.003*Math.sin(p[0]*2.3+1.2),p[0]*.045];
 return Math.max(-.00045,Math.min(.00045,tileBand(w,31,24*settings.micScale,.003)*.00030*settings.micStrength));
}
'''+h[b:]
h=h.replace("let key=r+'/'+l;if(WOOD_CACHE", "let key=[r,l,settings.micScale,settings.micStrength].join('/');if(WOOD_CACHE")
h=h.replace('restored 09/08D axial recipe; R03 snapshot retained separately','09E axial multiscale grain; original brown palette family; revised display material')
h=h.replace('09 colour macro simplex field along original face normals, maximum 0.275 mm; 12 mm end/joint fade','09E anisotropic Microscope field, bounded 0.45 mm; 12 mm end/joint fade')
h=h.replace('09D','09E')
h=h.replace('原版木色 / 顺纹圆梁 · 滴水满口 · 砖肌理','连续木纹 / 自然色差 · 滴水满面纹饰')
h=h.replace('09E恢复08D木材配方与种子；木纹随构件长轴。','09E按整屋和近景尺度重调木材：长轴连续纹理、缓慢弯曲、构件色差及Microscope细部。属于显示材料调整，并非实物材种鉴定。')
h=h.replace('09E按用户要求调整滴水外轮廓，使上缘与板瓦完整前口相接，覆盖两端厚度；内部纹饰保留原图。新轮廓属于本次适配，非实物测绘结论。','09E保留09D已确认的滴水外形；把已有纹饰按新边界连续适配到整个正面，不另造图案。轮廓和纹饰适配不是实物测绘结论。')
(H/'START_HERE.html').write_text(h,encoding='utf8')
print('09E built',len(h))
