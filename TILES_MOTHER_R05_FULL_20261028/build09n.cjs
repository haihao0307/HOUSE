const fs=require('fs'),path=require('path'),root=__dirname;
const target='G:/HOUSE/brick-tiles-mother-09n-20261028';fs.mkdirSync(target,{recursive:true});
const baseline='https://raw.githack.com/haihao0307/HOUSE/bbf1f063c1a256cc1d41f107dcd054e944dcc48d/brick-tiles-mother/09h/';
let html=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09h-20261026/START_HERE.html','utf8').replace(/\r\n/g,'\n');
const core=fs.readFileSync(root+'/route-a.cjs','utf8'),lib=fs.readFileSync(root+'/library.json','utf8'),glsl=require('./shader-adapter.cjs').glsl();
let sampler=fs.readFileSync(root+'/display-adapter.cjs','utf8');
sampler=sampler.replace('function sample(evaluator,detail=80)','function sample(evaluator,detail=80,tag=1)');
sampler=sampler.replace(/function vertex\(u,t,q,skin\)\{[^\n]+\}/,'function vertex(u,t,q,skin){let p=evaluator.materialPoint(u,t,q);reference.push(...p);G.vertex(evaluator.position(u,t,q),skin,tag,q,u);}');
const wrap=(name,code)=>'const '+name+'=(()=>{const module={exports:{}};\n'+code+'\nreturn module.exports})();\n';
// Reference images are packaged in the new fixed preview directory.
const crypto=require('crypto');
const sharedRuleNames=['route-a.cjs','section.cjs','tile.cjs','end-face.cjs','fit-drip.cjs','tile-end-object.cjs','round-end.cjs','rolled-sheet.cjs','band-sheet.cjs','folded-sheet.cjs','flat-sheet.cjs','profile-tile.cjs','record-compact.cjs'];
const assemblyNames=['ridge-stack.js','warm-fold.js'],adapterNames=['shader-adapter.cjs','display-adapter.cjs','profile-display.js','rolled-display.js','band-display.js','folded-display.js','flat-display.js'];
const ruleFiles=[...sharedRuleNames,...assemblyNames,...adapterNames,'library.json','instance-recipes.json','tile-source-curves.json'];
const ruleManifest={version:'tiles-mother-r05-09n',files:ruleFiles.map(name=>{let v=fs.readFileSync(root+'/'+name);return {name,bytes:v.length,sha256:crypto.createHash('sha256').update(v).digest('hex')}})};
ruleManifest.ruleBytes=ruleManifest.files.filter(x=>sharedRuleNames.includes(x.name)).reduce((a,x)=>a+x.bytes,0);
ruleManifest.assemblyBytes=ruleManifest.files.filter(x=>assemblyNames.includes(x.name)).reduce((a,x)=>a+x.bytes,0);
ruleManifest.newAdapterBytes=ruleManifest.files.filter(x=>adapterNames.includes(x.name)).reduce((a,x)=>a+x.bytes,0);
ruleManifest.sourceBytes=ruleManifest.files.find(x=>x.name==='tile-source-curves.json').bytes;
ruleManifest.libraryBytes=ruleManifest.files.filter(x=>['library.json','instance-recipes.json'].includes(x.name)).reduce((a,x)=>a+x.bytes,0);
const section=fs.readFileSync(root+'/section.cjs','utf8'), tile=fs.readFileSync(root+'/tile.cjs','utf8');
const wrapMother=code=>'const TilesMother=(()=>{const module={exports:{}};const require=id=>id===\"./section.cjs\"?SectionCore:id===\"./tile.cjs\"?TileCore:(()=>{throw Error(id)})();\n'+code+'\nreturn module.exports})();\n';
const endCore=fs.readFileSync(root+'/end-face.cjs','utf8'),dripCore=fs.readFileSync(root+'/fit-drip.cjs','utf8'),jointCore=fs.readFileSync(root+'/tile-end-object.cjs','utf8'),roundCore=fs.readFileSync(root+'/round-end.cjs','utf8'),profileCore=fs.readFileSync(root+'/profile-tile.cjs','utf8'),profileDisplay=fs.readFileSync(root+'/profile-display.js','utf8'),rolledCore=fs.readFileSync(root+'/rolled-sheet.cjs','utf8'),rolledDisplay=fs.readFileSync(root+'/rolled-display.js','utf8'),bandCore=fs.readFileSync(root+'/band-sheet.cjs','utf8'),bandDisplay=fs.readFileSync(root+'/band-display.js','utf8'),foldedCore=fs.readFileSync(root+'/folded-sheet.cjs','utf8'),foldedDisplay=fs.readFileSync(root+'/folded-display.js','utf8'),flatCore=fs.readFileSync(root+'/flat-sheet.cjs','utf8'),flatDisplay=fs.readFileSync(root+'/flat-display.js','utf8'),recordCore=fs.readFileSync(root+'/record-compact.cjs','utf8'),ridgeStack=fs.readFileSync(root+'/ridge-stack.js','utf8'),infoUI=fs.readFileSync(root+'/info-ui.js','utf8'),infoPanel=fs.readFileSync(root+'/info-panel.html','utf8');
const wrapEnd=code=>'const TilesEnd=(()=>{const module={exports:{}};const require=id=>id===\"./route-a.cjs\"?TilesMother:(()=>{throw Error(id)})();\n'+code+'\nreturn module.exports})();\n';
const wrapDrip=code=>'const TilesDrip=(()=>{const module={exports:{}};const require=id=>id===\"./end-face.cjs\"?TilesEnd:(()=>{throw Error(id)})();\n'+code+'\nreturn module.exports})();\n';
const wrapJoint=code=>'const TilesJoint=(()=>{const module={exports:{}};const require=id=>id===\"./route-a.cjs\"?TilesMother:id===\"./end-face.cjs\"?TilesEnd:id===\"./fit-drip.cjs\"?TilesDrip:(()=>{throw Error(id)})();\n'+code+'\nreturn module.exports})();\n';
const wrapProfile=code=>'const TilesProfile=(()=>{const module={exports:{}};const require=id=>id===\"./route-a.cjs\"?TilesMother:(()=>{throw Error(id)})();\n'+code+'\nreturn module.exports})();\n';
html=html.replace('<script>','<script>\n'+wrap('SectionCore',section)+wrap('TileCore',tile)+wrapMother(core)+wrapEnd(endCore)+wrapDrip(dripCore)+wrapJoint(jointCore)+wrap('TilesRound',roundCore)+wrapProfile(profileCore)+wrapProfile(rolledCore).replace('const TilesProfile=', 'const TilesRolled=')+wrapProfile(bandCore).replace('const TilesProfile=', 'const TilesBand=')+wrapProfile(foldedCore).replace('const TilesProfile=', 'const TilesFolded=')+wrapProfile(flatCore).replace('const TilesProfile=', 'const TilesFlat=')+wrap('SheetDisplay',sampler)+wrap('TilesRecord',recordCore)+infoUI+'\nconst SHEET_LIBRARY='+lib+';\nconst TILE_INSTANCES='+JSON.stringify(JSON.parse(fs.readFileSync(root+'/instance-recipes.json','utf8'))) +';\nconst TILE_RULE_MANIFEST='+JSON.stringify(ruleManifest)+';\n');
html=html.replace('function ovalMesh(',profileDisplay+'\n'+rolledDisplay+'\n'+bandDisplay+'\n'+foldedDisplay+'\n'+flatDisplay+'\n'+ridgeStack+'\nfunction ovalMesh(');
requiredReplace("put('eye-tile',ovalMesh(.045,.045,.17),","put('eye-tile',profileTileMesh09N(.045,.045,.17),");
requiredReplace("put('round-course',ovalMesh(.042,.042,.16),","put('round-course',profileTileMesh09N(.042,.042,.16),");
requiredReplace("api.block('board-tile-course',0,.142,0,1.15,.022,.255);","api.put('board-tile-course',flatTileMesh09N(...(()=>{const v=TILE_INSTANCES.instances.find(r=>r.id==='ridge-board-L7').variables;return [v.width,v.thickness,v.length,v.geometryGain]})()),M.translate(0,.142,0));");



