from pathlib import Path
import re
H=Path(__file__).parent
original=Path('G:/HOUSE/tiles-mother-measured-09-20261024')
# Keep the original 09 builder intact; use its source tracing and then repair the renderer.
exec((H/'build_study.py').read_text(encoding='utf-8'))
h=(H/'START_HERE.html').read_text(encoding='utf-8')
wood=(H/'vendor/timber-original.mjs').read_text(encoding='utf-8')
wood=wood.replace('export {','return {')
wood='const TimberOriginal=(()=>{\n'+wood+'\n})();\n'
receiver=(H/'vendor/wood-receiver-source.mjs').read_text(encoding='utf-8')
cpu=receiver[receiver.index('function vertexHash'):receiver.index('function originalUniforms')]
cpu=re.sub(r'export function woodMacroHeight[\s\S]*?\n}', '',cpu)
cpu=cpu.replace('function macroHeight(', 'function woodMacro(').replace('p.map(fract).map(smooth)','p.map(fract).map(x=>smooth(0,1,x))')
q=Path('G:/HOUSE/tiles-mother-08d-20260914/qa_geometry.cjs').read_text(encoding='utf-8')
hand=q[q.index('function hand('):q.index('const source=')]
hand=hand.replace('function hand(','function tileHand(').replace('function band(','function tileBand(').replace('function micro(','function tileMicro(').replace('band(p,','tileBand(p,').replace('A.clamp','clamp')
hand='const fract=x=>x-Math.floor(x),handHash=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453123);\n'+hand
contact=Path('G:/HOUSE/tiles-mother-08d-20260914/contact-lib.cjs').read_text(encoding='utf-8')
contact=contact[contact.index('function triangles('):contact.index('function gap(')].replace('A.M.transform','M.transform')
h=h.replace('function tilePoint(', 'function tilePoint08D(',1)
h=h.replace('let th=P.t*(1+.070',"let th=(kind==='cover'?mix(ACTIVE_COVER.t,ACTIVE_COVER.tn,smooth((ACTIVE_COVER.body-.002)/P.l,ACTIVE_COVER.body/P.l,t)):P.t)*(1+.070")
h=h.replace('function shellMesh(', 'function abandoned09Shell(',1)
h=h.replace('const $=s=>document.querySelector(s),canvas=',wood+cpu+hand+contact+(H/'repair.js').read_text(encoding='utf-8')+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace('micStrength:0,micScale:1','micStrength:1.6,micScale:1')
h=h.replace('<button id="shapePanel" hidden>','<button id="shapePanel">')
h=h.replace('#timeline,#fracture,#microscopeControls{','#timeline,#fracture{')
# CPU evaluates the same field once, including normals. The GPU must not displace it twice.
start=h.index(' if(uType==0 && aMeta.y>.5){',h.index('const VERT='))
end=h.index(' vec4 p=aModel',start)
h=h[:start]+h[end:]
h=h.replace('if(uType==0&&aMeta.y>.5)local+=handmadeOffset(aPosition,aMeta.xy,aState.x)+microshape(aPosition,aMeta,aState.x);','')
h=h.replace("if(k==='micStrength'||k==='micScale')renderer.shadowDirty=true;","if(k==='micStrength'||k==='micScale'){renderer.shadowDirty=true;return rebuild(false);}")
h=h.replace("function openControls(id){$('#panel').hidden=false;", "function openControls(id){$('#evidence').hidden=true;requestRender();$('#panel').hidden=false;")
h=h.replace("$('#settings').onclick=()=>{let p=$('#panel');", "$('#settings').onclick=()=>{$('#evidence').hidden=true;requestRender();let p=$('#panel');")
h=h.replace("ev.hidden=!ev.hidden;fit()", "ev.hidden=!ev.hidden;document.getElementById('panel').hidden=true;fit()")
# Preserve original material field code; connect its explicit grain reference frame.
frag=(H/'vendor/timber-original.mjs').read_text(encoding='utf-8')
decl=frag[frag.index('uniform vec3 u_cameraPosition'):frag.index('out vec4 outColor')]
func=frag[frag.index('const float PI'):frag.index('void main()',frag.index('const float PI'))]
evaluate=frag[frag.index('  vec3 baseColor = u_solidColor;'):frag.index('  vec3 normal = normalize(v_worldNormal);')]
evaluate+='\n ktColor=baseColor;ktRoughness=roughness;ktHeight=heightMeters;ktCavity=cavity;\n'
extra=decl+func+'\nvoid evaluateOriginalTimber(out vec3 ktColor,out float ktRoughness,out float ktHeight,out float ktCavity){'+evaluate+'}\n'
# Fragment's original varying names remain source-exact.
h=h.replace('layout(location=7) in vec4 aState;', 'layout(location=7) in vec4 aState;\nlayout(location=8) in vec3 aGrain;layout(location=9) in vec3 aGrainNormal;layout(location=10) in float aSurface;')
h=h.replace('out vec3 vWorld,vLocal,vNormal;','out vec3 vWorld,vLocal,vNormal;\nout vec3 v_grainPosition,v_localNormal,v_worldPosition;out float v_surfaceClass;')
h=h.replace('in vec3 vWorld,vLocal,vNormal;', 'in vec3 vWorld,vLocal,vNormal;\nin vec3 v_grainPosition,v_localNormal,v_worldPosition;in float v_surfaceClass;')
h=h.replace(' vWorld=p.xyz;', ' v_grainPosition=aGrain;v_localNormal=aGrainNormal;v_surfaceClass=aSurface;v_worldPosition=p.xyz;\n vWorld=p.xyz;')
h=h.replace(' vLocal=aPosition;', ' vLocal=(uType==0&&aMeta.y>.5)?aGrain:aPosition;')
h=h.replace('uint hashU(ivec3 p){',extra+'\nuint hashU(ivec3 p){')
start=h.index('   // Axial wood recipe:');end=h.index('\n }\n else if(uType==2)',start)
h=h[:start]+'   evaluateOriginalTimber(base,rough,height,ao);base*=uColor.x;\n'+h[end:]
h=h.replace('attr(mesh.meta,2,4);','attr(mesh.meta,2,4);if(type===1){attr(mesh.gp||mesh.p,8,3);attr(mesh.gn||mesh.n,9,3);attr(mesh.sc||new Float32Array(mesh.p.length/3),10,1);}else if(mesh.reference)attr(mesh.reference,8,3);')
h=h.replace('instances:instances.length,type,cast}', 'instances:instances.length,type,cast,wood:mesh.wood}')
h=h.replace('g.uniform1i(U.uType,m.type);g.bindVertexArray', 'g.uniform1i(U.uType,m.type);if(m.type===1)bindWood(g,this.program,m.wood,eye);g.bindVertexArray')
h=h.replace('09 ·','09A ·').replace("version:'09'","version:'09A'").replace('09 云南图纸重建研究版','09A 瓦面与木构修复版').replace('09-yunnan-source-study','09A-surface-contact-timber-repair')
h=h.replace('09A · 云南 / 图纸重建研究版','09A · 修复 / 瓦面 · 搭接 · 木构')
(H/'START_HERE.html').write_text(h,encoding='utf-8')
print('09A assembled',len(h))
