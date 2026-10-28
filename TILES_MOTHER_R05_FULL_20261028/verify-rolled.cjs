const fs=require('fs'),h=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09n-20261028/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const Q=Function('const settings={micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48};\n'+code.slice(0,code.indexOf('const $=s=>'))+'\nreturn {STUDY,StudyWorkshop,CATALOG,rolledTileMesh09N,TilesRolled,SHEET_LIBRARY};')();
for(const [name,o,i,L,a] of [['tube',.067,.047,1.12,2*Math.PI],['hood',.095,.079,.188,Math.PI]]){
 let t=performance.now(),p=Q.rolledTileMesh09N(o,i,L,a),edge=new Map(),volume=0;
 for(let z=0;z<p.idx.length;z+=3){let [v,w,x]=Array.from(p.idx.slice(z,z+3));for(const [b,c] of [[v,w],[w,x],[x,v]]){let k=b<c?b+','+c:c+','+b;edge.set(k,(edge.get(k)||0)+1)}let A=p.p.slice(v*3,v*3+3),B=p.p.slice(w*3,w*3+3),C=p.p.slice(x*3,x*3+3);volume+=(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6}
 let defects=[...edge.values()].filter(x=>x!==2).length;console.log(name,'ms',Math.round(performance.now()-t),'points',p.p.length/3,'nonmanifold',defects,'volume',volume);if(defects||volume<=0)process.exitCode=1;
}
for(const id of ['ridge','ridgeD5']){Q.STUDY.id=id;Q.STUDY.family='roof';let w=new Q.StudyWorkshop({clear(){},add(){}});let t=performance.now();w.build({});console.log(id,'ms',Math.round(performance.now()-t),[...w.groups].filter(([k])=>k.includes('baotong')||k.includes('eye')).map(([k,g])=>[k,!!g.mesh.definition?.continuous]));}