requiredReplace('function source09HProfile(api,id,poly,depth=.14,type=0,x=0,y=0,z=0){return api.put(id,type===1?woodProfile(poly,depth):extrude(poly,depth),M.translate(x,y,z),type);}', `function source09HProfile(api,id,poly,depth=.14,type=0,x=0,y=0,z=0){
 if(id.startsWith('D5-folded-tile-')){
  const cx=poly[1][0],base=poly[0][1],outerHalf=(poly[2][0]-poly[0][0])/2,innerHalf=(poly[3][0]-poly[5][0])/2,outerRise=poly[1][1]-base,innerDrop=base-poly[3][1],innerRise=poly[4][1]-poly[3][1];
  const recipe=TILE_INSTANCES.instances.find(r=>r.id==='folded-D5');if(!recipe)throw Error('Missing folded tile recipe');const v=recipe.variables;return api.put(id,foldedTileMesh09N(v.outerHalf,v.innerHalf,v.outerRise,v.innerRise,v.innerDrop,v.depth),M.translate(x+cx,y+base,z),type);
 }
 return api.put(id,type===1?woodProfile(poly,depth):extrude(poly,depth),M.translate(x,y,z),type);
}`);


requiredReplace("if(id==='ridge'||id==='slopeRidge'){\n  source09HRing(api,'eye-tile-longitudinal',0,.075,.067,.047,1.12,true);", "if(id==='ridge'||id==='slopeRidge'){\n  const ridgeFit=ridgeStackFit09N();api.workshop.definition.sourceConstruction.ridgeStackFit=ridgeFit;\n  source09HRing(api,'eye-tile-longitudinal',0,.075,.067,.047,1.12,true);");
requiredReplace("M.translate(0,.142,0));\n  api.block('lower-pitiaoxian',0,.164,0,1.18,.022,.29);\n  let top=.186;", "M.translate(0,ridgeFit.boardY,0));\n  api.block('lower-pitiaoxian',0,ridgeFit.lowerY,0,1.18,.022,.29);\n  let top=ridgeFit.top;");

