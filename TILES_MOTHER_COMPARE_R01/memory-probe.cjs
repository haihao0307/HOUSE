'use strict';
const fs=require('fs'),A=require('./a-constant.cjs'),B=require('./b-constant-path-section.cjs'),TF=require('./tlo-factory.cjs'),base=require('./instance-A.json');
if(!global.gc)throw Error('Run Node with --expose-gc for this local memory probe');
const mode=process.argv[2],count=10000,rules=TF.createRules(mode==='B'?B:A,mode==='B'?'B':'A');
function record(i){const r=structuredClone(base);r.Object.id=i.toString(16).padStart(16,'0');r.Object.mother=rules.mother;return r;}
for(let i=0;i<1000;i++)rules.create(record(i)).position(.2,.3,.4);
global.gc();const before=process.memoryUsage();const rows=[];
for(let i=0;i<count;i++){const r=record(i);rows.push(mode==='records'?r:rules.create(r));}
global.gc();const after=process.memoryUsage();let checksum=0;for(let i=0;i<rows.length;i+=113)checksum+=mode==='records'?rows[i].Object.shape.size[0]:rows[i].position(.2,.3,.4)[0];
console.log(JSON.stringify({mode,count,heapDeltaBytes:after.heapUsed-before.heapUsed,rssDeltaBytes:after.rss-before.rss,heapBytesPerEntry:(after.heapUsed-before.heapUsed)/count,checksum,warning:'GC-after live heap increment, not peak allocation, not serialized storage; allocator/JIT dependent. Cached evaluators retain closures and cloned source records.'}));
