from pathlib import Path
import json
H=Path(__file__).parent
OLD=H.parent/'tiles-mother-09a-repair-20261024'
s=(OLD/'study.js').read_text(encoding='utf-8')
s=s.replace("id:'cover',family:'tile'","id:'tileBoard',family:'tile'").replace('explode:0','explode:0,deck:false')
s=s.replace('const CATALOG=[',"const CATALOG=[\n ['tileBoard','tile','筒瓦与板瓦 · 同屏','D7,L9','T01,T02'],['patternBoard','pattern','瓦当与滴水 · 全组同屏','L9','T04,T05,T06,T07,T08,T09'],['ornamentBoard','ornament','脊饰 · 全组同屏','L7','R19,R20,R21,R23,R24,R25'],")
s=s.replace('圆镂候选 · 花瓣回纹','圆钱 · 椽头护面与钉孔')
s=s.replace("let e=currentEntry(),E=STUDY.explode;", "let e=currentEntry(),E=STUDY.explode;if(e.id==='eaves')STUDY.set='L9';")
s=s.replace("e.id==='eaves'?2.55", "e.id==='eaves'?2.95")
s=s.replace("pitch:e.family==='pattern'", "pitch:e.id==='eaves'?.16:e.family==='pattern'")
a=s.index('function traceMesh(');b=s.index('function beamBetween(',a)
s=s[:a]+"function traceMesh(id,depth=STUDY.depth,relief=STUDY.relief){return pressedMesh(id,depth,relief);}\n"+s[b:]
s=s.replace("if(e.id==='comparison'){", "if(e.id==='tileBoard'){tile('pan',-.12,.016,0);tile('cover',.16,.016,0);}\n  else if(e.id==='comparison'){")
s=s.replace("}else if(e.family==='pattern'||e.family==='ornament'){trace(e.id,0,SOURCE_CURVES[e.id].height_m/2+.01,0);}","""}else if(e.family==='pattern'||e.family==='ornament'){
  const displayPattern=(id,x,y)=>{
   if(id==='rosette'){
    put('rafter-end-coin',pressedMesh(id),M.translate(x,y,0));
    put('coin-carrier-rafter',woodRound(.058,.38),M.translate(x,y,-.19-STUDY.depth/2),1);
    put('coin-nail-shaft',ovalMesh(.0018,.0018,.052),M.translate(x,y,-.018),5);
    put('coin-nail-head',ovalMesh(.004,.004,.0015),M.translate(x,y,STUDY.depth/2+.001),5);
    this.connections.push({a:'rafter-end-coin',b:'coin-carrier-rafter',kind:'nailed end protection',back_contact_z:-STUDY.depth/2,source:'L9 upper-right diagram, central nail-hole label and user identification',fastener_dimensions_status:'display assumptions',weatherproof_guarantee:false});
   }else put('integrated-'+id,integratedEnd(id,'L9'),model(x,y,0,0,Math.PI));
  };
  if(e.id==='patternBoard'||e.id==='ornamentBoard'){
   let ids=CATALOG.filter(v=>v.family===e.family&&!v.id.endsWith('Board')).map(v=>v.id),cols=e.family==='pattern'?3:4,spacing=e.family==='pattern'?.30:.48;
   if(e.family==='pattern')ids=['seal','seeds','flower','dripFloral','dripBeast','rosette'];
   for(let [i,id]of ids.entries()){let x=(i%cols-(cols-1)/2)*spacing,y=(Math.floor((ids.length-1)/cols)-Math.floor(i/cols))*.28+.15;if(e.family==='pattern')displayPattern(id,x,y);else trace(id,x,y,0);}
   this.definition.gallery=ids;
  }else if(e.family==='pattern')displayPattern(e.id,0,.15);else trace(e.id,0,SOURCE_CURVES[e.id].height_m/2+.01,0);
 }""")