const bandStart=html.indexOf('function source09HBand('),bandEnd=html.indexOf('\nfunction source09HRing(',bandStart);
if(bandStart<0||bandEnd<0)throw Error('Missing source-led band generator');
html=html.slice(0,bandStart)+`function source09HBand(api,id,fn,x0,x1,y,thick,depth,type=0,z=0){
 if(type!==0)throw Error('Unsupported non-ceramic source band');
 const curve=id.startsWith('D5-')?'d5':id.startsWith('snail-')?'snail':id.startsWith('tail-')?'tail':id.endsWith('-continuous-wave-section')?'wave':null;
 if(!curve)throw Error('Unknown source band '+id);
 const recipeId=id.startsWith('D5-')?id:id.startsWith('snail-')?'snail-band-L7':id.startsWith('tail-')?'tail-band-L7':'wave-band-L7',recipe=TILE_INSTANCES.instances.find(r=>r.id===recipeId);if(!recipe)throw Error('Missing band recipe '+recipeId);const v=recipe.variables;return api.put(id,bandTileMesh09N(recipe.curve,v.x0,v.x1,v.y,v.thick,v.depth),M.translate(0,0,z),type);
}
`+html.slice(bandEnd);

const ringStart=html.indexOf('function source09HRing('),ringEnd=html.indexOf('\nfunction source09HHood(',ringStart),hoodEnd=html.indexOf('\nfunction buildSourceRoof09H(',ringEnd);
if(ringStart<0||ringEnd<0||hoodEnd<0)throw Error('Missing source-led ridge tile generators');
html=html.slice(0,ringStart)+`function source09HRing(api,id,x,y,outer,inner,depth,alongX=false){const recipe=TILE_INSTANCES.instances.find(r=>r.id===(id.startsWith('D5-eye-')?'ridge-eye-D5':'ridge-eye-L7'));if(!recipe)throw Error('Missing eye tile recipe');const v=recipe.variables,g=rolledTileMesh09N(v.outer_m,v.inner_m,v.length_m,v.angle_rad,v.geometryGain);return api.put(id,g,model(x,y,0,0,alongX?Math.PI/2:0));}
function source09HHood(api,id,x,y,length,r,t){const recipe=TILE_INSTANCES.instances.find(r=>r.id==='ridge-hood-L7');if(!recipe)throw Error('Missing hood recipe');const v=recipe.variables,g=rolledTileMesh09N(v.outer_m,v.inner_m,v.length_m,v.angle_rad,v.geometryGain);return api.put(id,g,model(x,y,0,0,Math.PI/2));}
`+html.slice(hoodEnd);

