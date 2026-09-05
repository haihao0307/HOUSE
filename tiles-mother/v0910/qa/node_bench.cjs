'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.resolve(root,'../v099');
const THREE=require(path.resolve(root,'../v098/source/vendor/three_runtime.cjs'));
const old=fs.readFileSync(path.join(base,'source/app.js'),'utf8');
const expected='7df6dff44075f6888d58f25d407da80a3b8514c7';
const blob=crypto.createHash('sha1').update('blob '+Buffer.byteLength(old)+'\0').update(old).digest('hex');assert.equal(blob,expected);
function getCode(s){return s.slice(s.indexOf('const clamp'),s.indexOf('const threeText'))+s.slice(s.indexOf('const PROFILE'),s.indexOf('const state='))+s.slice(s.indexOf('function circleArcY'),s.indexOf('function makeDetail'))+s.slice(s.indexOf('const POPULATION'),s.indexOf('function makeUVTexture'))+s.slice(s.indexOf('function uvGateV098'),s.indexOf('function clearStage'))+s.slice(s.indexOf('function lifecycle'),s.indexOf('let lastRoof='))+s.slice(s.indexOf('function timberNodes'),s.indexOf('function applyTimberOnly'))}
function harness(s){
 const state={geometryRevision:1,edgeStrength:1,seed:314159,year:0,care:'maintained',mode:'material',surfaceRevision:1,colorLayer:1,striations:.7};
 const stageRoot=new THREE.Group();const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',className:''});return nodes.get(id);};
 const code=`let lastRoof=null;const placementCache=new Map();const UV_MATERIALS={pan:[],cover:[]};
 function clearStage(){stageRoot.clear();}function fitCamera(){}function applyTimberOnly(){};
 function studyClayMaterial(){return new THREE.MeshStandardMaterial();}function getWoodMaterials(){return new THREE.MeshStandardMaterial();}
 function packFit(f){if(!f)return null;return {matrix:f.proxy.matrix.elements.slice(),tilt:f.tilt,roll:f.roll,leftGap:f.leftGap,rightGap:f.rightGap,overlapGap:f.overlapGap,contacts:f.contacts,unsupported:f.unsupported,iterations:f.iterations};}
 function unpackFit(f,g){if(!f)return null;return {...f,proxy:makeProxy(g,new THREE.Matrix4().fromArray(f.matrix))};}
 `+getCode(s)+`;return {state,buildRoofLike,getRoof:()=>lastRoof,exactGap,makeProxy,makeTileGeometry,packFit,woodGeometry,placementCache,stageRoot};`;
 return new Function('THREE','state','$','stageRoot',code)(THREE,state,$,stageRoot);
}
const patch=fs.readFileSync(path.join(root,'source/contact_fast.js'),'utf8');
const fast=old.slice(0,old.indexOf('function exactGap('))+patch+'\n'+old.slice(old.indexOf('function minSupportGap('));
const before=harness(old),after=harness(fast);
function snapshot(A){const R=A.getRoof(),hash=crypto.createHash('sha256');for(const fits of [R.panFits,R.coverFits])for(const f of fits)hash.update(JSON.stringify(A.packFit(f)));for(const m of [...R.timber.beams,...R.timber.rafters]){hash.update(Buffer.from(m.mesh.geometry.attributes.position.array.buffer));hash.update(Buffer.from(m.mesh.geometry.attributes.normal.array.buffer));}return {hash:hash.digest('hex'),counts:R.counts,contacts:R.contactReport};}
const runs=[];
for(const cfg of [{scene:'forty8',year:0},{scene:'roof',year:0},{scene:'roof',year:100,care:'abandoned'}]){
 const snapshots={};
 for(const [name,A] of [['before',before],['after',after]]){Object.assign(A.state,{care:'maintained'},cfg);const t=performance.now();A.buildRoofLike(cfg.scene);const ms=performance.now()-t;const sn=snapshot(A);snapshots[name]=sn;runs.push({name,...cfg,ms,hash:sn.hash,counts:sn.counts});console.log(name,JSON.stringify(cfg),Math.round(ms),sn.hash,sn.counts);}
 assert.deepEqual(snapshots.before,snapshots.after,'Geometry and contact output must be exact.');
}
const rand=(n)=>Math.sin(n*31.27)*.5+.5;let pairs=0;
for(let i=0;i<160;i++){
 const kind=i%2?'pan':'cover',g=before.makeTileGeometry(kind,{seed:i+17,nu:10,nv:14,damageClass:i%3}),h=before.makeTileGeometry(i%3?'pan':'cover',{seed:i+331,nu:10,nv:14,damageClass:(i+1)%3});
 const a=before.makeProxy(g,new THREE.Matrix4().compose(new THREE.Vector3((rand(i)-.5)*.2,rand(i+1)*.03,(rand(i+2)-.5)*.25),new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(i+3)*.3,0,(rand(i+4)-.5)*.2)),new THREE.Vector3(1,1,1))),b=before.makeProxy(h);
 assert.deepEqual(after.exactGap(a,b),before.exactGap(a,b));pairs++;
}
const report={runtime:process.version,method:'Node numerical assembly; material construction stubbed; not browser/GPU benchmark',baselineSHA256:crypto.createHash('sha256').update(old).digest('hex'),runs,exactSceneComparisons:3,exactPairComparisons:pairs,allPassed:true};
fs.writeFileSync(path.join(root,'qa/NODE_BENCH.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS',pairs);
