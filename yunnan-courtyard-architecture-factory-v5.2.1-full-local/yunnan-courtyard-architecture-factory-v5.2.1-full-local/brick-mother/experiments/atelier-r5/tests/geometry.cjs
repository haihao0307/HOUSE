'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),K=require('../src/kernel.js');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../qa'));fs.mkdirSync(out,{recursive:true});
const oldPath=process.env.BRICK_R4_KERNEL||'/mnt/data/r5_work/base/r4-site/generated-src/kernel.js';
const old=fs.existsSync(oldPath)?require(oldPath):null;
const families=Object.keys(K.defaults),seeds={fired:5045,kiln:6112,adobe:4517,dressed:8231,rubble:9298,stone:10365,pebble:7213};
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function parameters(f,seed,shape){const p={family:f,...K.defaults[f],seed,shape,resolution:72};for(const k of ['shape','damage','color','fiber'])p[k+'Seed']=K.derive(seed,k);return p;}
function assert(b,s){if(!b)throw Error(s);}
function assess(a){
 for(const k of ['position','normal','data','kind'])assert(a[k].every(Number.isFinite),'nonfinite '+k);
 const edges=new Map(),P=a.position,I=a.index;let zero=0,volume=0;
 for(let i=0;i<I.length;i+=3){let [a,b,c]=[I[i],I[i+1],I[i+2]];assert(Math.max(a,b,c)<P.length/3,'index bound');
  const ax=P[a*3],ay=P[a*3+1],az=P[a*3+2],bx=P[b*3],by=P[b*3+1],bz=P[b*3+2],cx=P[c*3],cy=P[c*3+1],cz=P[c*3+2];
  const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  if(nx*nx+ny*ny+nz*nz<1e-22)zero++;
  if(i<I.length){for(const[u,v] of [[a,b],[b,c],[c,a]]){const key=Math.min(u,v)*aCount+Math.max(u,v);edges.set(key,(edges.get(key)||0)+1);}}
  if(i<arguments[0].stats.bodyIndexCount)volume+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
 }
 let open=0,nonManifold=0;for(const n of edges.values()){if(n===1)open++;if(n!==2)nonManifold++;}
 return{zero,open,nonManifold,volume};
}
let aCount=0;
let checks=[],configs=[];function check(name,f){f();checks.push({test:name,passed:true});}
for(const f of families)for(const shape of ['sample','long','half','thin'])for(const seed of [seeds[f],seeds[f]+1067]){
 console.log('configuration',f,shape,seed);const p=parameters(f,seed,shape),a=K.build(p);aCount=a.position.length/3+1;const m=assess(a);
 assert(m.zero===0,`${f}/${shape}/${seed}: zero faces ${m.zero}`);assert(m.nonManifold===0,`${f}/${shape}/${seed}: nonmanifold ${m.nonManifold}`);
 assert(a.stats.normalFieldEvaluations===0,'expensive normal re-query');
 if(f==='adobe'){const faces=new Set(a.stats.fiberAudit.map(x=>x.face));assert(faces.size===6,'missing straw face');assert(a.stats.riceHusks===0,'grain husks returned');}
 configs.push({family:f,shape,seed,vertices:a.stats.vertices,triangles:a.stats.triangles,ms:a.stats.buildMs,eventCount:a.stats.eventCount,...m});
 if(f==='adobe'&&shape==='sample'&&seed===seeds[f]){
  fs.writeFileSync(path.join(out,'adobe-mesh.json'),JSON.stringify({position:[...a.position.slice(0,a.stats.bodyVertices*3)],index:[...a.index.slice(0,a.stats.bodyIndexCount)],anchors:a.stats.fiberAudit.flatMap(t=>t.anchorSamples.map(p=>({id:t.id,face:t.face,point:p}))),stats:{fibers:a.stats.fibers,spacing:a.stats.spacing}}));
 }
}
check('56 default configurations: finite closed triangle meshes and six-face adobe',()=>assert(configs.length===56,'count'));
for(const f of ['fired','adobe','rubble','pebble'])check('deterministic '+f,()=>{const p=parameters(f,seeds[f],K.defaults[f].shape),a=K.build(p),b=K.build(p);assert(hash(a.position)===hash(b.position)&&hash(a.index)===hash(b.index),'nondeterministic');});
for(const f of ['dressed','rubble','stone','pebble'])if(old)check('R4 original rock geometry preserved '+f,()=>{const p=parameters(f,seeds[f],K.defaults[f].shape),a=K.build(p),b=old.build(p);for(const k of ['position','normal','index'])assert(hash(a[k])===hash(b[k]),'old shape changed '+f+' '+k);});
for(const f of ['fired','adobe','rubble','pebble'])check('material-only controls preserve geometry '+f,()=>{const p=parameters(f,seeds[f],K.defaults[f].shape),a=K.build(p),b=K.build({...p,rock:4,wet:.6,rough:.4,color:1.3,colorSeed:p.colorSeed+3});assert(hash(a.position)===hash(b.position)&&hash(a.index)===hash(b.index),'material changed geometry');});
for(const f of ['fired','kiln','adobe'])check('damage parameter extremes and edge wear '+f,()=>{for(const damage of [0,1])for(const edgeWear of [0,1]){const p=parameters(f,seeds[f],K.defaults[f].shape),a=K.build({...p,damage,edgeWear,resolution:72});aCount=a.position.length/3+1;const m=assess(a);assert(m.zero===0&&m.nonManifold===0,'extreme invalid');}});
check('invalid values are rejected',()=>{const p=parameters('fired',5045,'long');for(const q of [{edgeWear:NaN},{edgeWear:-1},{damage:2},{resolution:2},{seed:-1},{family:'__proto__'}]){let rejected=false;try{K.build({...p,...q})}catch{rejected=true}assert(rejected,JSON.stringify(q));}});
const comparisons=[];if(old)for(const f of ['fired','kiln','adobe']){const p=parameters(f,seeds[f],K.defaults[f].shape),a=K.build({...p,debug:true}),op={...p,...old.defaults[f],debug:true},b=old.build(op);aCount=a.position.length/3+1;let av=assess(a).volume;aCount=b.position.length/3+1;let bv=assess(b).volume;comparisons.push({family:f,newEventCount:a.stats.eventCount,oldEventCount:b.stats.eventCount,newDefaultRadius:a.stats.roundRadius,oldNominalRadius:f==='adobe'?.05:.036,newBodyVolume:av,oldBodyVolume:bv,newMaxCutterDepth:Math.max(0,...a.debug.events.map(e=>e.r[2])),oldMaxCutterDepth:Math.max(0,...b.debug.events.map(e=>e.r[2]))});}
const report={schema:'brick-r5-geometry-qa',node:process.version,checks,configurations:configs,defaultShapeComparisons:comparisons,oldKernelAvailable:!!old,wholeSurfaceIntersection:'not_tested',realDimensionsCalibrated:false,humanVisualApproved:false};fs.writeFileSync(path.join(out,'geometry-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:checks.length,configs:configs.length,comparison:comparisons},null,2));