// All face heights are evaluated by the shared continuous end-face rule.
const reliefStart=html.indexOf('function reliefField(t){',html.indexOf('const STUDY=')),reliefEnd=html.indexOf('\nfunction pressedMesh(',reliefStart);
if(reliefStart<0||reliefEnd<0)throw Error('Missing source relief boundary');
html=html.slice(0,reliefStart)+'function reliefField(t){return TilesEnd.reliefField(t)}\n'+html.slice(reliefEnd);
function requiredReplace(a,b){if(!html.includes(a))throw Error('Missing 09H integration point: '+a.slice(0,90));html=html.replace(a,b)}
requiredReplace('const G=new Mesh(),field=reliefField(t),map=new Map(),edges=new Map(),step=', 'const faceFunction=TilesEnd.create({id,trace:t,depth,relief}),G=new Mesh(),map=new Map(),edges=new Map(),step=');
requiredReplace('let a=G.vertex([x,y,depth/2+relief*field(x,y)]);', 'let a=G.vertex(faceFunction.position(x,y,0));');
const dripStart=html.indexOf(" const n=['cover','pan'].includes(STUDY.id)?192:80,B=15,start=",html.indexOf('function dripFace09H('));
const dripEnd=html.indexOf(' const G=new Mesh(),field=reliefField(trace),rows=',dripStart);
if(dripStart<0||dripEnd<0)throw Error('Missing original drip fitting boundary');
html=html.slice(0,dripStart)+" const n=['cover','pan'].includes(STUDY.id)?192:80,t=SOURCE_CURVES[id],carrier=TilesMother.create(body.definition.object);\n const fitted=TilesDrip.create({id,source:t,carrier,depth:STUDY.depth,relief:STUDY.relief}),{xs,top,bottom,trace}=fitted.sampleBoundary(n);\n"+html.slice(dripEnd);
requiredReplace('const G=new Mesh(),field=reliefField(trace),rows=', 'const G=new Mesh(),faceFunction=fitted,rows=');
requiredReplace('G.vertex([x,y,STUDY.depth/2+STUDY.relief*field(x,y)])', 'G.vertex(faceFunction.position(x,y,0))');
requiredReplace("curves_ref:'source-curves.json#'+id,relief_m:relief", "functionRef:'tiles.end-face/1',curves_ref:'tile-source-curves.json#'+id,relief_m:relief");
requiredReplace("kind:'connected pressed drip surface',source:t.source", "kind:'connected pressed drip surface',functionRef:'tiles.end-face/1',source:t.source");
requiredReplace("kind:'pressed face united with actual carrier cross-section',carrier:kind", "kind:'pressed face united with actual carrier cross-section',functionRef:'kaopu.sheet/3 + tiles.end-face/1',carrier:kind");

// Fit the head and carrier via the analytic carrier, rather than mesh-derived bounds.
const dfaceStart=html.indexOf('function dripFace09H('),dfaceEnd=html.indexOf('\nconst BRICK_CACHE09H=',dfaceStart);
if(dfaceStart<0||dfaceEnd<0)throw Error('Missing drip display adapter');
let dface=html.slice(dfaceStart,dfaceEnd);
if(!dface.includes('G.finish();DETAIL_CACHE.set(key,G);return G;'))throw Error('Missing fitted drip return');
dface=dface.replace('G.finish();DETAIL_CACHE.set(key,G);return G;', 'G.finish();G.continuousFace=fitted;DETAIL_CACHE.set(key,G);return G;');
html=html.slice(0,dfaceStart)+dface+html.slice(dfaceEnd);
requiredReplace("const kind=id.startsWith('drip')?'pan':'cover',body=shellMesh(kind,set)", "const descriptor=TILE_INSTANCES.instances.find(r=>r.id===(id==='plainD7'?'roundEnd-D7':id+'-L9'));if(!descriptor)throw Error('Missing end-tile recipe '+id);const kind=descriptor.carrierRecipe.startsWith('pan')?'pan':'cover',body=shellMesh(kind,set)");
requiredReplace("let centerY=kind==='pan'?0:undefined;", "const tileObject=TilesJoint.create({id,kind,carrier:TilesMother.create(body.definition.object),source:t,depth:STUDY.depth,relief:STUDY.relief,fittedFace:face.continuousFace});let centerY=tileObject.centerY;");
const coverFitOld=` if(kind==='cover'){
  let low=-Infinity,high=Infinity,rx=t.width_m/2,ry=t.height_m/2;for(let [x,y]of hp){let d=ry*Math.sqrt(Math.max(0,1-(x/rx)**2));low=Math.max(low,y-d+.0003);high=Math.min(high,y+d-.0003);}centerY=clamp(P.h-ry+.003,Math.min(low,high),Math.max(low,high));
 }`;
