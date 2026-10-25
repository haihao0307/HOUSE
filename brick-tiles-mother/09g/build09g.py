from pathlib import Path
H=Path(__file__).parent
h=(H.parent/'brick-tiles-mother-09f-20261025/START_HERE.html').read_text(encoding='utf8')
h=h.replace('<option value="pattern">瓦当与滴水</option>','')
# Route the retained individual motifs through the tile catalog without losing their builders.
h=h.replace("function currentEntry(){", "function currentEntry(){")
h=h.replace("CATALOG.filter(v=>v.family===STUDY.family)","CATALOG.filter(v=>v.family===STUDY.family||(STUDY.family==='tile'&&v.family==='pattern'&&v.id!=='patternBoard'))")
h=h.replace("CATALOG.filter(e=>e.family===STUDY.family)","CATALOG.filter(e=>e.family===STUDY.family||(STUDY.family==='tile'&&e.family==='pattern'&&e.id!=='patternBoard'))")
h=h.replace("STUDY.family=e.family;family.value=e.family;","STUDY.family=e.family==='pattern'?'tile':e.family;family.value=STUDY.family;")
h=h.replace('</select><button id="prevPart"','</select><select id="brickPalette" aria-label="砖材颜色"><option value="blue">青砖为主</option><option value="red">红砖</option></select><button id="prevPart"',1)
h=h.replace("let brick=type===0&&(e.family==='masonry'||/brick|stone|you-chun-base/.test(id));return put(id,type===1?woodBox(w,h,d):brick?brickMesh09F(w,h,d):boxMesh(w,h,d),M.translate(x,y,z),brick?7:type,parent,conn);", "let stone=type===0&&/stone|you-chun-base/.test(id),brick=!stone&&type===0&&(e.family==='masonry'||/brick/.test(id)),round=type===1&&((e.family==='frame'&&!/panel|board|paint|floor/.test(id))||/column|short-bearing|large-tie|small-tie/.test(id));return put(id,round?roundMember09G(w,h,d):type===1?woodBox(w,h,d):brick||stone?brickMesh09F(w,h,d):boxMesh(w,h,d),M.translate(x,y,z),stone?9:brick?7:type,parent,conn);")
h=h.replace("let group=this.groups.get(id);", "if(type===7&&settings.brickRed)type=8;let group=this.groups.get(id);",1)
h=h.replace("else if(uType==7){BrMat b=brMaterial(vLocal/.14423);base=b.base;rough=b.rough;height=b.h*.14423;}","else if(uType==7||uType==8){BrMat b=brMaterial(vLocal/.14423);float tone=dot(b.base,vec3(.299,.587,.114));base=uType==7?vec3(.63,.69,.72)*tone:b.base;rough=b.rough;height=b.h*.14423;}else if(uType==9){float q=n3(vLocal*90.);base=mix(vec3(.22,.23,.22),vec3(.37,.37,.34),q);rough=.96;height=(n3(vLocal*310.)-.5)*.0002;}")
h=h.replace("const profile=(id,poly)=>api.put(id,woodProfile(poly.map(pt),depth),M.identity(),1);", "const profile=(id,poly)=>api.put(id,roundProfile09G(poly.map(pt)),M.identity(),1);")
# Remove the invented under-tile layers and put each pan between two longitudinal round supports.
start=h.index("   const deckSlope=rise/step,deckBase=")
end=h.index("   if(c<cols-1)",start)
h=h[:start]+h[end:]
h=h.replace("for(let c=0;c<cols;c++){\n    let x=(c-(cols-1)/2)*spacing,scale", "for(let c=0;c<=cols;c++){\n    let x=(c-cols/2)*spacing,scale")
h=h.replace("for(let c=0;c<cols;c++)put('roof-rafter-'+serial", "for(let c=0;c<=cols;c++)put('roof-rafter-'+serial")
h=h.replace("M.translate((c-(cols-1)/2)*spacing,.024+rise/step*total/2,0)","M.translate((c-cols/2)*spacing,.024+rise/step*total/2,0)")
h=h.replace("(withEnds&&r===0?'eave-drip-':'pan')+STUDY.set,","(withEnds&&r===0?'eave-drip-':'pan')+STUDY.set+'-run-'+serial,")
h=h.replace("(withEnds&&r===0?'eave-goutou-':'cover')+STUDY.set,","(withEnds&&r===0?'eave-goutou-':'cover')+STUDY.set+'-run-'+serial,")
h=h.replace("M.translate((c-cols/2)*spacing,.024+rise/step*total/2,0)","M.translate((c-cols/2)*spacing+(seat.supportShift09G||0),.024+rise/step*(total/2+(withEnds?.0175:0)),withEnds?.0175:0)")
h=h.replace("woodRound(.024,total*Math.sqrt(1+(rise/step)**2))","woodRound(.024,(total-(withEnds?.035:0))*Math.sqrt(1+(rise/step)**2))")
h=h.replace("const totalZ=-total/2,rafterY=.024;","const totalZ=-total/2+.035,rafterY=.024+rise/step*.035;")
h=h.replace("let x=(c-cols/2)*spacing,scale","let x=(c-cols/2)*spacing+(seat.supportShift09G||0),scale")
start=h.index('  const deckSlope=rise/step;\n  if(STUDY.deck)')
end=h.index('\n };',start)
h=h[:start]+'''  this.definition.roofSubstrate={deck:false,battens:false,mortar:false,roundSupportRadius_m:.024,supportSpacing_m:spacing,status:'user requested bare round support scheme; dimensions are display assumptions'};
  this.definition.roofSeating=seat;this.connections.push({a:'cover',b:'two adjacent pans',kind:'projected_triangle_contact',seat,validated:false},{a:'pan',b:'left and right round rafters',kind:'two-sided support',supportX_m:[-spacing/2,spacing/2],status:'nominal circular support contact solved against displaced tile vertices; not structural verification'});
'''+h[end:]
start=h.index('function roofBase09F(panAngle,seat){')
end=h.index('// Explicit tile termination',start)
h=h[:start]+'''function roofBase09F(panAngle,seat){
 const s=seat.rise/seat.step,p=spec(),g=shellMesh('pan'),m=M.rx(panAngle),r=.024,points=[];
 for(let i=0;i<g.p.length;i+=3)points.push(M.transform(m,Array.from(g.p.slice(i,i+3))));
 const heights=shift=>[-1,1].map(side=>{let lift=-Infinity;for(let q of points){let dx=q[0]-side*seat.spacing/2-shift;if(Math.abs(dx)<r)lift=Math.max(lift,Math.sqrt(r*r-dx*dx)*Math.sqrt(1+s*s)-q[1]+s*q[2]);}return lift});
 let lo=-.012,hi=.012,shift=0,H;for(let k=0;k<18;k++){shift=(lo+hi)/2;H=heights(shift);if(H[0]>H[1])hi=shift;else lo=shift;}
 if(!H.every(Number.isFinite))throw Error('Pan does not reach both round supports');seat.supportShift09G=shift;
 return .024+s*p.pan.l/2+Math.max(...H)+.0001;
}
'''+h[end:]
# Real surface geometry, with fine transverse sampling and metre-scale displacement.
h=h.replace("return Math.max(-.00045,Math.min(.00045,tileBand(w,31,24*settings.micScale,.003)*.00030*settings.micStrength));", "const sc=settings.micScale;const broad=tileBand(w,31,24*sc,.003)*.00065;const fibres=(wood09Noise([w[0]*110*sc,w[1]*110*sc,p[0]*1.8*sc])-.5)*.0012+(wood09Noise([w[0]*220*sc,w[1]*220*sc,p[0]*3.2*sc])-.5)*.0005;return Math.max(-.0018,Math.min(.0018,broad+fibres))*settings.micStrength;")
h=h.replace('createCylinderGeometry(l,r,40,{axialSegments:48})','createCylinderGeometry(l,r,160,{axialSegments:96})')
h=h.replace('bounded 0.45 mm; 12 mm end/joint fade','bounded 1.8 mm at strength 1; actual fibre displacement; 12 mm end/joint fade')
# Smooth varying round profiles preserve source centreline/height, instead of rectangular extrusion.
module='''
function roundMember09G(w,h,d){let axis=h>=w&&h>=d?'y':w>=d?'x':'z',len=axis==='y'?h:axis==='x'?w:d,r=(axis==='y'?Math.min(w,d):axis==='x'?Math.min(h,d):Math.min(w,h))/2;return woodMesh(TimberOriginal.createCylinderGeometry(len,r,96,{axialSegments:64}),axis,h/2,true,r);}
function roundProfile09G(poly){let lo=Math.min(...poly.map(p=>p[0])),hi=Math.max(...poly.map(p=>p[0])),points=[],radii=[];for(let j=0;j<=32;j++){let x=mix(lo+.000001,hi-.000001,j/32),ys=[];for(let i=0;i<poly.length;i++){let a=poly[i],b=poly[(i+1)%poly.length];if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&Math.abs(a[0]-b[0])>1e-9)ys.push(mix(a[1],b[1],(x-a[0])/(b[0]-a[0])))}let a=Math.min(...ys),b=Math.max(...ys);points.push([x,(a+b)/2]);radii.push(Math.max(.002,(b-a)/2));}let g=woodCurvedRound09F(points,radii);g.definition.sourceOutline_m=poly;g.definition.section_status='round section requested by user; source top/bottom sampled; rear section unmeasured';return g;}
'''
h=h.replace('const $=s=>document.querySelector(s),canvas=',module+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace("const MIC_DEFAULTS=", "document.getElementById('brickPalette').onchange=e=>{settings.brickRed=e.target.value==='red';rebuild(false)};\nconst MIC_DEFAULTS=")
h=h.replace("document.getElementById('deckControl').hidden=!['roof','house','timber'].includes(e.family);","document.getElementById('deckControl').hidden=true;")
h=h.replace("STUDY.deck?'有望板 / 连续灰背':'无望板 / 挂瓦条与局部灰座'","'板瓦跨相邻圆椽 / 无灰座、无挂瓦条'")
h=h.replace('默认无望板：原板瓦下保留离散挂瓦条与局部灰座；可切换有望板。支承尺寸是显示构造假设。','板瓦置于相邻圆椽之间，筒瓦盖两列板瓦接缝；去除灰座、挂瓦条。圆椽承接于横向檩木，尺寸仍为显示假设。')
h=h.replace('砖瓦同屏 / 细木纹与旧化 / 接触检查','圆木双侧承瓦 / 青砖与石础 / 木纹真实起伏')
h=h.replace('红烧土色来自材料基线，不是黑白原图证明的历史原色。','默认青砖，可切换红砖；两种配色是用户指定的显示材料，黑白图纸不能证明原色。')
h=h.replace("e.id==='joinery'?'榫卯验证台：真实开孔':'原图木构关系 / 隐藏榫型未确定'","e.id==='woodSurface'?'真实几何起伏 · 可切换灰模对照':e.id==='joinery'?'榫卯验证台：真实开孔':'原图木构关系 / 隐藏榫型未确定'")
h=h.replace("['joinery','timber'", "['woodSurface','timber','圆木 · Microscope 形体检查','L8','WOOD-SURFACE'],['joinery','timber'",1)
h=h.replace("if(sourceHandled){}else if(e.family==='frame')", "if(sourceHandled){}else if(e.id==='woodSurface'){put('wood-surface-round',woodRound(.075,.8),M.identity(),1);}else if(e.family==='frame')")
h=h.replace("function dimensionRows(){let e=currentEntry();", "function dimensionRows(){let e=currentEntry();if(e.id==='woodSurface')return [['对象','直径 15 cm / 长 80 cm 圆木试件'],['起伏','Microscope 改变实际顶点、轮廓与阴影'],['尺度','强度 1 上限 1.8 mm；强度 3 上限 5.4 mm'],['边界','试件与磨损幅度为显示参数，非原件测量']];")
h=h.replace("function studyDescriptionLegacy(){let e=currentEntry();", "function studyDescriptionLegacy(){let e=currentEntry();if(e.id==='woodSurface')return '圆木表面检查试件。微形态开关改变真实几何；可用灰模检查轮廓和阴影。端部12 mm渐隐保持端面。';")
h=h.replace('09F','09G')
(H/'START_HERE.html').write_text(h,encoding='utf8')
print('built',len(h))