# The eave face and its carrier share a stitched surface; no separate hovering face.
s=s.replace("put('pan'+STUDY.set,pan,frame(M.mul(M.translate(x,y+E*.09,z),M.rx(panAngle))));", "put((withEnds&&r===0?'eave-drip-':'pan')+STUDY.set,withEnds&&r===0?integratedEnd('dripFloral'):pan,frame(M.mul(M.translate(x,y+E*.09,z),M.rx(panAngle))));")
s=s.replace("put('cover'+STUDY.set,cover,frame(M.mul", "put((withEnds&&r===0?'eave-goutou-':'cover')+STUDY.set,withEnds&&r===0?integratedEnd('flower'):cover,frame(M.mul")
a=s.index('   if(withEnds&&r===0){');b=s.index('  // Explicit continuous bedding',a)
s=s[:a]+'''  }
  if(withEnds){
   const totalZ=-total/2,rafterY=.024;
   for(let c=0;c<cols;c++){
    let x=(c-(cols-1)/2)*spacing,scale=.050/SOURCE_CURVES.rosette.width_m;
    put('eave-round-coin',pressedMesh('rosette'),frame(model(x,rafterY,totalZ-STUDY.depth/2,0,Math.PI,[scale,scale,1])));
    put('eave-coin-nail',ovalMesh(.0018,.0018,.045),frame(M.translate(x,rafterY,totalZ-.005)),5);
   }
   this.connections.push({a:'round-coin',b:'rafter-end',kind:'nailed protective facing',source:'L9 plus user clarification',diameter_status:'scaled to displayed 48 mm rafter, source diameter unknown',fixing_dimensions_status:'assumed'});
  }
''' +s[b:]
# Default exposed underside: battens and local mortar seats, not a continuous second tile.
s=s.replace("put('bedding-'+serial+'-'+r,conformingBed(pan,panAngle,r===0?null:p.pan.l/2-step+.004,deckBase-y,deckSlope),frame(M.translate(x,y,z)));", "put('mortar-seat-'+serial+'-'+r,conformingBed(pan,panAngle,STUDY.deck?(r===0?null:p.pan.l/2-step+.004):-.015,deckBase-y,deckSlope,STUDY.deck?null:.015),frame(M.translate(x,y,z)),4);")
s=s.replace("const deckSlope=rise/step;put('deck-'+serial,woodBox(cols*spacing,.012,total),frame(M.mul(M.translate(0,.048+deckSlope*total/2,0),M.rx(-Math.atan(deckSlope)))),1);", """const deckSlope=rise/step;
  if(STUDY.deck)put('deck-'+serial,woodBox(cols*spacing,.012,total),frame(M.mul(M.translate(0,.048+deckSlope*total/2,0),M.rx(-Math.atan(deckSlope)))),1);
  else for(let r=0;r<rows;r++){let z=(r-(rows-1)/2)*step;put('batten-'+serial+'-'+r,woodBox(cols*spacing,.012,.030),frame(M.mul(M.translate(0,.048+deckSlope*(z+total/2),z),M.rx(-Math.atan(deckSlope)))),1);}
  this.definition.roofSubstrate={deck:STUDY.deck,battens:!STUDY.deck,mortar:STUDY.deck?'continuous bedding':'local seats over battens',status:'explicit construction option; unmeasured dimensions'};""")
s=s.replace("'bedding/deck/rafter/purlin'","STUDY.deck?'mortar/deck/rafter/purlin':'local mortar seat/batten/rafter/purlin'")
s=s.replace("bedding_status:'assumed filler; geometric conformance pending'","bedding_status:'mortar fitted to the original pan underside; explicit support scheme, not a substitute tile'")
# Real 5 mm mortar joints, recessed by 1 mm from the front and rear faces.
s=s.replace("else{for(let r=0;r<5;r++)for(let c=0;c<4;c++)block('bond-brick',(c-1.5+(r%2)*.5)*.30,r*.095,0,.295,.09,.165);", """else{for(let r=0;r<5;r++){
   let start=(-1.5+(r%2)*.5)*.30;
   for(let c=0;c<4;c++){block('bond-brick',start+c*.30,r*.095,0,.295,.09,.165);if(c<3)block('vertical-mortar-'+r,start+c*.30+.15,r*.095,0,.005,.09,.163,4);}
   if(r<4)block('bed-mortar-'+r,start+.45,r*.095+.09,0,1.195,.005,.163,4);
  }this.definition.mortar={jointWidth_m:.005,recess_m:.001,status:'display assumption; awaiting the promised mortar detail reference'};""")
