'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),base=path.resolve(root,'../v098');
const runtime=process.argv[2]||path.join(base,'source/vendor/three_runtime.cjs');const THREE=require(runtime);
const s=fs.readFileSync(path.join(root,'source/app.js'),'utf8');
const state={geometryRevision:1,edgeStrength:1,fieldMode:1,fibreEnds:true,year:8,rainInput:1,loadFactor:1,seed:314159,care:'abandoned',initialAge:25,mossEnabled:true,mossThickness:.8,mode:'material'};
const code=s.slice(s.indexOf('const clamp'),s.indexOf('const threeText'))+s.slice(s.indexOf('const PROFILE'),s.indexOf('const state='))+s.slice(s.indexOf('function circleArcY'),s.indexOf('function makeDetail'))+s.slice(s.indexOf('function uvGateV098('),s.indexOf('function clearStage'))+fs.readFileSync(path.join(root,'source/field_model.js'),'utf8')+fs.readFileSync(path.join(root,'source/field_geometry.js'),'utf8');
const A=new Function('THREE','state',code+';return {makeTileGeometryV099,makeTileGeometryV098,makeTileGeometry,uvGate,woodGeometryV0910,woodGeometry,woodUVGate,fieldTileHalf,fieldTileDemand,fieldBeamDemand,fieldIntegrateTimber,fieldLife,makeProxy,exactGap};')(THREE,state);
function meshAudit(g){const P=g.attributes.position.array,I=g.index.array,U=g.attributes.uv?.array,N=g.attributes.normal.array,keys=[],edges=new Map();let zero=0;
 for(let i=0;i<P.length;i+=3)keys.push([P[i],P[i+1],P[i+2]].map(x=>Math.round(x*1e6)).join(','));
 for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]],v=ids.map(i=>new THREE.Vector3(P[i*3],P[i*3+1],P[i*3+2]));if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length()<1e-12)zero++;for(let i=0;i<3;i++){let a=keys[ids[i]],b=keys[ids[(i+1)%3]],key=a<b?a+'|'+b:b+'|'+a;edges.set(key,(edges.get(key)||0)+1);}}
 return {finite:[P,N,U].filter(Boolean).every(a=>Array.from(a).every(Number.isFinite)),zero,unpaired:[...edges.values()].filter(x=>x!==2).length,triangles:I.length/3};
}
const rows=[],failure=[];
for(const seed of [101,202,314159,987654])for(const kind of ['pan','cover'])for(const side of [-1,1]){
 const g=A.fieldTileHalf(kind,seed,side,.12),r=meshAudit(g);rows.push({kind,seed,side,...r});if(!r.finite||r.zero||r.unpaired)failure.push(rows.at(-1));g.dispose();
}
for(const r of [.04,.069])for(const seed of [101,313,314159]){
 const g=A.woodGeometry(.72,32,seed,r,t=>({loss:.24+.08*Math.sin(t*2),stain:.5,y:0}),[[.44,.54]]),v=meshAudit(g),uv=A.woodUVGate(g);rows.push({kind:'wood',seed,r,...v,uv});if(!v.finite||v.zero||v.unpaired||!uv.allPassed)failure.push(rows.at(-1));g.dispose();
}
const progress=[];for(const [rows,cols] of [[6,4],[20,22]])for(const y of [0,3,5,7,10,15]){state.year=y;const m=A.fieldIntegrateTimber(rows,cols);progress.push({rows,cols,y,panMissing:m.panStates.filter(x=>x.missing).length,maxRafter:Math.max(...m.loss),maxBeam:Math.max(...m.beamLoss)});}
let assertions=0;const hash=g=>crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).update(Buffer.from(g.index.array.buffer)).digest('hex');
for(const kind of ['pan','cover']){const g=A.makeTileGeometry(kind,{seed:202}),b=A.makeTileGeometryV099(kind,{seed:202});assert.equal(hash(g),hash(b));assertions++;g.dispose();b.dispose();}
for(const year of [0,5,10]){const a=A.fieldBeamDemand(.62,.048,year,314159,1,.7),b=A.fieldBeamDemand(.62,.048,year,314159,1,1.4);assert(Math.abs(b.ratio-2*a.ratio)<1e-9);assertions++;}
const report={version:'0.9.11',runtime:process.version,geometryCases:rows.length,failures:failure,allPassed:failure.length===0,assertions,progress,lab:{tile:A.fieldTileDemand('pan',8,314159,1,1),wood:A.fieldBeamDemand(.62,.048,8,314159+437,1,1)},scope:'Geometry and CPU schematic fields; not GPU, measured material strength or structural safety',visualApproved:false,productionApproved:false};
fs.writeFileSync(path.join(root,'qa/GEOMETRY.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failure.length)process.exitCode=1;
