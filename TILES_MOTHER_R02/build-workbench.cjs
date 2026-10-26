const fs=require('fs'),path=require('path'),root=__dirname;
const target='G:/HOUSE/brick-tiles-mother-09i-20261026';fs.mkdirSync(target,{recursive:true});
const baseline='https://raw.githack.com/haihao0307/HOUSE/bbf1f063c1a256cc1d41f107dcd054e944dcc48d/brick-tiles-mother/09h/';
let html=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09h-20261026/START_HERE.html','utf8');
const core=fs.readFileSync(root+'/mother.cjs','utf8'),lib=fs.readFileSync(root+'/library.json','utf8'),glsl=require('./shader-adapter.cjs').glsl();
let sampler=fs.readFileSync('G:/HOUSE/TILE_FUNCTION_R01/display-adapter.cjs','utf8');
sampler=sampler.replace('function sample(evaluator,detail=80)','function sample(evaluator,detail=80,tag=1)');
sampler=sampler.replace(/function vertex\(u,t,q,skin\)\{[^\n]+\}/,'function vertex(u,t,q,skin){let p=evaluator.materialPoint(u,t,q);reference.push(...p);G.vertex(evaluator.position(u,t,q),skin,tag,q,u);}');
const wrap=(name,code)=>'const '+name+'=(()=>{const module={exports:{}};\n'+code+'\nreturn module.exports})();\n';
html=html.replace('<head>','<head><base href="'+baseline+'">');
html=html.replace('<script>','<script>\n'+wrap('TilesMother',core)+wrap('SheetDisplay',sampler)+'const SHEET_LIBRARY='+lib+';\n');
const start=html.indexOf('function shellMesh(kind,set=STUDY.set){'),end=html.indexOf('// Same exact projected-triangle method',start);
if(start<0||end<0)throw Error('Missing 09H shell boundary');
html=html.slice(0,start)+`function sheetDefinition(kind,set=STUDY.set){
 const C=spec(set).cover,amount=['pan','cover'].includes(STUDY.id)?STUDY.sheetPress:1;
 const change={wave:{strength:settings.micStrength,scale:settings.micScale},press:{amount},material:{color:settings.micColor,roughness:settings.micRough,brightness:settings.brightness,warmth:settings.warmth,patina:settings.patina,wet:settings.wet,variation:settings.variation,core:settings.core}};
 if(kind==='cover'){change.sheet={length:C.body+C.neck};change.press.shoulder={...SHEET_LIBRARY.instances['cover-'+set].press.shoulder,at:C.body/(C.body+C.neck),span:.002/(C.body+C.neck)};}
 return TilesMother.instantiate(SHEET_LIBRARY,kind+'-'+set,change);
}
function shellMesh(kind,set=STUDY.set){
 const detail=['cover','pan'].includes(STUDY.id)?192:80,amount=['pan','cover'].includes(STUDY.id)?STUDY.sheetPress:1,key=[kind,set,STUDY.datum,settings.micStrength,settings.micScale,detail,amount].join('/');if(TILE_CACHE.has(key))return TILE_CACHE.get(key);if(amount!==1)for(const old of TILE_CACHE.keys())if(!old.endsWith('/1'))TILE_CACHE.delete(old);
 const p=spec(set),C=p.cover;ACTIVE_COVER=C;
 PROFILE.pan={l:p.pan.l,w0:p.pan.w0,w1:p.pan.w1,h0:p.pan.h,h1:p.pan.h*.94,t:p.pan.t};
 PROFILE.cover={l:C.body+C.neck,w0:C.w,w1:C.wn,h0:C.h,h1:C.hn,t:C.t};
 const e=sheetDefinition(kind,set),g=SheetDisplay.sample(e,detail,kind==='pan'?1:2);
 g.definition={kind,set,function:'kaopu.sheet/2',profile:JSON.parse(JSON.stringify(PROFILE[kind])),neck:kind==='cover'?C.neck:null,source:'shared bounded sheet + signed pressing recipe',object:e.definition(),unit:'m',error_m:null};TILE_CACHE.set(key,g);return g;
}
`+html.slice(end);
html=html.replace("const STUDY={id:'tileSystem'","const STUDY={sheetPress:1,id:'pan'");
// Same evaluator's scalar material functions execute in the fragment backend.
let f=html.indexOf('const FRAG='),precision=html.indexOf('precision highp float;',f);
html=html.slice(0,precision)+html.slice(precision).replace('precision highp float;','precision highp float;\n'+glsl+'\nin float vSheetQ;');
const v=html.indexOf('const VERT='),ve=html.indexOf('const DEPTH_VERTEX=',v);
let vertex=html.slice(v,ve).replace('void main(){','out float vSheetQ;\nvoid main(){').replace('vWorld=p.xyz;','vSheetQ=aMeta.z;vWorld=p.xyz;');html=html.slice(0,v)+vertex+html.slice(ve);
f=html.indexOf('const FRAG=');const materialStart=html.indexOf(' if(uType==0){',f),materialEnd=html.indexOf('   // Existing year-dependent damage',materialStart);
if(materialStart<0||materialEnd<0)throw Error('Missing ceramic shader block');
html=html.slice(0,materialStart)+` if(uType==0){
   MotherWave wf=fieldRule(p.x,p.y,p.z,${require('./mother.cjs').identity(31)},24.*uMicroscope.y,fp,.30,.85);
   MotherMaterial mm=MotherMaterial(uMicroscope.z,uMicroscope.w,uColor.x,uSurface.y,uSurface.z,uSurface.w,tint,uColor.z,uColor.w);
   MotherSurface material=materialRule(wf.value,wf.fine,wf.gradient.x,wf.gradient.y,wf.gradient.z,mm,uMicroscope.x,skinRule(vSheetQ));
   MicroSurface micro;micro.value=wf.value;micro.fine=wf.fine;micro.gradient=wf.gradient;
   base=material.color;rough=material.roughness;
   if(uDiagnostic!=1&&uMicroscope.x>0.)N=microscopeNormal(N,vWorld,p,material.microGradient);
`+html.slice(materialEnd);
html=html.replace('<title>Brick & Tiles Mother · 09H 同屏 · 全表面 · 压印细节版</title>','<title>Tiles Mother · 09I · 共同基础片</title>');
html=html.replace('09H · 折坡连续搭接 / 落梁支承 / 逐砖自然差异','09I · 同一张片 / 连续压形 / 一体表面');
html=html.replace('09H · 图示尺寸转录 / 未知深度可调 / 非测量定稿','09I · 共同片母体 R02 / 原图与09H参照保留');
html=html.replaceAll("'09H · '+","'09I · '+");
html=html.replace("'09H：筒瓦和板瓦可同屏；上面、底面、侧边、大小端与小头共同接受较弱连续起伏。图示数值转录；误差未知。D7：H1放大后暂读3.5 cm，H2为3.2 cm；恢复08D圆弧薄壳、手工边口与Microscope真实位移；弧线为模型假设。L9小头长度、截面高度和厚度未注，均为显示假设。'","'09I：同一张基础片，通过不同参数形成板瓦、筒瓦及小头；微形态、颜色与粗糙度按同一材料位置求值。可在单瓦视图中查看平片到成形。保留09H的图示尺寸与造波细节；弧线及未注尺寸仍是模型假设。'");
html=html.replaceAll("version:'09H-surface-contact-timber-repair'","version:'09I-shared-sheet-r02'");
html=html.replace("this.definition={id:e.id,version:'09H'","this.definition={id:e.id,version:'09I'");
const controls='<div id="sheetControls"><h3>同一张片 · 连续压形</h3><p class="tiny">选择单片板瓦或筒瓦，改变压形程度；表面花纹随同一位置移动。</p><label>压形程度 <output id="sheetPressValue">100%</output><input id="sheetPress" type="range" min="0" max="1" step="0.05" value="1"></label><div class="presets"><button id="sheetFlat">平片</button><button id="sheetFormed">成形</button></div><p class="tiny" id="sheetScope">板瓦与筒瓦共用同一个形体及材料求值器。</p></div>';
html=html.replace('<div id="sourceChoice">',controls+'<div id="sourceChoice">');
html=html.replace('function initStudy(){','function initStudy(){\nconst press=document.getElementById("sheetPress");press.oninput=()=>{document.getElementById("sheetPressValue").textContent=Math.round(press.value*100)+"%";};press.onchange=()=>{STUDY.sheetPress=+press.value;rebuild(false)};document.getElementById("sheetFlat").onclick=()=>{press.value=0;press.oninput();press.onchange()};document.getElementById("sheetFormed").onclick=()=>{press.value=1;press.oninput();press.onchange()};\n');
// Refresh controls when the retained catalogue changes; assembly instances remain formed.
html=html.replace('function updateEvidence(){','function updateEvidence(){document.getElementById("sheetControls").hidden=!(["pan","cover"].includes(STUDY.id));');
if(!html.includes('function updateEvidence(){')){
 const marker='function refreshStudyUI(){';
 if(html.includes(marker))html=html.replace(marker,marker+'document.getElementById("sheetControls").hidden=!(["pan","cover"].includes(STUDY.id));');
 else html=html.replace('function rebuild(reset=false){','function rebuild(reset=false){document.getElementById("sheetControls").hidden=!(["pan","cover"].includes(STUDY.id));');
}
html=html.replace('window.TilesClean={','window.TilesMotherR02={mother:TilesMother,library:SHEET_LIBRARY,evaluator:()=>sheetDefinition(STUDY.id==="cover"?"cover":"pan"),study:STUDY};window.TilesClean={');
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
fs.writeFileSync(target+'/START_HERE.html',html);
console.log(JSON.stringify({target,bytes:Buffer.byteLength(html),baselineAssets:baseline,sharedBytes:Buffer.byteLength(core)}));
