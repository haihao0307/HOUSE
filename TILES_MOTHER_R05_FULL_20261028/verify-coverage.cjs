const fs=require('fs'),h=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09n-20261028/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const Q=Function('const settings={micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48};\n'+code.slice(0,code.indexOf('const $=s=>'))+'\nreturn {settings,STUDY,StudyWorkshop,CATALOG,profileTileMesh09N,roundEnd09H,integratedEnd,TilesMother,SHEET_LIBRARY,SOURCE_CURVES,TilesJoint,TilesDrip,TilesRound};')();
let p=Q.profileTileMesh09N(.045,.045,.17),edge=new Map(),volume=0;
for(let i=0;i<p.idx.length;i+=3){let [a,b,c]=Array.from(p.idx.slice(i,i+3));for(const [x,y] of [[a,b],[b,c],[c,a]]){let k=x<y?x+','+y:y+','+x;edge.set(k,(edge.get(k)||0)+1)}let A=p.p.slice(a*3,a*3+3),B=p.p.slice(b*3,b*3+3),C=p.p.slice(c*3,c*3+3);volume+=(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6}
const defects=[...edge.values()].filter(x=>x!==2).length;console.log('profile tile edges',edge.size,'nonmanifold',defects,'signed volume',volume);if(defects||volume<=0)process.exitCode=1;
for(const id of ['tileSystem','seal','seeds','flower','dripFloral','dripBeast','roundEnd','eaves','ridge','ridgeD5']){
 Q.STUDY.id=id;Q.STUDY.family=Q.CATALOG.find(x=>x.id===id).family;let w=new Q.StudyWorkshop({clear(){},add(){}}),t=performance.now();
 try{w.build({});let groups=[...w.groups].filter(([k,g])=>/^(integrated-|gallery-round-end|eave-drip|eave-goutou|eye-tile|round-course|D7-inclined)/.test(k)).map(([k,g])=>[k,g.mesh.definition?.kind,!!g.mesh.definition?.continuous]);console.log(id,Math.round(performance.now()-t),JSON.stringify(groups));}
 catch(e){console.log('FAIL',id,e.stack);process.exitCode=1;break}
}
