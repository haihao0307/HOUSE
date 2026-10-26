from pathlib import Path
H=Path(__file__).parent
h=(H.parent/'brick-tiles-mother-09g-20261025/START_HERE.html').read_text(encoding='utf8')
# Persistent per-instance material identity, including repeated members of a batch.
h=h.replace("Array.from(id).reduce((n,c)","Array.from((type===7||type===8)?id+'#'+group.items.length+'@'+[m[12],m[13],m[14]].map(v=>v.toFixed(5)).join(','):id).reduce((n,c)")
h=h.replace("BrMat b=brMaterial(vLocal/.14423);float tone=", "float bi=tileIdentity(vState.x),bj=tileIdentity(vState.x+197.),bk=tileIdentity(vState.x+431.);vec3 bq=vLocal/.14423+vec3(bi,bj,bk)*37.;BrMat b=brMaterial(bq);b.base*=mix(.84,1.13,bi);b.rough=clamp(b.rough+(bj-.5)*.045,.68,.99);float tone=")
h=h.replace('7)%997,0,.5,0]', '7)%(type===7||type===8?10000019:997)/(type===7||type===8?10000:1),0,.5,0]')
# The drawn beam height determines its round diameter; the old depth clamp reduced it,
# leaving the short column 60 mm above the beam crest.
h=h.replace("axis==='x'?Math.min(h,d):Math.min(w,h)","axis==='x'?h:Math.min(w,h)")
# Overlap source runs at internal slope changes, maintaining tile dimensions.
h=h.replace("const x0=i===0?(edges.xMin??a[0]):a[0],x1=i===p.length-2?(edges.xMax??b[0]):b[0];", "const x0=i===0?(edges.xMin??a[0]):a[0]-(s>=0?.080:.025),x1=i===p.length-2?(edges.xMax??b[0]):b[0]+(s>=0?.025:.080);")
h=h.replace("let e=currentEntry(),E=STUDY.explode;", "let e=currentEntry(),E=0;")
h=h.replace("document.getElementById('explodeControl').hidden=!['roof','timber','house'].includes(e.family);","document.getElementById('explodeControl').hidden=true;")
h=h.replace("frame(model(x,rafterY,totalZ-STUDY.depth/2,0,Math.PI,[scale,scale,1]))", "frame(M.mul(M.translate(x,rafterY,totalZ),M.mul(M.rx(-Math.atan(rise/step)),model(0,0,-STUDY.depth/2,0,Math.PI,[scale,scale,1]))))")
h=h.replace("frame(M.translate(x,rafterY,totalZ-.005))", "frame(M.mul(M.translate(x,rafterY,totalZ),M.mul(M.rx(-Math.atan(rise/step)),M.translate(0,0,.012))))")
h=h.replace('圆木双侧承瓦 / 青砖与石础 / 木纹真实起伏','折坡连续搭接 / 落梁支承 / 逐砖自然差异')
h=h.replace('<button id="gray">灰模</button>','<button id="foldView" data-view="fold" hidden>折口近景</button><button id="bearingView" data-view="bearing" hidden>短柱落梁</button><button id="gray">灰模</button>')
h=h.replace("function studyUpdate(){", "function studyUpdate(){document.getElementById('foldView').hidden=!(workshop?.definition?.foldBridges?.length);document.getElementById('bearingView').hidden=STUDY.id!=='mainHouse';")
h=h.replace("if(view==='close'){camera.pitch=.50;camera.yaw=-.73;camera.distance*=.60}","if(view==='close'){camera.pitch=.50;camera.yaw=-.73;camera.distance*=.60}\n if(view==='fold'&&workshop.definition.foldBridges?.length){let pair=workshop.definition.foldBridges[0].runs,run=workshop.definition.roofRuns[pair[0]],p=run.purlins[1].center;camera.target=[p[0],p[1]+.13,p[2]];camera.distance=1.6;camera.pitch=.95;camera.yaw=-1.0;}\n if(view==='bearing'&&STUDY.id==='mainHouse'){camera.target=[1.35,5.12,0];camera.distance=1.7;camera.pitch=.20;camera.yaw=-.30;}")
# L8 figure 7 frame6: visible middle beam nose stops near x=298, not x=238.
# Correct the two overextended left vertices; preserve the observed stepped nose.
h=h.replace('[[238,709],[462,709],[462,727],[326,727],[312,722],[298,722],[298,714],[238,714]]','[[312,709],[462,709],[462,727],[326,727],[312,722],[298,722],[298,714],[312,714]]')
h=h.replace('09G','09H')
h=h.replace('resolveColumnTileEnds09H(this,e.id);','stitchSourceRoofs09H(this);resolveColumnTileEnds09H(this,e.id);')
h=h.replace(' // Exact bounds reuse rotated component extrema across instances.', ' stitchSourceRoofs09H(this);\n // Exact bounds reuse rotated component extrema across instances.')
h=h.replace("this.groups.get('__ground').cast=false;stitchSourceRoofs09H(this);", "this.groups.get('__ground').cast=false;")
h=h.replace('const $=s=>document.querySelector(s),canvas=',(H/'stitch09h.js').read_text(encoding='utf8')+'\nconst $=s=>document.querySelector(s),canvas=')
if (H/'stitch-cache09h.json').exists():
    h=h.replace('const $=s=>document.querySelector(s),canvas=','for(const [k,v] of '+(H/'stitch-cache09h.json').read_text(encoding='utf8')+')STITCH_SOLVE09H.set(k,v);\nconst $=s=>document.querySelector(s),canvas=')
if (H/'roof-cache09h.json').exists():
    import json
    cache=json.loads((H/'roof-cache09h.json').read_text(encoding='utf8'))
    preload='for(const [k,v] of '+json.dumps(cache['roof'])+')ROOF_CACHE.set(k,v);\nfor(const [k,v] of '+json.dumps(cache['fits'])+')SOURCE_FIT_CACHE09H.set(k,v);\n'
    h=h.replace('const $=s=>document.querySelector(s),canvas=',preload+'const $=s=>document.querySelector(s),canvas=')
(H/'START_HERE.html').write_text(h,encoding='utf8')
print('09H built',len(h))
