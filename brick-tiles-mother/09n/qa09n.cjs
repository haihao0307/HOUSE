const fs=require('fs'),h=fs.readFileSync(__dirname+'/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const Q=new Function('const settings={micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48};\n'+code.slice(0,code.indexOf('const $=s=>'))+'\nreturn {settings,STUDY,StudyWorkshop,CATALOG,woodRound,roundMember09H,roundProfile09H,shellMesh,M,displayMesh09H,ROOF_CACHE,SOURCE_FIT_CACHE09H,STITCH_SOLVE09H};')();
const report={version:'09N',entries:[],wood:[],pass:false};
Q.settings.micStrength=0;const flat=Q.woodRound(.075,.8);Q.settings.micStrength=1;const raised=Q.woodRound(.075,.8);Q.settings.micStrength=3;const stronger=Q.woodRound(.075,.8);Q.settings.micStrength=1;
for(let [name,g] of [['normal',raised],['strong',stronger]]){let max=0,sum=0,n=0;for(let i=0;i<g.p.length;i+=3){let d=Math.hypot(g.p[i]-flat.p[i],g.p[i+1]-flat.p[i+1],g.p[i+2]-flat.p[i+2]);max=Math.max(max,d);sum+=d*d;n++}report.wood.push({name,maxDisplacement_m:max,rms_m:Math.sqrt(sum/n),actualVertexChange:max>.0005,vertices:n})}
let gpu=[];const w=new Q.StudyWorkshop({clear(){gpu=[]},add(g,items,type){gpu.push({g:Q.displayMesh09H(g),items,type})}});
for(let id of ['tileSystem','seal','dripFloral','brickSystem','eaves','roofPatch','frame2','frame4','frame6','frame7','frame13','frame3','youChun','mainHouse','sideHouse','gateHouse','joinery']){
 Q.STUDY.id=id;Q.STUDY.family=Q.CATALOG.find(x=>x.id===id).family;let t=performance.now();w.build({});let groups=[...w.groups],bad=groups.filter(([id])=>/mortar-seat|^batten-|^deck-/.test(id)).map(x=>x[0]);let wood=groups.filter(([id,g])=>g.type===1&&/post|column|observed-beam/.test(id)).map(([id,g])=>({id,kind:g.mesh.definition.kind,round:g.mesh.wood?.round||g.mesh.definition.kind==='curved circular timber'}));
 let stone=groups.filter(([id])=>/stone|you-chun-base/.test(id)).map(([id,g])=>({id,type:g.type}));
 const q={id,buildMs:performance.now()-t,triangles:gpu.reduce((n,q)=>n+q.g.idx.length/3*q.items.length,0),draws:gpu.length,removedLayerViolations:bad,wood,stone,roof:w.definition.roofSubstrate||null};report.entries.push(q);console.log(id,q.buildMs.toFixed(0),q.triangles,bad.length);
}
report.pass=report.wood.every(q=>q.actualVertexChange)&&report.entries.every(q=>q.removedLayerViolations.length===0&&q.stone.every(s=>s.type===9));fs.writeFileSync('QA09N.json',JSON.stringify(report,null,2));console.log('PASS',report.pass);

fs.writeFileSync('roof-cache09n.json',JSON.stringify({roof:[...Q.ROOF_CACHE],fits:[...Q.SOURCE_FIT_CACHE09H]}));

fs.writeFileSync('stitch-cache09n.json',JSON.stringify([...Q.STITCH_SOLVE09H]));