requiredReplace(coverFitOld,' // centerY is computed by the continuous joined-end rule.');

requiredReplace('for(let i=0;i<face.frontCount;i++){let p=[-face.p[i*3],face.p[i*3+1]+centerY,z0-STUDY.depth/2-face.p[i*3+2]];G.vertex(p);reference.push(...p);}', 'for(let i=0;i<face.frontCount;i++){let x=face.p[i*3],y=face.p[i*3+1],p=tileObject.faceAt(x,y,0);G.vertex(p,1,3,0,0);reference.push(...tileObject.materialPoint(x,y,0));}');
requiredReplace('for(let i of outer){let p=[-face.p[i*3],centerY+face.p[i*3+1],z0];back.push(G.vertex(p));reference.push(...p);}', 'for(let i of outer){let x=face.p[i*3],y=face.p[i*3+1],p=tileObject.faceAt(x,y,1);back.push(G.vertex(p,1,3,1,0));reference.push(...tileObject.materialPoint(x,y,1));}');

requiredReplace("separateFloatingParts:0,construction:'both internal end caps removed; drip outer silhouette adapted to full pan lip by user request; internal motif retained',unit:'m'};END_CACHE.set", "separateFloatingParts:0,construction:'both internal end caps removed; drip outer silhouette adapted to full pan lip by user request; internal motif retained',unit:'m'};G.definition.continuous=tileObject.definition();END_CACHE.set");

requiredReplace("const id='plainD7',oldDepth=STUDY.depth,oldRelief=STUDY.relief;", "const id='plainD7',recipe=TILE_INSTANCES.instances.find(r=>r.id==='roundEnd-D7'),oldDepth=STUDY.depth,oldRelief=STUDY.relief;if(!recipe)throw Error('Missing D7 round recipe');");
requiredReplace("width_m:.123,height_m:.123,curves:[],outline:Array.from({length:192},(_,i)=>[.0615*Math.cos(i*TAU/192),.0615*Math.sin(i*TAU/192)])", "width_m:recipe.diameter_m,height_m:recipe.diameter_m,curves:[],outline:Array.from({length:192},(_,i)=>[recipe.diameter_m*.5*Math.cos(i*TAU/192),recipe.diameter_m*.5*Math.sin(i*TAU/192)])");
requiredReplace('STUDY.depth=.010;STUDY.relief=0;', 'STUDY.depth=recipe.depth_m;STUDY.relief=0;');
// The inclined D7 cap uses a function over the entire joined tile.
const roundStart=html.indexOf('function roundEnd09H(){'),roundTry=html.indexOf(' try{',roundStart),roundFinally=html.indexOf('}finally{STUDY.depth=oldDepth;',roundTry);
if(roundStart<0||roundTry<0||roundFinally<0)throw Error('Missing round end source');
html=html.slice(0,roundTry)+` try{
  const raw=integratedEnd(id,'D7'),G=new Mesh(),carrier=sheetDefinition('cover','D7');
  const joined=TilesJoint.create({id,kind:'cover',carrier,source:SOURCE_CURVES[id],depth:recipe.depth_m,relief:0});
  const shape=TilesRound.create({joined,diameter:recipe.diameter_m,plateThickness:recipe.depth_m,projectedHeight:recipe.projectedHeight_m,bodyLength:recipe.bodyLength_m,totalLength:recipe.totalLength_m}),reference=[];
  for(let i=0;i<raw.p.length;i+=3){let p=shape.transform(Array.from(raw.p.slice(i,i+3))),m=Array.from(raw.meta.slice(i/3*4,i/3*4+4));G.vertex(p,...m);reference.push(...raw.reference.slice(i,i+3));}
  G.idx=Array.from(raw.idx);G.finish();G.reference=new Float32Array(reference);
  G.definition={source:'D7',kind:'inclined plain round head continuously joined to cover',diameter_m:recipe.diameter_m,total_length_m:recipe.totalLength_m,projected_height_m:recipe.projectedHeight_m,plate_thickness_m:recipe.depth_m,side_labels_m:[.232,.198],inclination_rad:shape.angle,status:'side-profile reconstruction; inclination inferred; 232/198 dimension endpoints remain uncertain',separateFloatingParts:0,continuous:shape.definition()};return G;
 `+html.slice(roundFinally);



