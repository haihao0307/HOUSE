from pathlib import Path
import runpy,re,hashlib,json
H=Path(__file__).parent
runpy.run_path(str(H/'build09c.py'),run_name='__main__')
h=(H/'START_HERE.html').read_text(encoding='utf8')
# Restore the accepted specimen's seed as well as its recipe. Its axial offset is zero.
h=h.replace('uType==1?31.:vState.x','uType==1?314159.:vState.x').replace('const seed=31,angle=.92','const seed=314159,angle=.92')
h=h.replace('fixed material seed 31','original specimen seed 314159')
h=h.replace('minX=Math.min(minX,raw.positions[i]);maxX=Math.max(maxX,raw.positions[i]);','minX=Math.min(minX,raw.grainPositions[i]);maxX=Math.max(maxX,raw.grainPositions[i]);')
h=h.replace('Math.min(p[0]-minX,maxX-p[0])','Math.min(gp[0]-minX,maxX-gp[0])')
# Profiles retain their source coordinates, but fibre coordinates follow their long axis.
h=h.replace('function woodProfile(poly,depth){','function woodProfile09CLegacy(poly,depth){')
h=h.replace("woodProfile([...top,...bot].map(p),depth)","woodCurvedRound09D(top.map(([x,y])=>p([x,y+6.5])),top.map(([x,y])=>Math.abs(p([x,y])[1]-p([x,y+13])[1])/2))")
# Explicit circular column in figure 8 (label 柱径31); preserve the previous placement.
h=h.replace("block('you-chun-post-'+i,q[0],0,0,.19,p([x,164])[1]-.075,.19,1)","put('you-chun-post-'+i,woodRound(.155,p([x,164])[1]-.075),M.mul(M.translate(q[0],(p([x,164])[1]-.075)/2,0),M.rx(Math.PI/2)),1)")
h=h.replace("woodRound(.155,p([x,164])[1]-.075),M.mul(M.translate(q[0],(p([x,164])[1]-.075)/2,0)","woodRound(.155,p([x,164])[1]-.225),M.mul(M.translate(q[0],.15+(p([x,164])[1]-.225)/2,0)")
h=h.replace("block('you-chun-base-'+i,q[0],0,0,.28,.15,.28)","block('you-chun-base-'+i,q[0],0,0,.36,.15,.36)")
# No carrier narrowing: derive the new face upper boundary from the existing pan.
h=h.replace("body=shellMesh(kind,set),face=pressedMesh(id),P=", "body=shellMesh(kind,set),face=kind==='pan'?dripFace09D(id,body):pressedMesh(id),P=")
h=h.replace('t=SOURCE_CURVES[id];\n let centerY;',"t=kind==='pan'?face.fittedTrace:SOURCE_CURVES[id];\n let centerY;")
a=h.index("let centerY;if(kind==='pan')")
b=h.index('\n const outlineXs=',a)
h=h[:a]+"let centerY=kind==='pan'?0:undefined;"+h[b:]
a=h.index("if(kind==='pan'){\n   // The eave lip")
b=h.index('if(front)p[2]=z0;',a)
h=h[:a]+h[b:]
h=h.replace("'shared upper boundary with source drip; 24 mm continuous transition'","'09D face extends to complete actual pan cross-section, no carrier narrowing'")
h=h.replace("'both internal end caps removed in overlap; visible source silhouette preserved'","'both internal end caps removed; drip outer silhouette adapted to full pan lip by user request; internal motif retained'")
# Route masonry only; the type-zero bases of timber studies remain ordinary stone.
old="const block=(id,x,y,z,w,h,d,type=0,parent='world',conn=null)=>put(id,type===1?woodBox(w,h,d):boxMesh(w,h,d),M.translate(x,y,z),type,parent,conn);"
new="const block=(id,x,y,z,w,h,d,type=0,parent='world',conn=null)=>{let brick=type===0&&(e.family==='masonry'||/brick/.test(id));return put(id,type===1?woodBox(w,h,d):brick?brickMesh09D(w,h,d):boxMesh(w,h,d),M.translate(x,y,z),brick?7:type,parent,conn);};"
assert old in h
h=h.replace(old,new)
h=h.replace("connection=null)=>{let group=this.groups.get(id);", "connection=null)=>{if(type===0&&e.family==='masonry'&&g.definition?.kind==='box'){const d=g.definition;g=brickMesh09D(d.width_m,d.height_m,d.depth_m);type=7;}let group=this.groups.get(id);")
src=Path('G:/HOUSE/brick-mother-continuation-20260912/material-microscope-lab-r2-1/Brick_Material_Microscope_Lab_R2_1.html').read_text(encoding='utf8')
shader=src[src.index('float hash31('):src.index('float sdRoundBox(')]+src[src.index('float mmCell('):src.index('vec3 perturb(')]
for old,new in [('hash31','brHash'),('noise3','brNoise'),('fbm','brFbm'),('mmCell','brCell'),('microscope','brMicroscope'),('processMaterial','brMaterial'),('Mat','BrMat')]:
    shader=re.sub(r'\b'+old+r'\b',new,shader)
shader=shader.replace('uMicro.y','1.').replace('uMM*uMicro.x','1.').replace('uMicro.w','0.').replace('uMicro.z','1.')
start=h.index('const FS=') if 'const FS=' in h else h.index('flat in vec4 vState;')
at=h.index('void main(){\n vec3 N=normalize(vNormal)',start)
h=h[:at]+shader+'\n'+h[at:]
h=h.replace('else if(uType==6){',"else if(uType==7){BrMat b=brMaterial(vLocal/.14423);base=b.base;rough=b.rough;height=b.h*.14423;}else if(uType==6){")
modules=(H/'fit_material09d.js').read_text(encoding='utf8')
h=h.replace('const $=s=>document.querySelector(s),canvas=',modules+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace('09C','09D').replace('原木纹恢复 / 滴水齐接 · 逐图木构','原版木色 / 顺纹圆梁 · 滴水满口 · 砖肌理')
h=h.replace('function studyDescription(){const e=currentEntry();',"function studyDescription(){const e=currentEntry();if(e.family==='masonry')return '09D采用Brick Mother已确认的R2.1 B材料：烧结色、孔隙、粗糙度和Microscope细部。保留本页砖尺寸；圆钝边口和轻微缺损是显示参数。红烧土色来自材料基线，不是黑白原图证明的历史原色。';if(e.id.startsWith('drip'))return '09D按用户要求调整滴水外轮廓，使上缘与板瓦完整前口相接，覆盖两端厚度；内部纹饰保留原图。新轮廓属于本次适配，非实物测绘结论。';")
h=h.replace('0.8米进深、未注断面、隐藏节点及彩画原色未测。','0.8米进深、未注断面、隐藏节点及彩画原色未测。09D恢复08D木材配方与种子；木纹随构件长轴。游椿上曲部按本次要求用圆截面，柱径按原图31厘米，曲部截面与柱础宽仍含显示假设。')
h=h.replace("'21.5 cm（两种共用，待核）'","'09D随板瓦完整口宽适配（约23 cm）'")
# Names ending in 09C are private implementation identifiers also consistently renamed above.
(H/'START_HERE.html').write_text(h,encoding='utf8')
(H/'vendor/Brick_Material_Microscope_Lab_R2_1.html').write_text(src,encoding='utf8')
(H/'vendor/BRICK_BASELINE_LOCK.json').write_bytes(Path('G:/HOUSE/brick-mother-continuation-20260912/MATERIAL_BASELINE_LOCK.json').read_bytes())
print('09D built',len(h))
