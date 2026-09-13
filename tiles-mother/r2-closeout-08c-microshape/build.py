from pathlib import Path
import re,json,hashlib,subprocess
H=Path(__file__).resolve().parent
b=(H.parent/'r2-closeout-08b-microscope/START_HERE.html').read_text()
h=b
def replace(a,c,count=1):
 global h
 assert h.count(a)==count,(a[:90],h.count(a),count)
 h=h.replace(a,c)
replace('vertex(p,skin=1,tag=0){','vertex(p,skin=1,tag=0,q=0,u=0){')
replace('this.meta.push(skin,tag);','this.meta.push(skin,tag,q,u);')
replace('nu=28,nv=14','nu=40,nv=40')
replace('G.vertex(point(2*i/nu-1,j/nv,q),1,tag)','G.vertex(point(2*i/nu-1,j/nv,q),1,tag,q,2*i/nu-1)')
replace('G.vertex(point(u,v,q),cut?0:.78,tag)','G.vertex(point(u,v,q),cut?0:.78,tag,q,u)')
replace('attr(mesh.meta,2,2)','attr(mesh.meta,2,4)')
replace('in vec2 aMeta;','in vec4 aMeta;',2)
replace('handmadeOffset(aPosition,aMeta,aState.x)','handmadeOffset(aPosition,aMeta.xy,aState.x)',2)
# handmade finite derivative references also need .xy
h=h.replace('aMeta,aState.x','aMeta.xy,aState.x')
shape=(H/'microshape.glsl').read_text()
replace('void main(){\n vec3 local=aPosition,localN=aNormal;',shape+'\nvoid main(){\n vec3 local=aPosition,localN=aNormal;')
replace('vec3 off=handmadeOffset(aPosition,aMeta.xy,aState.x);local+=off;','vec3 off=handmadeOffset(aPosition,aMeta.xy,aState.x);local+=off+microshape(aPosition,aMeta,aState.x);')
replace('float sy=sign(aNormal.y);localN=', 'dx+=(microshape(aPosition+vec3(e,0,0),aMeta,aState.x).y-microshape(aPosition-vec3(e,0,0),aMeta,aState.x).y)/(2.*e);\n     dz+=(microshape(aPosition+vec3(0,0,e),aMeta,aState.x).y-microshape(aPosition-vec3(0,0,e),aMeta,aState.x).y)/(2.*e);\n     float sy=sign(aNormal.y);localN=')
replace('vLocal=local;','vLocal=aPosition+handmadeOffset(aPosition,aMeta.xy,aState.x);')
replace('vMeta=aMeta;','vMeta=aMeta.xy;')
replace('void main(){vec3 local=aPosition;',shape+'\nvoid main(){vec3 local=aPosition;')
replace('local+=handmadeOffset(aPosition,aMeta.xy,aState.x);gl_Position','local+=handmadeOffset(aPosition,aMeta.xy,aState.x)+microshape(aPosition,aMeta,aState.x);gl_Position')
replace("this.depthLoc=gl.getUniformLocation(this.depthProgram,'uLightVP');", "this.depthMicroLoc=gl.getUniformLocation(this.depthProgram,'uMicroscope');this.depthLoc=gl.getUniformLocation(this.depthProgram,'uLightVP');")
replace('g.useProgram(this.depthProgram);','g.useProgram(this.depthProgram);g.uniform4fv(this.depthMicroLoc,[settings.micStrength,settings.micScale,settings.micColor,settings.micRough]);')
replace('function option(k,value){settings[k]=value;',"function option(k,value){settings[k]=value;if(k==='micStrength'||k==='micScale')renderer.shadowDirty=true;")
# Independent PBR control area, using actual observed tonal families as a guide.
start=h.index('<section id="microscopeControls"');end=h.index('<h3>瓦色与失养</h3>',start)
controls=(H.parent/'r2-closeout-08b-microscope/microscope-controls.html').read_text()
controls=controls.replace('Microscope · PBR','Microscope · 微形态').replace('只调瓦面，不改变形状、尺寸和搭接。','瓦面微起伏与前口微不齐；支承边和底面保持。')
cs=controls.index('<div class="row"><label for="micColor">');ce=controls.index('<div class="presets">',cs)
color=controls[cs:ce]
controls=controls[:cs]+controls[ce:]
controls+='\n<section id="pbrControls" aria-label="PBR 色彩"><h3>PBR · 色彩与反光</h3><p class="tiny">讲武堂资料中的暖灰、灰褐与少量冷灰，保留原灰青基调。</p>'+color+'<div class="presets"><button id="pbrToggle">色彩：开</button><button id="pbrReset">恢复色彩</button></div></section>'
h=h[:start]+controls+h[end:]
replace("for(const [k,v] of Object.entries(MIC_DEFAULTS))option(k,v);","for(const k of ['micStrength','micScale'])option(k,MIC_DEFAULTS[k]);")
replace('function initMicroscopeControls(){',"let lastPbrColor=.30;\nfunction initMicroscopeControls(){\n $('#pbrToggle').onclick=()=>{if(settings.micColor>0){lastPbrColor=settings.micColor;option('micColor',0);}else option('micColor',lastPbrColor||.3);refreshMicroscope();};\n $('#pbrReset').onclick=()=>{option('micColor',.3);option('micRough',.3);refreshMicroscope();};")
replace("$('#micToggle').textContent=settings.micStrength>0?", "$('#pbrToggle').textContent=settings.micColor>0?'色彩：开':'色彩：关';\n $('#pbrToggle').setAttribute('aria-pressed',String(settings.micColor>0));\n $('#micToggle').textContent=settings.micStrength>0?")
replace('float colorVariation=clamp(micro.value*.15,-.12,.12)*uMicroscope.z;', '''// Observed UV-weighted warm/neutral/cool fractions: .5600/.3252/.1148.
   // These guide the tonal family ordering, not a claim of exact rendered ratios.
   float family=clamp(.5+micro.value*.30,0.,1.);
   vec3 warmGrey=vec3(.102,.082,.067),neutralGrey=vec3(.092,.089,.083),coolGrey=vec3(.075,.088,.096);
   vec3 evidenceTone=mix(warmGrey,neutralGrey,smoothstep(.46,.66,family));
   evidenceTone=mix(evidenceTone,coolGrey,smoothstep(.83,.94,family));
   body=mix(body,evidenceTone*(.80+.40*individual),uMicroscope.z*.65);
   float colorVariation=clamp(micro.value*.25,-.20,.20)*uMicroscope.z;''')
h=h.replace('08B','08C').replace('08b-microscope','08c-microshape').replace('08C-microscope-pbr','08C-microshape-pbr')
h=h.replace('瓦面仅使用 Microscope 多尺度场接入现有 PBR','Microscope 同时驱动微形态与现有 PBR')
(H/'START_HERE.html').write_text(h)
(H/'syntax.js').write_text(re.search(r'<script>(.*?)</script>',h,re.S)[1]);subprocess.run(['node','--check',str(H/'syntax.js')],check=True);(H/'syntax.js').unlink()
report={'version':'08C','baseSHA256':hashlib.sha256(b.encode()).hexdigest(),'outputSHA256':hashlib.sha256(h.encode()).hexdigest(),'bytes':len(h.encode()),'geometryDisplaced':True,'visualApproved':False,'productionApproved':False,'browserVerified':False}
(H/'BUILD_QA.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
