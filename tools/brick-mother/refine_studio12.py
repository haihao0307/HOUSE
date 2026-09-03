"""Finalize generated studio and refresh the exact-page release fingerprint."""
from pathlib import Path
import sys,re,json,hashlib
root=Path(sys.argv[1]);page=root/'studio.html';text=page.read_text()
def change(a,b):
 global text
 assert a in text,a[:100]
 text=text.replace(a,b)
start=text.index('void deriveMaterial(');end=text.index('\nvoid main(){',start)
shader=text[start:end]
shader=re.sub(r'\bpatch\b','patchField',shader)
shader=re.sub(r'\bevent\b','surfaceEvent',shader)
text=text[:start]+shader+text[end:]
# Independent, rotated frequencies avoid a broad single-grid mottling pattern.
change('float broad=valueNoise(q*.88),patchField=valueNoise(q*2.8+vec3(6.2,1.8,9.4));','float broad=.58*valueNoise(q*.88)+.28*valueNoise(q.yzx*1.93+13.7)+.14*valueNoise(q.zxy*4.17-7.3),patchField=.64*valueNoise(q*2.8+vec3(6.2,1.8,9.4))+.36*valueNoise(q.zxy*6.3-7.1);')
change('mid=vec3(.58,.275,.175);pale=vec3(.73,.47,.32);oxide=vec3(.38,.35,.31);','mid=vec3(.50,.235,.145);pale=vec3(.62,.36,.225);oxide=vec3(.30,.285,.26);')
change('pale=vec3(.72,.69,.60);oxide=vec3(.53,.395,.265);','pale=vec3(.61,.60,.555);oxide=vec3(.45,.37,.29);')
change('smoothstep(.50,.8,patchField)*.48','smoothstep(.47,.78,patchField)*.28')
change('float meso=valueNoise(s*9.0),grain=valueNoise(s*37.0),micro=valueNoise(s*91.0);','float meso=.63*valueNoise(s*9.0)+.37*valueNoise(s.yzx*17.9+4.2),grain=valueNoise(s*47.0),micro=valueNoise(s.zxy*113.0+8.1);')
change('heightLow=(meso-.5)*.037+(patchField-.5)*.018-pit*.018;','heightLow=(meso-.5)*.064+(patchField-.5)*.012-pit*.035;')
change('heightHigh=(grain-.5)*.011*mix(.32,1.0,grainGate)+(micro-.5)*.003;','heightHigh=(grain-.5)*.024*mix(.52,1.0,grainGate)+(micro-.5)*.008;')
change('N=perturb(N,heightHigh,mix(.04,.23,uRelief));','N=perturb(N,heightHigh,mix(.20,.75,uRelief));')
change('amp=(family===5?.004:.023)*controls.relief*scale','amp=(family===5?.007:.070)*controls.relief*scale')
# Displace subdivided stone faces, leaving the stable bearing contact unchanged.
change('d=detailMesh(d,actualSeed,family,controls,scale);','if(family>=2&&family<=4)d=refineFaces(d,2);d=detailMesh(d,actualSeed,family,controls,scale);')
marker='function detailMesh(d,seed,family,controls,scale)'
subdivide="""function refineFaces(d,levels){
 for(let level=0;level<levels;level++){
  const idx=d.indices||Array.from({length:d.positions.length/3},(_,i)=>i),p=[],n=[],s=[];
  const vertex=i=>({p:Array.from(d.positions.slice(i*3,i*3+3)),n:Array.from(d.normals.slice(i*3,i*3+3)),s:d.surface?Array.from(d.surface.slice(i*4,i*4+4)):[0,0,0,0]});
  const mid=(a,b)=>{const v={p:a.p.map((x,i)=>(x+b.p[i])/2),n:a.n.map((x,i)=>(x+b.n[i])/2),s:a.s.map((x,i)=>(x+b.s[i])/2)};const l=Math.hypot(...v.n)||1;v.n=v.n.map(x=>x/l);return v;};
  const tri=(a,b,c)=>{for(const v of[a,b,c]){p.push(...v.p);n.push(...v.n);s.push(...v.s);}};
  for(let i=0;i<idx.length;i+=3){const a=vertex(idx[i]),b=vertex(idx[i+1]),c=vertex(idx[i+2]),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);tri(a,ab,ca);tri(ab,b,bc);tri(ca,bc,c);tri(ab,bc,ca);}
  d={positions:new Float32Array(p),normals:new Float32Array(n),surface:new Float32Array(s),sourceGrammar:d.sourceGrammar};
 }
 return d;
}
"""
change(marker,subdivide+marker)
# Eliminate orthographic shadow-frustum seams from the infinite presentation backdrop.
change('float sh=shadowPCF(N,normalize(uKeyDir));bg*=mix(1.0,.54+.46*sh,floorMask);','vec2 q0=(vWorld.xz-vec2(-.42,0))/vec2(1.9,1.55),q1=(vWorld.xz-vec2(2.02,-1.34))/vec2(.8,.7),q2=(vWorld.xz-vec2(2.92,.02))/vec2(.8,.7),q3=(vWorld.xz-vec2(2,1.38))/vec2(.8,.7);float contactShade=.18*exp(-dot(q0,q0)*2.0)+.10*exp(-dot(q1,q1)*2.5)+.10*exp(-dot(q2,q2)*2.5)+.10*exp(-dot(q3,q3)*2.5);bg*=1.0-floorMask*contactShade;')
change('vec3(.10,.117,.137),vec3(.22,.235,.245)','vec3(.085,.10,.12),vec3(.15,.17,.185)')
change('srgbToLinear(vec3(.42,.435,.45))','srgbToLinear(vec3(.29,.315,.34))')
change('col*uExposure*1.72','col*uExposure*1.35')
# Keep all four samples in the default frame, including the foreground mini.
text=text.replace('radius:7.72','radius:9.5').replace('goalRadius:7.72','goalRadius:9.5').replace('camera.goalRadius=7.72','camera.goalRadius=9.5')
text=text.replace('target:[.38,-.22,0]','target:[.6,-.68,0]').replace('goalTarget:[.38,-.22,0]','goalTarget:[.6,-.68,0]').replace('camera.goalTarget=[.38,-.22,0]','camera.goalTarget=[.6,-.68,0]')
change("function togglePlay(){state.playing=!state.playing;","function togglePlay(){state.playing=!state.playing;state.freeze=false;invalidate();")
change("state.rainPulse=1;state.playing=true;","state.rainPulse=1;state.playing=true;state.freeze=false;invalidate();")
change("function hide(){if(held)return;","function hide(){if(held){clearTimeout(timer);timer=setTimeout(hide,800);return;}")
change("document.getElementById('hidePanels').onclick=hide;","document.getElementById('hidePanels').onclick=()=>{held=false;clearTimeout(timer);hide();};")
change("document.addEventListener('pointerup',()=>{held=false;});", "document.addEventListener('pointerup',()=>{held=false;},true);document.addEventListener('pointercancel',()=>{held=false;},true);")
# Expose real scheduler state for debugging, without falsifying readiness flags.
change('window.__BRICK_MOTHER_WEATHERING_PBR__={invalidate,camera,','window.__BRICK_MOTHER_WEATHERING_PBR__={getRenderDiagnostics:()=>({pendingFrame,renderCount,hidden:document.hidden,playing:state.playing,freeze:state.freeze,simTime:state.simTime}),invalidate,camera,')
page.write_text(text)
manifest_path=root/'STUDIO_BUILD.json';manifest=json.loads(manifest_path.read_text())
for name in manifest['files']:
 data=(root/name).read_bytes();manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
manifest['presentationChanges']=['matte cap normals','smooth backdrop without frustum seam','irregular microrelief','whole group framing','explicit resume invalidation']
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Finalized studio',manifest['files']['studio.html'])
