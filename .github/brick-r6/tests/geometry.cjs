'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),K=require('../src/kernel.js');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../qa'));fs.mkdirSync(out,{recursive:true});
function assert(b,t){if(!b)throw Error(t);}
const seeds={fired:5045,kiln:6112,adobe:4517,dressed:8231,rubble:9298,stone:10365,pebble:7213};
const rockFor=f=>f==='stone'?5:f==='pebble'?3:['dressed','rubble'].includes(f)?2:0;
function conf(f,seed=seeds[f],shape=K.defaults[f].shape){const p={...K.defaults[f],family:f,seed,shape,resolution:72,rock:rockFor(f),strawDensity:.6,huskDensity:.38,chisel:.45,strata:.82,roundness:.82};for(const k of ['shape','color','damage','fiber'])p[k+'Seed']=K.derive(seed,k);return p;}
const hash=m=>crypto.createHash('sha256').update(m.position).update(m.index).digest('hex');
function checkMesh(m){for(const k of ['position','normal','data','kind'])assert(m[k].every(Number.isFinite),'nonfinite '+k);const p=m.position,ix=m.index,vc=p.length/3,edges=new Map();let bad=0;
 for(let i=0;i<ix.length;i+=3){let a=ix[i],b=ix[i+1],c=ix[i+2];assert(Math.min(a,b,c)>=0&&Math.max(a,b,c)<vc,'indices');for(const[u,v]of[[a,b],[b,c],[c,a]]){let key=Math.min(u,v)*vc+Math.max(u,v);edges.set(key,(edges.get(key)||0)+1);}a*=3;b*=3;c*=3;const ab=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],ac=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];let x=ab[1]*ac[2]-ab[2]*ac[1],y=ab[2]*ac[0]-ab[0]*ac[2],z=ab[0]*ac[1]-ab[1]*ac[0];if(x*x+y*y+z*z<1e-23)bad++;}
 const open=[...edges.values()].filter(n=>n!==2).length;assert(!bad,'degenerate '+bad);assert(!open,'non-two-use edges '+open);return {triangles:ix.length/3,vertices:vc,nonTwoUse:open,degenerate:bad};}
const report={version:'R6',matrix:[],checks:[],husks:[],hardStoneComparison:[],failures:[],scope:'finite mesh checks; not a proof of complete self-intersection or all seed behavior',humanVisualApproved:false};
try{
 for(const f of Object.keys(seeds))for(const shape of ['long','sample','half','thin'])for(const seed of[seeds[f],seeds[f]+1067]){console.log(f,shape,seed);let c=conf(f,seed,shape),m=K.build(c),r=checkMesh(m);report.matrix.push({family:f,shape,seed,...r,ms:m.stats.buildMs});assert(m.stats.normalFieldEvaluations===0,'field normal repeat');if(f==='adobe')assert(new Set(m.stats.huskAudit.map(h=>h.face)).size===6,'husks missing face');}
 for(const f of ['fired','adobe','pebble']){const c=conf(f),a=K.build(c),b=K.build(c);assert(hash(a)===hash(b),'determinism');report.checks.push({test:'repeated '+f,passed:true});}
 for(const f of ['fired','kiln','adobe','dressed','rubble','stone','pebble']){const c=conf(f),a=K.build(c),b=K.build({...c,color:1.5,rough:.4,wet:.8,tone:.9,char:.8,red:.8});assert(hash(a)===hash(b),'surface changed mesh');report.checks.push({test:'surface geometry isolation '+f,passed:true});}
 for(const density of[0,.38,1]){const c=conf('adobe'),m=K.build({...c,huskDensity:density});checkMesh(m);assert(density?m.stats.riceHusks>0:m.stats.riceHusks===0,'husk density no effect');report.husks.push({density,count:m.stats.riceHusks});}
 for(const rock of[1,2,3,4,5,6,7]){const m=K.build({...conf('rubble'),rock,debug:true});checkMesh(m);report.hardStoneComparison.push({rock,profile:m.stats.mechanicalProfile,events:m.stats.eventCount,maxCutDepth:Math.max(...m.debug.events.map(e=>e.r[2]))});}
 assert(report.hardStoneComparison[0].maxCutDepth<report.hardStoneComparison[1].maxCutDepth,'hard profile excessive depth');
 const m=K.build(conf('adobe'));
 const anchors=m.stats.fiberAudit.flatMap(x=>x.anchorSamples.map(point=>({id:x.id,face:x.face,point}))).concat(m.stats.huskAudit.map(x=>({id:x.id,face:x.face,point:x.anchor})));
 fs.writeFileSync(path.join(out,'adobe-mesh.json'),JSON.stringify({position:[...m.position.slice(0,m.stats.bodyVertices*3)],index:[...m.index.slice(0,m.stats.bodyIndexCount)],anchors,husks:m.stats.huskAudit,stats:{fibers:m.stats.fibers,spacing:m.stats.spacing}}));
 for(const h of m.stats.huskAudit){assert(h.length<=.07201&&h.width<h.length*.5&&h.innerOuterAndRim,'husk size/structure');}
 report.checks.push({test:'small closed-wall open-cup geometry, six faces',passed:true,huskCount:m.stats.riceHusks,maxLength:Math.max(...m.stats.huskAudit.map(x=>x.length))});
 report.passed=true;
}catch(e){report.passed=false;report.failures.push(String(e));throw e;}finally{fs.writeFileSync(path.join(out,'geometry-report.json'),JSON.stringify(report,null,2));}