const start=html.indexOf('function shellMesh(kind,set=STUDY.set){'),end=html.indexOf('// Same exact projected-triangle method',start);
if(start<0||end<0)throw Error('Missing 09H shell boundary');
html=html.slice(0,start)+`function sheetDefinition(kind,set=STUDY.set){
 const C=spec(set).cover,amount=['pan','cover'].includes(STUDY.id)?STUDY.sheetPress:1;
 const change={wave:{strength:settings.micStrength,scale:settings.micScale},press:{amount},material:{color:settings.micColor,roughness:settings.micRough,brightness:settings.brightness,warmth:settings.warmth,patina:settings.patina,wet:settings.wet,variation:settings.variation,core:settings.core}};
 if(kind==='cover'){change.sheet={length:C.body+C.neck};change.press.shoulder={...SHEET_LIBRARY.instances['cover-'+set].press.shoulder,at:C.body/(C.body+C.neck),span:.002/(C.body+C.neck)};}
 const recipe=TILE_INSTANCES.instances.find(x=>x.id===kind+'-'+set);if(!recipe)throw Error('Missing tile recipe '+kind+'-'+set);return TilesMother.instantiate(SHEET_LIBRARY,recipe.recipe,change);
}
function shellMesh(kind,set=STUDY.set){
 const detail=['cover','pan'].includes(STUDY.id)?192:80,amount=['pan','cover'].includes(STUDY.id)?STUDY.sheetPress:1,key=[kind,set,STUDY.datum,settings.micStrength,settings.micScale,detail,amount].join('/');if(TILE_CACHE.has(key))return TILE_CACHE.get(key);if(amount!==1)for(const old of TILE_CACHE.keys())if(!old.endsWith('/1'))TILE_CACHE.delete(old);
 const p=spec(set),C=p.cover;ACTIVE_COVER=C;
 PROFILE.pan={l:p.pan.l,w0:p.pan.w0,w1:p.pan.w1,h0:p.pan.h,h1:p.pan.h*.94,t:p.pan.t};
 PROFILE.cover={l:C.body+C.neck,w0:C.w,w1:C.wn,h0:C.h,h1:C.hn,t:C.t};
 const e=sheetDefinition(kind,set),g=SheetDisplay.sample(e,detail,kind==='pan'?1:2);
 g.definition={kind,set,function:'kaopu.sheet/3',profile:JSON.parse(JSON.stringify(PROFILE[kind])),neck:kind==='cover'?C.neck:null,source:'shared bounded sheet + signed pressing recipe',object:e.definition(),unit:'m',error_m:null};TILE_CACHE.set(key,g);return g;
}
`+html.slice(end);
html=html.replace("const STUDY={id:'tileSystem'","const STUDY={sheetPress:1,id:'tileSystem'");
// Same evaluator's scalar material functions execute in the fragment backend.
let f=html.indexOf('const FRAG='),precision=html.indexOf('precision highp float;',f);
html=html.slice(0,precision)+html.slice(precision).replace('precision highp float;','precision highp float;\n'+glsl+'\nin float vSheetQ;');
const v=html.indexOf('const VERT='),ve=html.indexOf('const DEPTH_VERTEX=',v);
let vertex=html.slice(v,ve).replace('void main(){','out float vSheetQ;\nvoid main(){').replace('vWorld=p.xyz;','vSheetQ=aMeta.z;vWorld=p.xyz;');html=html.slice(0,v)+vertex+html.slice(ve);
f=html.indexOf('const FRAG=');const materialStart=html.indexOf(' if(uType==0){',f),materialEnd=html.indexOf('   // Existing year-dependent damage',materialStart);
if(materialStart<0||materialEnd<0)throw Error('Missing ceramic shader block');
html=html.slice(0,materialStart)+` if(uType==0){
   MotherWave wf=fieldRule(p.x,p.y,p.z,${require('./route-a.cjs').identity(31)},24.*uMicroscope.y,fp,.30,.85);
   MotherMaterial mm=MotherMaterial(uMicroscope.z,uMicroscope.w,uColor.x,uSurface.y,uSurface.z,uSurface.w,tint,uColor.z,uColor.w);
   MotherSurface material=materialRule(wf.value,wf.fine,wf.gradient.x,wf.gradient.y,wf.gradient.z,mm,uMicroscope.x,skinRule(vSheetQ));
   MicroSurface micro;micro.value=wf.value;micro.fine=wf.fine;micro.gradient=wf.gradient;
   base=material.color;rough=material.roughness;
   if(uDiagnostic!=1&&uMicroscope.x>0.)N=microscopeNormal(N,vWorld,p,material.microGradient);
`+html.slice(materialEnd);
html=html.replace('<title>Brick & Tiles Mother · 09H 同屏 · 全表面 · 压印细节版</title>','<title>Tiles Mother · 09N · 完整瓦工作台候选</title>');
html=html.replace('09H · 折坡连续搭接 / 落梁支承 / 逐砖自然差异','09N · 完整构件 / 连续函数 / 同尺度细节');
html=html.replace('09H · 图示尺寸转录 / 未知深度可调 / 非测量定稿','09N · 共同片母体 R04 / 原图与09H参照保留');
html=html.replaceAll("'09H · '+","'09N · '+");
html=html.replace("'09H：筒瓦和板瓦可同屏；上面、底面、侧边、大小端与小头共同接受较弱连续起伏。图示数值转录；误差未知。D7：H1放大后暂读3.5 cm，H2为3.2 cm；恢复08D圆弧薄壳、手工边口与Microscope真实位移；弧线为模型假设。L9小头长度、截面高度和厚度未注，均为显示假设。'","'09I：同一张基础片，通过不同参数形成板瓦、筒瓦及小头；微形态、颜色与粗糙度按同一材料位置求值。可在单瓦视图中查看平片到成形。保留09H的图示尺寸与造波细节；弧线及未注尺寸仍是模型假设。'");
html=html.replaceAll("version:'09H-surface-contact-timber-repair'","version:'09N-shared-sheet-r04'");
html=html.replace("this.definition={id:e.id,version:'09H'","this.definition={id:e.id,version:'09N'");
const controls='<div id="sheetControls"><h3>同一张片 · 连续压形</h3><p class="tiny">选择单片板瓦或筒瓦，改变压形程度；表面花纹随同一位置移动。</p><label>压形程度 <output id="sheetPressValue">100%</output><input id="sheetPress" type="range" min="0" max="1" step="0.05" value="1"></label><div class="presets"><button id="sheetFlat">平片</button><button id="sheetFormed">成形</button></div><p class="tiny" id="sheetScope">板瓦与筒瓦共用同一个形体及材料求值器。</p></div>';
html=html.replace('<div id="sourceChoice">',controls+'<div id="sourceChoice">');
html=html.replace('Math.min(window.devicePixelRatio||1,1.5)', 'Math.min((window.devicePixelRatio||1)*1.25,2)');
requiredReplace('this.shadowSize=1024;this.depth=gl.createTexture()', 'this.shadowSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));this.depth=gl.createTexture()');
requiredReplace('gl.DEPTH_COMPONENT24,1024,1024,0', 'gl.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0');
requiredReplace('g.uniform1f(U.uShadowTexel,1/1024)', 'g.uniform1f(U.uShadowTexel,1/this.shadowSize)');
requiredReplace('g.viewport(0,0,1024,1024)', 'g.viewport(0,0,this.shadowSize,this.shadowSize)');

