from pathlib import Path
H=Path(__file__).parent
h=(H.parent/'tiles-mother-09e-grain-edge-20261024/START_HERE.html').read_text(encoding='utf8')
# Stable object identity affects color only; the shared surface field stays in member coordinates.
h=h.replace("group.items.push({m,s:[31,0,.5,0]})","group.items.push({m,s:[31+Array.from(id).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7)%997,0,.5,0]})")
# Reuse expensive geometry and bedding; keep source object records distinct.
h=h.replace('function woodBox(w,h,d){','function woodBoxUncached09F(w,h,d){')
h=h.replace('function conformingBed(pan,angle,cutZ,baseY,slope,maxZ=null){','function conformingBedUncached09F(pan,angle,cutZ,baseY,slope,maxZ=null){')
modules='''
const WOOD_BOX_CACHE09F=new Map(),BED_CACHE09F=new WeakMap();
function woodBox(w,h,d){let key=[w,h,d,settings.micStrength,settings.micScale].join('/');if(!WOOD_BOX_CACHE09F.has(key))WOOD_BOX_CACHE09F.set(key,woodBoxUncached09F(w,h,d));return WOOD_BOX_CACHE09F.get(key)}
function conformingBed(pan,angle,cutZ,baseY,slope,maxZ=null){let cache=BED_CACHE09F.get(pan);if(!cache){cache=new Map();BED_CACHE09F.set(pan,cache)}let key=[angle,cutZ,baseY,slope,maxZ,STUDY.deck].map(x=>typeof x==='number'?x.toFixed(9):x).join('/');if(!cache.has(key))cache.set(key,conformingBedUncached09F(pan,angle,cutZ,baseY,slope,maxZ));return cache.get(key)}
function submitGroups09F(renderer,groups){let merged=new Map();for(let g of groups.values()){let variants=merged.get(g.mesh);if(!variants){variants=new Map();merged.set(g.mesh,variants)}let key=g.type+'/'+g.cast;if(!variants.has(key))variants.set(key,{...g,items:[]});variants.get(key).items.push(...g.items)}for(let variants of merged.values())for(let g of variants.values())renderer.add(g.mesh,g.items,g.type,g.cast)}
'''
h=h.replace('for(let g of this.groups.values())this.r.add(g.mesh,g.items,g.type,g.cast);','submitGroups09F(this.r,this.groups);')
# Vertex display buffers can be simpler than the retained contact surface.
# Preserve the input surface and every connection calculation.
h=h.replace('add(mesh,instances,type,cast=true){\n  if(!instances.length)return;',"add(mesh,instances,type,cast=true){\n  if(!instances.length)return;mesh=displayMesh09F(mesh);")
modules+='''
const DISPLAY_CACHE09F=new WeakMap();
function displayMesh09F(mesh){
 if(!mesh.reference||!['pan','cover'].includes(mesh.definition?.kind))return mesh;
 if(DISPLAY_CACHE09F.has(mesh))return DISPLAY_CACHE09F.get(mesh);
 // Exact vertices from the contact mesh; stride 2 on the regular shell interior.
 const n=Math.round(Math.sqrt(mesh.p.length/3/2));
 // Topology-specific reduction is installed by the next build stage, if verified.
 return mesh;
}
'''
# Finer fibres, gently weathered surface, one Microscope domain for real displacement and shading.
h=h.replace('vec3 w=p+vec3(identity*.13,identity*.09,identity*.23);','vec3 w=p;')
h=h.replace('p.z*1.7+identity*6.','p.z*1.7')
h=h.replace('w.xy*112.,w.z*1.9','w.xy*220.,w.z*3.2').replace('w.xy*430.,w.z*6.','w.xy*900.,w.z*10.')
h=h.replace('vec3(w.x,w.y,w.z*.045)','vec3(w.x,w.y,w.z*.065)')
h=h.replace('float tone=clamp(.12+.48*broad+.30*streak+.10*grain,0.,1.);','float tone=clamp(.10+.40*broad+.24*streak+.26*grain,0.,1.);')
h=h.replace('mix(.83,1.16,identity)*(1.-.22*ringMask-.25*longCrack)','mix(.91,1.08,identity)*(1.-.08*ringMask-.20*longCrack)')
h=h.replace('float weather=clamp(uSurface.z*.65,0.,1.);','float weather=clamp(.20+uSurface.z*.65+.15*(1.-grain),0.,.65);')
h=h.replace('base=mix(base,base*vec3(.88,.98,1.14),weather);','base=mix(base,vec3(.118,.108,.087)*(.65+.55*tone),weather);')
h=h.replace('(fibre-.5)*.00032*band(fp,410.)','(fibre-.5)*.00016*band(fp,850.)')
h=h.replace('grainMicro.value*.00020*uMicroscope.x','grainMicro.value*.00032*uMicroscope.x')
h=h.replace('p[0]*.045','p[0]*.065')
# User-requested brick substitutes retain column bearing height and footprint.
h=h.replace("(e.family==='masonry'||/brick/.test(id))","(e.family==='masonry'||/brick|stone|you-chun-base/.test(id))")
# Unified default gallery, separate retained decoration category.
h=h.replace("id:'tileBoard',family:'tile'","id:'tileSystem',family:'tile'")
h=h.replace("['tileBoard','tile'","['tileSystem','tile','砖瓦总览 · 筒板瓦与瓦当滴水','D7,L9','T01,T02,T04,T05,T06,T07,T08,B01'],['brickSystem','masonry','砖作总览 · 规格与砌法','L9','B01,B02,B03,B04,B05'],['tileBoard','tile'")
h=h.replace("if(e.id==='tileBoard'){tile", "if(e.id==='tileSystem'){\n tile('pan',-.36,.10,0,'D7');tile('cover',0,.10,0,'D7');put('gallery-round-end',roundEnd09E(),model(.32,.10,0,0,Math.PI));\n for(let [i,id]of ['seal','seeds','flower','dripFloral','dripBeast'].entries())put('integrated-'+id,integratedEnd(id,'L9'),model((i%3-1)*.34,Math.floor(i/3)? .43:.76,0,0,Math.PI));\n put('gallery-rosette',pressedMesh('rosette'),M.translate(.34,.43,0));put('gallery-rosette-rafter',woodRound(.058,.38),M.translate(.34,.43,-.196),1);block('gallery-brick-long',.78,.01,0,.30,.09,.165);block('gallery-brick-square',.78,.105,0,.34,.045,.34);this.definition.gallery=['pan','cover','seal','seeds','flower','dripFloral','dripBeast','rosette','roundEnd','brick'];\n }else if(e.id==='tileBoard'){tile")
# Building brick methods independently then arranging their groups preserves method definitions.
h=h.replace("if(e.id==='bricks'){let dims=", "if(e.id==='brickSystem'){let ids=['bricks','bond','wallCap','herringbone','smallDing'];let oldId=STUDY.id,oldFamily=STUDY.family;for(let [i,id]of ids.entries()){STUDY.id=id;let child=new StudyWorkshop({clear(){},add(){}});child.build({});let offset=M.translate((i%3-1)*1.8,0,Math.floor(i/3)*1.8);for(let [name,g]of child.groups)if(name!=='__ground')for(let item of g.items)put(id+'/'+name,g.mesh,M.mul(offset,item.m),g.type);this.connections.push(...child.connections)}STUDY.id=oldId;STUDY.family=oldFamily;this.definition.gallery=ids;this.definition.brickSource='Brick Mother R2.1 B material; L9 separately transcribed bond patterns';}else if(e.id==='bricks'){let dims=")
h=h.replace('Tiles Mother · 09E','Brick & Tiles Mother · 09F').replace('瓦 · TILES MOTHER 09E','砖瓦 · BRICK & TILES MOTHER 09F')
h=h.replace('连续木纹 / 自然色差 · 滴水满面纹饰','砖瓦同屏 / 细木纹与旧化 / 接触检查')
h=h.replace('const $=s=>document.querySelector(s),canvas=',modules+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace("STUDY.family==='tile'?192:80","['cover','pan'].includes(STUDY.id)?192:80")
h=h.replace('function displayMesh09F(mesh){','function displayMesh09FUnused(mesh){')
h=h.replace('const $=s=>document.querySelector(s),canvas=',(H/'display09f.js').read_text(encoding='utf8')+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace('lengthSegments:72,crossSegments:32','lengthSegments:40,crossSegments:12').replace('createCylinderGeometry(l,r,96,{axialSegments:96})','createCylinderGeometry(l,r,40,{axialSegments:48})')
h=h.replace('field=reliefField(trace),rows=180','field=reliefField(trace),rows=STUDY.family===\"roof\"?48:180')
h=h.replace('total=(rows-1)*step+p.pan.l,base=.089','total=(rows-1)*step+p.pan.l,base=roofBase09F(panAngle,seat)')
h=h.replace('submitGroups09F(this.r,this.groups);','resolveColumnTileEnds09F(this,e.id);submitGroups09F(this.r,this.groups);')
h=h.replace('const $=s=>document.querySelector(s),canvas=',(H/'contact09f.js').read_text(encoding='utf8')+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace('瓦 · TILES MOTHER','砖瓦 · BRICK & TILES MOTHER')
h=h.replace('function dimensionRows(){let e=currentEntry();',"function dimensionRows(){let e=currentEntry();if(e.id==='tileSystem')return [['同屏内容','筒瓦、板瓦、三种勾头、两种滴水、斜端瓦与圆钱'],['砖材','Brick Mother R2.1 B'],['来源','D7与L9分别保留尺寸来源'],['用途','构件对照陈列；不表示相邻安装']];if(e.id==='brickSystem')return [['规格','四类砖同尺度'],['砌法','工字、小丁走、墙码头、水波浪'],['材料来源','Brick Mother R2.1 B'],['边界','砌法读图与显示假设分开记录']];")
a=h.index(' // Fit actual generated objects');b=h.index('let center=lo.map',a)
h=h[:a]+''' // Exact bounds reuse rotated component extrema across instances.
 let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let g of this.groups.values())for(let item of g.items){let b=transformedBounds09F(g.mesh,item.m);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],b.lo[k]);hi[k]=Math.max(hi[k],b.hi[k])}}'''+h[b:]
h=h.replace("yaw:e.family==='frame'?","yaw:e.id==='tileSystem'?-.20:e.family==='frame'?").replace("pitch:e.family==='frame'?","pitch:e.id==='tileSystem'?.22:e.family==='frame'?")
h=h.replace("settings.micScale,STUDY.family==='tile'].join('/')","settings.micScale,STUDY.family].join('/')")
h=h.replace('T01,T02,T04,T05,T06,T07,T08,B01','T01,T02,T03,T04,T05,T06,T07,T08,T09,B01')
h=h.replace('09E','09F')
(H/'START_HERE.html').write_text(h,encoding='utf8')
print('09F built',len(h))
