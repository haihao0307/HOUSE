'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),base=process.argv[2]?path.resolve(process.argv[2]):path.resolve(root,'../v098');
const THREE=require(path.join(base,'source/vendor/three_runtime.cjs'));
const s=fs.readFileSync(path.join(root,'source/app.js'),'utf8');
const code=s.slice(s.indexOf('const clamp'),s.indexOf('const threeText'))+s.slice(s.indexOf('const PROFILE'),s.indexOf('const state='))+s.slice(s.indexOf('function circleArcY'),s.indexOf('function makeDetail'))+s.slice(s.indexOf('function uvGateV098('),s.indexOf('function clearStage'));
const A=new Function('THREE','state',code+';return {makeTileGeometryV099,makeTileGeometryV098,uvGate,woodGeometry,woodUVGate,makeProxy,exactGap,settleTile};')(THREE,{geometryRevision:1,edgeStrength:1});
const failures=[],cases=[];
const hash=g=>crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).update(Buffer.from(g.index.array.buffer)).digest('hex');
function audit(g){const P=g.attributes.position.array,I=g.index.array,N=g.attributes.normal.array,keys=[];const edges=new Map(),ng=new Map();let zero=0,minSigned=Infinity,maxNormalGap=0;
 for(let i=0;i<P.length;i+=3){keys.push([P[i],P[i+1],P[i+2]].map(x=>Math.round(x*1e7)).join(','));const key=keys.at(-1),n=Array.from(N.slice(i,i+3));if(ng.has(key))maxNormalGap=Math.max(maxNormalGap,Math.hypot(...n.map((x,j)=>x-ng.get(key)[j])));else ng.set(key,n);}
 for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]],v=ids.map(i=>new THREE.Vector3(P[i*3],P[i*3+1],P[i*3+2])),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(n.length()<1e-12)zero++;for(let i=0;i<3;i++){const a=keys[ids[i]],b=keys[ids[(i+1)%3]],key=a<b?a+'|'+b:b+'|'+a;edges.set(key,(edges.get(key)||0)+1);}}
 for(const f of g.userData.surfaces)if(f.name==='top'||f.name==='bottom')for(let k=f.start;k<f.start+f.count;k+=3){const [a,b,c]=[I[k]*3,I[k+1]*3,I[k+2]*3],ny=(P[b+2]-P[a+2])*(P[c]-P[a])-(P[b]-P[a])*(P[c+2]-P[a+2]);minSigned=Math.min(minSigned,ny*(f.name==='top'?1:-1));}
 return {finite:Array.from(P).every(Number.isFinite)&&Array.from(N).every(Number.isFinite),zero,unpaired:Array.from(edges.values()).filter(v=>v!==2).length,minSigned,maxNormalGap,uv:A.uvGate(g).allPassed,vertices:P.length/3,triangles:I.length/3};
}
for(const kind of ['pan','cover'])for(const seed of [101,202,314159,61771,987654])for(const damageClass of [0,1,2])for(const [nu,nv] of [[10,14],[16,22],[36,46]])for(const edgeStrength of [0,1,1.5]){
 const opts={seed,damageClass,nu,nv,edgeStrength},g=A.makeTileGeometryV099(kind,opts),r=audit(g);if(!r.finite||r.zero||r.unpaired||r.minSigned<=0||!r.uv||r.maxNormalGap>1e-6)failures.push({kind,...opts,...r,details:!r.uv?A.uvGate(g):undefined});
 cases.push({kind,...opts,...r});g.dispose();
}
let positive=0,negative=0;for(const kind of ['pan','cover']){
 const g=A.makeTileGeometryV099(kind,{seed:2141}),same=A.makeTileGeometryV099(kind,{seed:2141}),other=A.makeTileGeometryV099(kind,{seed:2142}),old=A.makeTileGeometryV098(kind,{seed:2141});assert.equal(hash(g),hash(same));assert.notEqual(hash(g),hash(other));assert.notEqual(hash(g),hash(old));positive+=3;
 const bad=g.clone();bad.userData=g.userData;bad.attributes.uv.array.fill(0);assert.equal(A.uvGate(bad).allPassed,false);negative++;
 const reversed=g.clone();reversed.userData=g.userData;const sf=reversed.userData.surfaces.find(s=>s.name==='left'),ix=reversed.index.array;for(let k=sf.start;k<sf.start+sf.count;k+=3){let q=ix[k+1];ix[k+1]=ix[k+2];ix[k+2]=q;}assert.equal(A.uvGate(reversed).allPassed,false);negative++;
 const mirrored=g.clone();mirrored.userData=g.userData;for(let i=0;i<mirrored.attributes.uv.array.length;i+=2)mirrored.attributes.uv.array[i]=1-mirrored.attributes.uv.array[i];assert.equal(A.uvGate(mirrored).allPassed,false);negative++;
 [g,same,other,old,bad,reversed,mirrored].forEach(g=>g.dispose());
}
const report={version:'0.9.9',runtime:process.version,tileCases:cases.length,failures,positiveAssertions:positive,negativeAssertions:negative,range:{maxTriangles:Math.max(...cases.map(c=>c.triangles)),minTriangles:Math.min(...cases.map(c=>c.triangles))},allPassed:failures.length===0,visualApproved:false,productionApproved:false};
fs.writeFileSync(path.join(root,'qa/GEOMETRY.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,failures:failures.slice(0,3)},null,2));process.exitCode=failures.length?1:0;