requiredReplace("['图示长',p.pan.l*100+' cm']", "['模型长',Number((p.pan.l*100).toFixed(2))+' cm']");
requiredReplace("p.pan.w0*100+' / '+p.pan.w1*100+' cm'", "Number((p.pan.w0*100).toFixed(2))+' / '+Number((p.pan.w1*100).toFixed(2))+' cm'");
requiredReplace("p.pan.t*100+' cm'", "Number((p.pan.t*100).toFixed(2))+' cm'");

html=html.replaceAll('09I：同一张基础片', '09N：同一张基础片');
html=html.replace('<button id="settings"', '<button id="objectInfoToggle">对象 / 体积</button><button id="settings"');
html=html.replace('<div id="busy">', infoPanel+'<div id="busy">');
requiredReplace('JSON.stringify({definition:workshop.definition,objects:workshop.records,study:STUDY},null,2)', 'JSON.stringify(TilesRecord.pack({definition:workshop.definition,records:workshop.records,study:STUDY,ruleManifest:TILE_RULE_MANIFEST}),null,2)');
html=html.replace('function initStudy(){','function initStudy(){\ninstallObjectInfo09N();\nconst press=document.getElementById("sheetPress");press.oninput=()=>{document.getElementById("sheetPressValue").textContent=Math.round(press.value*100)+"%";};press.onchange=()=>{STUDY.sheetPress=+press.value;rebuild(false)};document.getElementById("sheetFlat").onclick=()=>{press.value=0;press.oninput();press.onchange()};document.getElementById("sheetFormed").onclick=()=>{press.value=1;press.oninput();press.onchange()};\n');
requiredReplace("studyUpdate();$('#busy').hidden=true;document.body.dataset.ready='true';resolve(true);","studyUpdate();if(!document.getElementById('objectInfoPanel').hidden)refreshObjectInfo09N();$('#busy').hidden=true;document.body.dataset.ready='true';resolve(true);");
// Refresh controls when the retained catalogue changes; assembly instances remain formed.
html=html.replace('function updateEvidence(){','function updateEvidence(){document.getElementById("sheetControls").hidden=!(["pan","cover"].includes(STUDY.id));');
if(!html.includes('function updateEvidence(){')){
 const marker='function refreshStudyUI(){';
 if(html.includes(marker))html=html.replace(marker,marker+'document.getElementById("sheetControls").hidden=!(["pan","cover"].includes(STUDY.id));');
 else html=html.replace('function rebuild(reset=false){','function rebuild(reset=false){document.getElementById("sheetControls").hidden=!(["pan","cover"].includes(STUDY.id));');
}
html=html.replace('window.TilesClean={','window.TilesMotherR04={mother:TilesMother,endFace:TilesEnd,drip:TilesDrip,joinedEnd:TilesJoint,roundEnd:TilesRound,profile:TilesProfile,rolled:TilesRolled,band:TilesBand,folded:TilesFolded,flat:TilesFlat,instances:TILE_INSTANCES,library:SHEET_LIBRARY,evaluator:()=>sheetDefinition(STUDY.id==="cover"?"cover":"pan"),study:STUDY};window.TilesClean={');
html=html.replace('function stitchSourceRoofs09H(workshop){',fs.readFileSync(root+'/warm-fold.js','utf8')+'\nfunction stitchSourceRoofs09H(workshop){');
html=html.replace('chosen=null;if(!chosen){for(let shift','chosen=null;if(!chosen)chosen=warmFold09I(foldKey,pa,pb,ca,cb,a,b);if(!chosen){for(let shift');
html=html.replace("kind==='pan'?[.00008,f.pan.residual+.00008]:f.cover.contactGaps","kind==='pan'?(f.pan.contactGaps||[.00008,f.pan.residual+.00008]):f.cover.contactGaps");
// Cache only placements already checked against this version's actual geometry.
if(fs.existsSync(target+'/roof-cache09i.json')){
 const caches=JSON.parse(fs.readFileSync(target+'/roof-cache09i.json','utf8'));
 html=html.replace(/^for\(const \[k,v\] of .*\)ROOF_CACHE\.set\(k,v\);$/gm,'for(const [k,v] of '+JSON.stringify(caches.roof)+')ROOF_CACHE.set(k,v);');
 html=html.replace(/^for\(const \[k,v\] of .*\)SOURCE_FIT_CACHE09H\.set\(k,v\);$/gm,'for(const [k,v] of '+JSON.stringify(caches.fits)+')SOURCE_FIT_CACHE09H.set(k,v);');
}
if(fs.existsSync(target+'/stitch-cache09i.json'))html=html.replace(/^for\(const \[k,v\] of .*\)STITCH_SOLVE09H\.set\(k,v\);$/gm,'for(const [k,v] of '+fs.readFileSync(target+'/stitch-cache09i.json','utf8')+')STITCH_SOLVE09H.set(k,v);');
let bytes=0,withSize='';for(let i=0;i<8;i++){withSize=html.replace('__HTML_BYTES__',bytes.toLocaleString('zh-CN'));let next=Buffer.byteLength(withSize);if(next===bytes)break;bytes=next;}html=withSize;
fs.copyFileSync(root+'/tile-source-curves.json',target+'/tile-source-curves.json');
fs.writeFileSync(target+'/RULE_MANIFEST.json',JSON.stringify(ruleManifest,null,2));
fs.writeFileSync(target+'/START_HERE.html',html);
console.log(JSON.stringify({target,bytes:Buffer.byteLength(html),baselineAssets:baseline,sharedBytes:Buffer.byteLength(core)}));