s=s.replace("yaw:e.id==='eaves'?2.55", "yaw:e.id==='eaves'?2.55")
s=s.replace("if(e.family==='tile')return '","if(e.family==='tile')return '09B：筒瓦和板瓦可同屏；上面、底面、侧边、大小端与小头共同接受较弱连续起伏。")
s=s.replace("正面/侧面墨线提取为有边界曲线，保留原图纹线，不另造通用纹样。当前厚度与凸起只用于三维观察；它们不证明原件浮雕、镂空或圆雕。脊饰无比例，宽度为展示参数。", "原图纹线用于连续压印浮雕，纹样与基面为同一闭合表面，无悬浮细管。瓦当、滴水与脊饰分别整组同屏。原件背面与浮雕深度未测；脊饰仍为侧形研究，不冒充完整圆雕。")
s=s.replace("瓦下承托层由瓦底拟合，是显示构造假设。", "默认无望板：原板瓦下保留离散挂瓦条与局部灰座；可切换有望板。支承尺寸是显示构造假设。")
s=s.replace("['承托层','按瓦底拟合；厚度非历史实测']", "['基层',STUDY.deck?'有望板 / 连续灰背':'无望板 / 挂瓦条与局部灰座']")
s=s.replace("['cover','pan','comparison'].includes(e.id)","['tileBoard','cover','pan','comparison'].includes(e.id)")
s=s.replace("['cover','pan'].includes(e.id)","['tileBoard','cover','pan'].includes(e.id)").replace("['pan','cover'].includes(e.id)","['tileBoard','pan','cover'].includes(e.id)")
s=s.replace("e.id==='cover'&&STUDY.set", "['tileBoard','cover'].includes(e.id)&&STUDY.set")
s=s.replace("document.getElementById('explodeControl').hidden=", "document.getElementById('deckControl').hidden=!['roof','house','timber'].includes(e.family);document.getElementById('explodeControl').hidden=")
s=s.replace("function initStudy(){", "function initStudy(){document.getElementById('deckChoice').onchange=e=>{STUDY.deck=e.target.checked;rebuild(true);};")
s=s.replace("原图纹线的深度示意","连续压印浮雕研究").replace("轮廓描摹已生成 · 原件深度未知","09B 连续压印表面 · 原件深度未知")
s=s.replace("function dimensionRows(){let e=currentEntry();", "function dimensionRows(){let e=currentEntry();if(e.id==='rosette')return [['构件','圆钱（原图与用户指认）'],['安装载体','椽头，不是筒瓦'],['原图细节','中心钉孔 / 放射花瓣 / 外圈回纹'],['直径','13 cm为当前显示参数，圆钱专属尺寸待核'],['钉固','真实孔与钉；孔径和钉长未测'],['作用边界','遮护端木，不保证绝对防水']];if(e.id==='patternBoard')return [['第一排','三种勾头，分别连筒瓦'],['第二排','两种滴水连板瓦；圆钱连椽头'],['纹饰','连续压印面，无分离泥条'],['钉孔','圆钱中央开孔'],['未知项','背面形状、深度与钉固尺寸']];")
s=s.replace("'纹线示意凸起'", "'压印浮雕起伏'")
s=s.replace("const CATALOG=[", "const CATALOG=[\n"+','.join("['%s','frame','%s','L8','L8FRAME']"%(i,n) for i,n in [('frame2','二柱二架二桁 · 一溜水'),('frame4','二柱三架四桁 · 一溜水'),('frame6','二柱四架六桁 · 二溜水'),('frame7','三柱六架七桁 · 前廊'),('frame13','响应寺 · 四柱十三桁'),('frame3','二柱三架三桁'),('youChun','响应寺 · 游椿与彩画来源')])+',')
s=s.replace("if(e.family==='tile'){", "if(e.family==='frame'){const api={put,block,bar,log,workshop:this};if(e.id==='youChun')buildYouChun(api);else buildSourceFrame(e.id,api);this.definition.case=this.definition.sourceFrame.case;}else if(e.family==='tile'){")
s=s.replace("function studyDescription(){let e=currentEntry();", "function studyDescription(){let e=currentEntry();if(e.family==='frame')return '逐件对照L8的图7、图8：柱、梁、短柱、檩与游椿按各自图面关系建立；保留六种不同梁架。显示进深、未注断面与节点深度未测。当前为木架剖面研究，原图未足以确定的瓦层、榫型、彩画原色不补造。';")
s=s.replace("function dimensionRows(){let e=currentEntry();", "function dimensionRows(){let e=currentEntry();if(e.family==='frame'){let f=workshop?.definition?.sourceFrame;return [['出处','L8，原书'+(f?.printedFigure||'图7')],['案例',f?.case||e.name],['尺寸状态',f?.status||'图示比例'],['节点','接触与榫卯不是同一验证'],['彩画','原图独立样式，不拼作一扇门']];}")
s=s.replace("yaw:e.id==='eaves'", "yaw:e.family==='frame'?-.18:e.id==='eaves'").replace("pitch:e.id==='eaves'", "pitch:e.family==='frame'?.08:e.id==='eaves'")
s=s.replace("document.getElementById('sourceCredit').textContent=", "document.getElementById('frameSamples').hidden=e.id!=='youChun';document.getElementById('sourceCredit').textContent=")
s=s.replace("小丁走 / 工字砌法", "工字砌法 · 有灰缝研究")
s=s.replace("awaiting the promised mortar detail reference", "user-requested mortar variant; L9 small-ding diagram says no mud and is not represented by this mortar wall")
(H/'study.js').write_text(s,encoding='utf-8')
r=(OLD/'repair.js').read_text(encoding='utf-8')
r=r.replace("o=tileMicro(p,m,31,settings.micStrength,settings.micScale)","o=allSurfaceOffset(p,m,kind)")
r=r.replace("v+o[k]+hand[k]", "v+o[k]+hand[k]*.55")
r=r.replace("function conformingBed(pan,angle,cutZ,baseY,slope)", "function conformingBed(pan,angle,cutZ,baseY,slope,maxZ=null)")
r=r.replace("if(poly.length<3)continue;let ix=", "if(!STUDY.deck){for(let [edge,sign]of [[-.04,1],[.04,-1]]){let out=[];for(let k=0;k<poly.length;k++){let a=poly[k],b=poly[(k+1)%poly.length],inside=sign*(a[0]-edge)>=0,next=sign*(b[0]-edge)>=0;if(inside)out.push(a);if(inside!==next){let t=(edge-a[0])/(b[0]-a[0]);out.push(a.map((x,n)=>mix(x,b[n],t)))}}poly=out;}}if(poly.length<3)continue;let ix=")
r=r.replace("if(poly.length<3)continue;let ix=", "if(maxZ!==null){let out=[];for(let k=0;k<poly.length;k++){let a=poly[k],b=poly[(k+1)%poly.length],inside=a[2]<=maxZ,next=b[2]<=maxZ;if(inside)out.push(a);if(inside!==next){let t=(maxZ-a[2])/(b[2]-a[2]);out.push(a.map((x,n)=>mix(x,b[n],t)))}}poly=out;}if(poly.length<3)continue;let ix=")
r=r.replace("let g=new Mesh();g.gp", "let grainHeights=sampleWoodGrain(raw,round,radius),g=new Mesh();g.gp")
r=r.replace("let h=woodMacro(gp,s,WOOD_PRESET,WOOD_FINISH)*gate", "let h=(woodMacro(gp,s,WOOD_PRESET,WOOD_FINISH)*2.2+(s===0?grainHeights[i/3]:0))*gate")
r=r.replace("macroRelief:'original CPU field, radial receiver with 12 mm end/joint fade; microheight original'", "macroRelief:'original CPU macro x2.2 plus original GLSL coarse/medium grain sampled into geometry, 12 mm end/joint fade',grainDisplacementMaxM:Math.max(...grainHeights.map(Math.abs))")
r=r.replace('lengthSegments:40,crossSegments:8','lengthSegments:72,crossSegments:32').replace('l,r,48,{axialSegments:48}', 'l,r,96,{axialSegments:96}')
r=r.replace("function woodRound(r,l){return woodMesh", "const WOOD_CACHE=new Map();\nfunction woodRound(r,l){let key=r+'/'+l;if(WOOD_CACHE.has(key))return WOOD_CACHE.get(key);let g=woodMesh")
r=r.replace(" 'z',0,true,r)}", " 'z',0,true,r);WOOD_CACHE.set(key,g);return g}")
(H/'repair.js').write_text(r,encoding='utf-8')
ui=(OLD/'study-ui.html').read_text(encoding='utf-8').replace('纹线示意凸起','压印浮雕起伏')
ui=ui.replace('<label id="explodeControl">','<label id="deckControl"><input id="deckChoice" type="checkbox"> 有望板（默认无望板）</label><label id="explodeControl">')
ui=ui.replace('<option value="house">','<option value="frame">图7梁架 / 图8游椿</option><option value="house">')
ui=ui.replace('<p class="sourceCredit"', '<div id="frameSamples" hidden><p>图8局部：游椿构造与独立彩画样式。黑白线稿不能确定原色；样式不作为同一扇门的装饰。</p><a href="references/L8-detail.jpg" target="_blank"><img src="references/L8-detail.jpg" alt="响应寺游椿和彩画原图局部" style="width:100%"></a></div><p class="sourceCredit"')
(H/'study-ui.html').write_text(ui,encoding='utf-8')
# Build from preserved source, then replace the visible identity and inject new functions.
exec((H/'assemble_repair.py').read_text(encoding='utf-8'))
h=(H/'START_HERE.html').read_text(encoding='utf-8')
h=h.replace('const $=s=>document.querySelector(s),canvas=',(H/'vendor/polygon-clipping.js').read_text(encoding='utf-8')+'\n'+(H/'vendor/earcut-source.js').read_text(encoding='utf-8')+'\n'+(H/'detail.js').read_text(encoding='utf-8')+'\n'+(H/'frames.js').read_text(encoding='utf-8')+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace('09A','09B').replace('瓦面与木构修复版','同屏 · 全表面 · 压印细节版').replace('修复 / 瓦面 · 搭接 · 木构','同屏 / 全表面 · 压印 · 无望板')
h=h.replace('// Coordinates are observations on qa/L8-left.png', 'const PAINT_CURVES='+(H/'paint-curves.json').read_text(encoding='utf-8')+';\n// Coordinates are observations on qa/L8-left.png')
h=h.replace('micStrength:1.6,micScale:1','micStrength:1.0,micScale:1')
h=h.replace('else{base=vec3(.68,.685,.663);rough=.94;}', 'else if(uType==4){base=vec3(.43,.42,.37)*(0.91+0.09*n3(vLocal*140.));rough=.99;height=(n3(vLocal*300.)-.5)*.00006;}else{base=vec3(.68,.685,.663);rough=.94;}')
h=h.replace('else if(uType==4){','else if(uType==5){base=vec3(.10,.085,.065);rough=.72;}else if(uType==4){')
h=h.replace('else if(uType==5){','else if(uType==6){base=vec3(.045,.035,.025);rough=.98;}else if(uType==5){')
(H/'START_HERE.html').write_text(h,encoding='utf-8')
print('09B built',len(h))
from PIL import Image
Image.open(H/'references/L8.jpg').crop((800,45,1525,1025)).save(H/'references/L8-detail.jpg',quality=95)
