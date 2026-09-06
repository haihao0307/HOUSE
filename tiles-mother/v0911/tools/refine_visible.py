"""One-time visible refinement. Current source files remain the rebuild authority."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'source/field_geometry.js';s=p.read_text()
if 'fieldRaggedRim' not in s:
 s=s.replace('const radius=g.userData.radius,radial=g.userData.radial,ringCount=8;', '''const radius=g.userData.radius,radial=g.userData.radial,ringCount=8;
 const fieldRaggedRim=(theta,seed)=>.28*Math.sin(theta*3+seed*.13)+.72*Math.pow(.5+.5*Math.sin(theta*7+seed*.17),5)-.15;
 const ends=broken.map(part=>{const ix=oldI[part.start]*3;return {part,cx:P[ix],cy:P[ix+1],cz:P[ix+2],sign:part.name==='end'?1:-1};});
 const fieldAmp=Math.min(radius*.62,.027,...ends.flatMap(a=>ends.filter(b=>Math.abs(a.cz-b.cz)>1e-7).map(b=>Math.abs(a.cz-b.cz)*.30)));
 // Move duplicated shell/end boundary vertices together. Original intact ends stay flat.
 for(const e of ends)for(let j=0;j<P.length;j+=3)if(Math.abs(P[j+2]-e.cz)<1e-7){
  const theta=Math.atan2(P[j+1]-e.cy,P[j]-e.cx),rho=Math.min(1,Math.hypot(P[j]-e.cx,P[j+1]-e.cy)/radius);
  P[j+2]+=e.sign*fieldAmp*rho*fieldRaggedRim(theta,seed);
 }''')
 s=s.replace("cz=P[centre*3+2],end=part.name==='end'", "cz=ends.find(e=>e.part===part).cz,end=part.name==='end'")
 s=s.replace('ring=[[]],amp=Math.min(radius*.22,.014);','ring=[[]],amp=fieldAmp;')
 s=s.replace('const z=cz+sign*amp*(1-rho*rho)*splinter;', 'const z=lerp(cz,P[a*3+2],rho*rho)+sign*amp*(1-rho*rho)*splinter;')
 s=s.replace('// Zero at the shell rim: watertight boundary, signed depth along fibre axis.', '// Match the moved shell rim exactly, with signed depth along the fibre axis.')
 s=s.replace('(both?2.75:1.95)', '(both?2.15:1.40)')
 p.write_text(s)
p=root/'source/wave_material.js';s=p.read_text()
if 'waveFootprint' not in s:
 s=s.replace('vec4 low=wn(p*11.+id),middle=wn(p*55.+id+vec3(11.,7.,3.)),fine=wn(p*245.+id+27.),grain=wn(p*2100.+id+41.);', '''float waveFootprint=max(length(dFdx(p)),length(dFdy(p)));
 float wf=1.-smoothstep(.25,.90,waveFootprint*245.),wgf=1.-smoothstep(.20,.75,waveFootprint*2100.);
 vec4 low=wn(p*11.+id),middle=wn(p*55.+id+vec3(11.,7.,3.)),fine=vec4(.5,0,0,0),grain=vec4(.5,0,0,0);
 if(wf>.001){fine=wn(p*245.+id+27.);fine=vec4(mix(.5,fine.x,wf),fine.yzw*wf);}
 if(wgf>.001){grain=wn(p*2100.+id+41.);grain=vec4(mix(.5,grain.x,wgf),grain.yzw*wgf);}''')
 s=s.replace('warm*.52*waveControl.x','warm*.32*waveControl.x').replace('ash*.48*waveControl.x','ash*.32*waveControl.x')
 s=s.replace('(fine.x-.5)*.060+(grain.x-.5)*.039','(fine.x-.5)*.035+(grain.x-.5)*.022')
 s=s.replace('vec3 poreGrad=delta/max(rr,.001)*pore*.42;','float wp=1.-smoothstep(.20,.70,waveFootprint*680.);pore*=wp;lip*=wp;vec3 poreGrad=delta/max(rr,.001)*pore*.42;')
 s=s.replace('float stripe=smoothstep(.91,.998,band)*smoothstep(.43,.72,fine.x)*waveControl.y;', 'float stripe=smoothstep(.91,.998,band)*smoothstep(.43,.72,fine.x)*waveControl.y*(1.-smoothstep(.20,.70,waveFootprint*760.));')
 s=s.replace('m.userData.wave=true;', 'm.userData.wave=true;m.userData.waveKind=kind;')
 s=s.replace("fieldTileDemand('pan',state.year,state.seed,state.rainInput,state.loadFactor)", "fieldTileDemand(m.userData.waveKind||'pan',state.year,state.seed,state.rainInput,state.loadFactor)")
 s=s.replace('function waveUpdateAll(){for(const m of materialCache.values())waveUpdateMaterial(m);perfRequest();}', "function waveUpdateAll(){for(const m of materialCache.values())waveUpdateMaterial(m);if(waveWoodMaterials)for(const m of waveWoodMaterials)m.userData.woodExposure.value=state.care==='abandoned'?1-Math.exp(-state.year*.17*state.rainInput):.08;perfRequest();}")
 needle="const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0,envMapIntensity:.40});\n m.onBeforeCompile=s=>{"
 s=s.replace(needle, "const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0,envMapIntensity:.40});m.userData.woodExposure={value:state.care==='abandoned'?1-Math.exp(-state.year*.17*state.rainInput):.08};\n m.onBeforeCompile=s=>{s.uniforms.woodExposure=m.userData.woodExposure;")
 s=s.replace("'#include <common>\\nvarying vec3 woodP;\\n'+waveNoiseGLSL", "'#include <common>\\nvarying vec3 woodP;uniform float woodExposure;\\n'+waveNoiseGLSL")
 s=s.replace("diffuseColor.rgb*=streak${end?'+.08*rings':''};", """diffuseColor.rgb*=streak${end?'+.08*rings':''};
${end?'':`vec4 weather=wn(vec3(woodP.xy*38.,woodP.z*7.)+13.);float groove=pow(.5+.5*sin(woodP.x*390.+woodP.y*470.+fib.x*3.),28.)*smoothstep(.32,.65,weather.x);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.115,.111,.098),woodExposure*(.32+.25*weather.x));diffuseColor.rgb*=1.-groove*woodExposure*.42;`} """)
 p.write_text(s)
p=root/'source/field_ui.js';s=p.read_text()
if 'wave-selected' not in s:
 s=s.replace("$('#mossSwitch').classList.toggle('active',state.mossEnabled);", "$('#mossSwitch').classList.toggle('active',state.mossEnabled);document.body.classList.toggle('wave-selected',state.waveSurface);if(state.waveSurface)$$('[data-study]').forEach(b=>b.classList.remove('active')); ")
 p.write_text(s)
print('visible refinements applied; normal rebuild reads the resulting source files')
