'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto'),{performance}=require('node:perf_hooks');
const root=__dirname,A=require('./route-a.cjs'),B=require('./route-b.cjs'),R=require('./baseline-r03/mother.cjs'),lib=require('./library.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(root+'/'+f);
const maxv=(x,y)=>Math.max(...x.map((v,i)=>Math.abs(v-y[i]))),length=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
const errors={aVsOriginal_m:0,bVsOriginal_m:0,aVsB_m:0,shapeA_m:0,shapeB_m:0},counts={};let checks=0,materialChecks=0;
const names=['flat','pan-L9','cover-L9','pan-D7','cover-D7'];
for(const name of names){counts[name]=0;
 for(const amount of [0,.5,1])for(const strength of [0,1,2]){
  const options={press:{amount},wave:{strength}},a=A.instantiate(lib,name,options),b=B.instantiate(lib,name,options),r=R.instantiate(lib,name,options);
  for(let i=0;i<180;i++){
   const u=2*((i*.61803398875)%1)-1,t=i%6===0?[0,.82,.87,.875,.9,1][Math.floor(i/6)%6]:(i*.41421356237)%1,q=i%3/2,fp=.0012;
   const x=a.evaluate(u,t,q,fp),y=b.evaluate(u,t,q,fp),z=r.evaluate(u,t,q,fp);
   errors.aVsOriginal_m=Math.max(errors.aVsOriginal_m,length(x.position,z.position));errors.bVsOriginal_m=Math.max(errors.bVsOriginal_m,length(y.position,z.position));errors.aVsB_m=Math.max(errors.aVsB_m,length(x.position,y.position));
   errors.shapeA_m=Math.max(errors.shapeA_m,length(a.shape(u,t,q),r.shape(u,t,q)));errors.shapeB_m=Math.max(errors.shapeB_m,length(b.shape(u,t,q),r.shape(u,t,q)));
   for(const key of ['materialPoint','materialAddress','color','roughness','metallic','microHeight','microGradient','embossHeight','displacementHeight']){assert.deepEqual(x[key],z[key]);assert.deepEqual(y[key],z[key]);materialChecks+=2}
   assert.deepEqual(a.sheetPoint(u,t,q),r.sheetPoint(u,t,q));assert.deepEqual(b.sheetPoint(u,t,q),r.sheetPoint(u,t,q));checks++;counts[name]++;
  }
 }
}
assert.ok(Object.values(errors).every(x=>x<1e-9));
// Exercise existing boundary and relief features without introducing generic decorations.
const option={outline:[[-.9,.05],[.9,.05],[.85,.95],[-.85,.95]],holes:[[[-.1,.4],[.1,.4],[.1,.6],[-.1,.6]]],emboss:[{points:[[-.5,.2],[.5,.8]],radius:.08,height:.001}]};
const cuts=[A,B,R].map(m=>m.instantiate(lib,'pan-L9',option));assert.ok(cuts.every(x=>!x.contains(0,.5)&&x.contains(.4,.5)&&!x.contains(.99,.5)));let cutValues=cuts.map(x=>x.evaluate(.4,.5,0,.0012));assert.ok(length(cutValues[0].position,cutValues[2].position)<1e-9&&length(cutValues[1].position,cutValues[2].position)<1e-9);assert.deepEqual(cutValues[0].embossHeight,cutValues[2].embossHeight);assert.deepEqual(cutValues[1].embossHeight,cutValues[2].embossHeight);
// Measured transverse size of the known cover sample, not a historical survey.
const width=(e,t)=>e.shape(1,t,0)[0]-e.shape(-1,t,0)[0];
const heads=Object.fromEntries(['cover-L9','cover-D7'].map(name=>{const e=A.instantiate(lib,name);const x={largeEnd_m:width(e,0),smallEnd_m:width(e,1)};assert.ok(x.smallEnd_m<x.largeEnd_m);return[name,x]}));
// R03's persistent object graph is reused with each candidate implementation.
const graphJSON=JSON.parse(fs.readFileSync(root+'/baseline-r03/OBJECTS.json'));
let graphs=[];for(const route of ['a','b']){
 const code=read('route-'+route+'.cjs'),obj=read('objects-route-'+route+'.cjs'),d=JSON.parse(JSON.stringify(graphJSON));d.rules.coreSha256=sha(code);d.rules.librarySha256=sha(read('library.json'));d.rules.objectSystemSha256=sha(obj);
 const g=require('./objects-route-'+route+'.cjs').open(d,read('library.json'),code);
 assert.deepEqual(g.ancestry('tile-001',0),['batch-A','roof-A','world']);graphs.push(g);
}
for(const t of [0,1,2]){const x=graphs[0].evaluate('tile-001',t,.2,.5,0),y=graphs[1].evaluate('tile-001',t,.2,.5,0);assert.equal(x.id,y.id);assert.deepEqual(x.owners,y.owners);assert.ok(length(x.worldPosition,y.worldPosition)<1e-9);assert.deepEqual(x.materialPoint,y.materialPoint)}
const os=require('node:os'),evaluators={A:A.instantiate(lib,'cover-L9'),B:B.instantiate(lib,'cover-L9')},trials={A:[],B:[]};
for(let run=0;run<10;run++)for(const label of (run%2?['B','A']:['A','B'])){let start=performance.now(),checksum=0,e=evaluators[label];for(let i=0;i<3000;i++){let p=e.evaluate(2*((i*.61803398875)%1)-1,(i*.41421356237)%1,0,.0012);checksum+=p.position[0]+p.color[0]+p.roughness}if(run>=3)trials[label].push({ms:performance.now()-start,checksum})}
const timing={environment:{platform:process.platform,arch:process.arch,node:process.version,cpu:os.cpus()[0]?.model},note:'Three alternating warmups then seven alternating measured trials; shape and material CPU queries, not browser frames; implementation and device dependent'};
for(const label of ['A','B']){let times=trials[label].map(x=>x.ms).sort((a,b)=>a-b);timing[label]={samplesPerTrial:3000,trialsMs:times,medianMs:times[3],checksum:trials[label][0].checksum}}
const files=['tile.cjs','tile.glsl','section.cjs','route-a.cjs','route-b.cjs','objects-route-a.cjs','objects-route-b.cjs','library.json'];const sizes=Object.fromEntries(files.map(f=>[f,{bytes:read(f).length,sha256:sha(read(f))}]));
const report={pass:true,baseline:'Local R03',scope:'Sampled continuous single-object R03 queries, including small-end, shoulders, material, wave, boundary and TLO graph; not all real tile types or complete 09H scene',counts,checks,materialChecks,maxErrors:errors,knownCoverSmallEnd:heads,boundaryAndEmbossPass:true,graphPass:true,shapesAndBytes:sizes,closure:{routeA:sizes['route-a.cjs'].bytes+sizes['tile.cjs'].bytes+sizes['section.cjs'].bytes+sizes['library.json'].bytes,routeB:sizes['route-b.cjs'].bytes+sizes['section.cjs'].bytes+sizes['library.json'].bytes,objectGraphA:sizes['objects-route-a.cjs'].bytes,objectGraphB:sizes['objects-route-b.cjs'].bytes,display:'not included'},timing,limits:['Tolerance-based numerical verification, not bitwise identity and not exhaustive over all parameters','TLO, source and old production files are retained; full 09H scene, rare patterns, GPU equivalence and visual acceptance not established','Arbitrary spine/path and two-wave coupled shape not implemented','Same bounded circular cross-sections and full legacy material rules; no universal ranking of representations from code size or timing']};
fs.writeFileSync(root+'/COMPARE_VALIDATION.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
