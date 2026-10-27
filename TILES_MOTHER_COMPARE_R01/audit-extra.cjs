'use strict';
// Independent extra audit. Run with Node from any cwd; writes only AUDIT_EXTRA.json.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const A=require('./a-constant.cjs');
const B=require('./b-constant-path-section.cjs');
const TF=require('./tlo-factory.cjs');
const {compileBoundary}=require('./compile-boundary.cjs');
const Old09J=require('../TILES_MOTHER_R03/shape.cjs');
const R02=require('../TILES_MOTHER_R02/mother.cjs');
const library=require('../TILES_MOTHER_R02/library.json');
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const report={
 scope:'Independent double-precision boundary/extreme-domain audit plus one original pan-L9 normal-rule counterexample; no browser, GPU, mobile or general sweep claim.',
 samples:0,acceptedConfigurations:0,rejectedConfigurations:0,
 maxAB:0,maxOriginal09J:0,maxNormalUnitError:0,compilerSourceCalls:[],issues:[]
};
const sizes=[
 [.0001,.0001,.0001],[10,10,10],[.1,.0001,.0001],
 [.0001,.1,.0001],[.1,.1,.0001],[10,.01,.01],
 [.01,10,.01],[1,1,.01],[.24,.21,.014]
];
const bends=[-1,-.9,-.45,-1e-6,-1e-16,-1e-308,-Number.MIN_VALUE,0,Number.MIN_VALUE,1e-308,1e-16,1e-6,.45,.9,1];
const edgePairs=[[1,1],[.94,.88],[.1,.1],[.1,1],[1,.1]];
for(const size of sizes)for(const bend of bends)for(const edges of edgePairs){
 let a,b,ae,be;
 try{a=A.create(size,bend,edges)}catch(e){ae=e}
 try{b=B.create(size,bend,edges)}catch(e){be=e}
 assert.equal(Boolean(ae),Boolean(be),'A/B parameter acceptance differs');
 if(ae){report.rejectedConfigurations++;continue}
 const old=Old09J.create(size,bend);
 report.acceptedConfigurations++;
 for(const u of[-edges[0],-edges[0]/2,0,edges[1]/2,edges[1]])
 for(const t of[0,.5,1])for(const q of[0,.5,1]){
  const pa=a.position(u,t,q),pb=b.position(u,t,q);
  assert(pa.every(Number.isFinite)&&pb.every(Number.isFinite));
  report.maxAB=Math.max(report.maxAB,dist(pa,pb));
  report.maxOriginal09J=Math.max(report.maxOriginal09J,dist(pa,old.position(u,t,q)));
  for(const e of[a,b])report.maxNormalUnitError=Math.max(report.maxNormalUnitError,Math.abs(Math.hypot(...e.normal(u))-1));
  report.samples++;
 }
 for(const e of[a,b]){
  const compiled=compileBoundary(e,edges);
  if(!report.compilerSourceCalls.includes(compiled.sourceCalls))report.compilerSourceCalls.push(compiled.sourceCalls);
 }
}
assert.equal(report.samples,24975);
assert.equal(report.acceptedConfigurations,555);
assert.equal(report.rejectedConfigurations,120);
assert(report.maxAB<1e-12&&report.maxOriginal09J<1e-12&&report.maxNormalUnitError<1e-12);

for(const shape of[A,B]){
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'instance-A.json'),'utf8'));
 const rules=TF.createRules(shape,'X');source.Object.mother=rules.mother;
 const e=rules.create(source),value=e.evaluate(.2,.3,.4);
 source.Object.shape.size[0]=9;source.Object.material.frequency=80;
 assert.deepEqual(e.evaluate(.2,.3,.4),value);
 const returned=e.definition();returned.Object.shape.bend=-1;
 assert.deepEqual(e.evaluate(.2,.3,.4),value);
 assert.throws(()=>rules.create({...e.definition(),Location:{site:'Hong Kong',secretGeometry:2}}));
}
report.instanceMutationIsolation=true;

// Same original R02 pan-L9 case, not a second variable-shape demonstration.
// Deliberately omit longitudinal normal motion to quantify why that shortcut is not equivalent.
const old=R02.instantiate(library,'pan-L9',{press:{formGain:0,handGain:0,edgeGain:0},wave:{strength:0}});
const counter={samples:0,maxPositionErrorM:0,maxAxialErrorM:0,at:null,
 scope:'Bottom face: naive cross-section-only radial thickness versus original complete surface-normal thickness.'};
for(let i=0;i<=100;i++)for(let j=0;j<=100;j++){
 const u=2*i/100-1,s=j/100,W=.21+(.19-.21)*s,h=.045+(.0423-.045)*s,T=.014;
 const k=2*h/(W*W/4+h*h),x=u*W/2,c=Math.sqrt(1-k*k*x*x);
 const naive=[x*(1+T*k),T/2+k*x*x/(1+c)-T*c,(s-.5)*.24];
 const full=old.shape(u,s,1);full[1]+=T/2;
 const error=dist(naive,full);
 if(error>counter.maxPositionErrorM){counter.maxPositionErrorM=error;counter.at=[u,s,1]}
 counter.maxAxialErrorM=Math.max(counter.maxAxialErrorM,Math.abs(naive[2]-full[2]));
 counter.samples++;
}
assert.equal(counter.samples,10201);
assert(counter.maxPositionErrorM>.000328&&counter.maxPositionErrorM<.000329);
report.naiveVariableSectionCounterexample=counter;
report.files={};
for(const name of['a-constant.cjs','b-constant-path-section.cjs','contract.cjs','material.cjs','tlo-factory.cjs','compile-boundary.cjs','../TILES_MOTHER_R03/shape.cjs','../TILES_MOTHER_R02/mother.cjs','../TILES_MOTHER_R02/library.json']){
 const bytes=fs.readFileSync(path.join(__dirname,name));
 report.files[name]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
report.compilerWarning='The 27 fit-grid points are a known-family regression guard, not proof that an arbitrary evaluator belongs to the supported family. sourceCalls counts API entries, not every nested mathematical function.';
report.pass=true;
fs.writeFileSync(path.join(__dirname,'AUDIT_EXTRA.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
