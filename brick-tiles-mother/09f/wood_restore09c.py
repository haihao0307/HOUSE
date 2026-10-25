"""09C build-time adapter. Run AFTER the ordinary 09C HTML build.

Only this opt-in script writes START_HERE.html when invoked by the integrator.
Restores the actual 09/08D axial field, NOT the different R03 warm preset.
Original material-master snapshot remains embedded and traceable, but inactive
for this restored finish. No historical artifact is edited.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent
SOURCE = Path('G:/HOUSE/tiles-mother-measured-09-20261024/START_HERE.html')
MARKER = '// WOOD_RESTORE_09C_AXIAL_V1'

CPU = r'''
// WOOD_RESTORE_09C_AXIAL_V1
// CPU port of 09's uint simplex field; geometry uses its SAME colour macro.
// Units metres; fixed material seed 31 matches the study's instance state.
// <=0.275 mm normal displacement; high frequency fibres remain fragment bump.
function wood09Noise(p){
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const sum=p.reduce((s,x)=>s+x,0)/3,ii=p.map(x=>Math.floor(x+sum)),t=ii.reduce((s,x)=>s+x,0)/6,x=p.map((a,i)=>a-ii[i]+t);
 const g=[x[0]>=x[1]?1:0,x[1]>=x[2]?1:0,x[2]>=x[0]?1:0],l=g.map(a=>1-a),i1=g.map((a,i)=>Math.min(a,l[(i+2)%3])),i2=g.map((a,i)=>Math.max(a,l[(i+2)%3]));
 function corner(v,k){let w=Math.max(.6-dot(v,v),0);w*=w;
  let h=(Math.imul(k[0],1597334677)^Math.imul(k[1],3812015801)^Math.imul(k[2],2798796415))>>>0;
  h=(h^(h>>>16))>>>0;h=Math.imul(h,2146121005)>>>0;h=(h^(h>>>15))>>>0;h=Math.imul(h,2221713035)>>>0;h=(h^(h>>>16))>>>0;h%=12;
  let a=(h&1)?-1:1,b=(h&2)?-1:1,n=h<4?[a,b,0]:h<8?[a,0,b]:[0,a,b];return w*w*dot(n,v);
 }
 const n=corner(x,ii)+corner(x.map((a,i)=>a-i1[i]+1/6),ii.map((a,i)=>a+i1[i]))+corner(x.map((a,i)=>a-i2[i]+1/3),ii.map((a,i)=>a+i2[i]))+corner(x.map(a=>a-.5),ii.map(a=>a+1));
 return Math.max(0,Math.min(1,.5+16*n));
}
function wood09Macro(p){
 const seed=31,angle=.92*.37*Math.sin(p[0]*11+seed*.17),c=Math.cos(angle),s=Math.sin(angle);
 // GLSL mat2(c,-s,s,c) is column-major, hence this sign convention.
 const q=[c*p[1]+s*p[2]+seed*.017,-s*p[1]+c*p[2]+seed*.023,p[0]+seed*.019];
 return (wood09Noise(q.map(a=>a*17.3))-.5)*.00055;
}
'''

def adapt(html: str) -> str:
    if MARKER in html:
        raise RuntimeError('Already restored; rebuild clean HTML first')
    source = SOURCE.read_text(encoding='utf-8')
    start = source.index('   // Axial wood recipe:')
    end = source.index('\n }\n else if(uType==2)', start)
    recipe = source[start:end]
    # Genuine cut surfaces, not the legacy generic-meta default of zero.
    recipe = recipe.replace('if(vMeta.x<.1)', 'if(v_surfaceClass>.5&&v_surfaceClass<2.5)')
    old = '   evaluateOriginalTimber(base,rough,height,ao);base*=uColor.x;'
    if html.count(old) != 1:
        raise RuntimeError('Wood fragment splice drift')
    html = html.replace(old, recipe)
    html = html.replace(' vec3 p=vLocal;\n float seed=vState.x,damage=vState.y,tint=vState.z;',
        ' vec3 p=uType==1?v_grainPosition.yzx:vLocal;\n float seed=uType==1?31.:vState.x,damage=vState.y,tint=vState.z;')
    # Freeze the original orientation at its initial value so geometry and
    # colour share precisely the same material field and coordinate frame.
    html = html.replace('float turn=uBio.z*.37*sin(p.z*11.0+seed*.17)', 'float turn=.92*.37*sin(p.z*11.0+seed*.17)')
    html = html.replace('let grainHeights=sampleWoodGrain(raw,round,radius),g=new Mesh();', 'let grainHeights=new Float32Array(raw.positions.length/3),g=new Mesh();')
    oldh = "let h=(woodMacro(gp,s,WOOD_PRESET,WOOD_FINISH)*2.2+(s===0?grainHeights[i/3]:0))*gate,r=Math.max(.001,Math.hypot(gp[1],gp[2])),d=turn([p[0],p[1]+gp[1]/r*h,p[2]+gp[2]/r*h]);d[1]+=lift;g.vertex(d);"
    newh = "let h=(s===0?wood09Macro(gp):0)*gate;grainHeights[i/3]=h;let d=turn(p.map((a,k)=>a+n[k]*h));d[1]+=lift;g.vertex(d);"
    if html.count(oldh) != 1:
        raise RuntimeError('Wood geometry splice drift')
    html = html.replace(oldh, newh)
    html = html.replace("material:'original PBR timber master / yunnan_warm_medium_v2',macroRelief:'original CPU macro x2.2 plus original GLSL coarse/medium grain sampled into geometry, 12 mm end/joint fade'", "material:'restored 09/08D axial recipe; R03 snapshot retained separately',macroRelief:'09 colour macro simplex field along original face normals, maximum 0.275 mm; 12 mm end/joint fade'")
    # Preserve original surface normals on smooth cylinder sides: finish(false)
    # derives geometric normals after displacement and retains hard cuts.
    html = html.replace('function woodMesh(raw,', CPU+'\nfunction woodMesh(raw,', 1)
    if 'vec3 p=uType==1?v_grainPosition.yzx:vLocal;' not in html:
        raise RuntimeError('Grain reference splice drift')
    return html

if __name__ == '__main__':
    target = ROOT/'START_HERE.html'
    output = adapt(target.read_text(encoding='utf-8'))
    target.write_text(output, encoding='utf-8')
    print('Restored 09 axial field; source SHA256:', hashlib.sha256(SOURCE.read_bytes()).hexdigest())
