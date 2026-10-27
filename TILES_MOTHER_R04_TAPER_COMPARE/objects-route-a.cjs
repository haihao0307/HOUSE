'use strict';
// Persistent identity, discrete time states, membership and coordinate frames.
const crypto=require('node:crypto'),mother=require('./route-a.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const vec=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
const rotate=(p,q)=>{const [x,y,z,w]=q,[a,b,c]=p,tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx]};
function open(input,libraryBytes,coreBytes){
 const doc=clone(input),library=JSON.parse(libraryBytes.toString());
 if(doc.schema!=='mother.objects/1'||doc.unit!=='m'||doc.clock?.unit!=='s'||doc.clock?.mode!=='discrete')throw Error('Unsupported schema/unit/clock');
 if(doc.rules.function!==mother.version||doc.rules.coreSha256!==digest(coreBytes)||digest(coreBytes)!==digest(require('node:fs').readFileSync(__dirname+'/route-a.cjs'))||doc.rules.librarySha256!==digest(libraryBytes)||doc.rules.objectSystemSha256!==digest(require('node:fs').readFileSync(__filename)))throw Error('Rule content mismatch');
 const objects=new Map(),snapshots=new Map();
 for(const o of doc.objects){if(!o.id||objects.has(o.id)||!o.kind||!o.role||!doc.evidence?.[o.evidence])throw Error('Invalid/duplicate identity/evidence');objects.set(o.id,o)}
 const cycle=(nodes,key)=>{for(const id of objects.keys()){let p=id,seen=new Set();while(p!==null){if(seen.has(p))throw Error('Cycle '+key);seen.add(p);const n=nodes.get(p);if(!n)throw Error('Missing '+key+' target');p=n[key]}}};
 for(const s of doc.snapshots){
  if(!Number.isFinite(s.time)||snapshots.has(s.time))throw Error('Invalid/duplicate time');
  const nodes=new Map();
  for(const n of s.nodes){
   if(!objects.has(n.id)||nodes.has(n.id)||!vec(n.position,3)||!vec(n.rotation,4)||Math.abs(Math.hypot(...n.rotation)-1)>1e-9||!('owner' in n)||!('frame' in n))throw Error('Invalid state/frame');
   if(objects.get(n.id).kind==='tile'){if(!n.recipe)throw Error('Missing recipe');mother.instantiate(library,n.recipe,n.variables)}
   nodes.set(n.id,n);
  }
  if(nodes.size!==objects.size)throw Error('Incomplete snapshot');cycle(nodes,'owner');cycle(nodes,'frame');
  for(const c of s.connections){
   if(!c.id||!c.kind||!['declared','verified','unknown'].includes(c.status)||!doc.evidence?.[c.evidence]||!Array.isArray(c.ends)||c.ends.length!==2)throw Error('Invalid connection');
   for(const e of c.ends)if(!nodes.has(e.object)||!vec(e.point,3)||typeof e.region!=='string')throw Error('Invalid connection endpoint');
  }
  snapshots.set(s.time,{...s,nodes});
 }
 function state(id,time){const s=snapshots.get(time);if(!s)throw Error('Unrecorded time; interpolation is not defined');const n=s.nodes.get(id);if(!n)throw Error('Unknown object');return {s,n}}
 function world(id,time,point){const {s}=state(id,time);let p=[...point],at=id;while(at!==null){const n=s.nodes.get(at);p=rotate(p,n.rotation).map((v,i)=>v+n.position[i]);at=n.frame}return p}
 function ancestry(id,time){const {s}=state(id,time);let at=s.nodes.get(id).owner,out=[];while(at!==null){out.push(at);at=s.nodes.get(at).owner}return out}
 function evaluate(id,time,u,t,q=0,footprint=0){
  const {n}=state(id,time),object=objects.get(id);if(object.kind!=='tile')throw Error('Object has no sheet rule');
  const tile=mother.instantiate(library,n.recipe,n.variables),v=tile.evaluate(u,t,q,footprint),th=tile.definition().sheet.thickness;
  // R02/R03 surface origin -> base cuboid centre. Not a deformed mass centroid.
  const centered=p=>[p[0],p[1]+th/2,p[2]],local=centered(v.position);
  return {...v,id,time,role:object.role,owners:ancestry(id,time),localPosition:local,worldPosition:world(id,time,local),basePoint:centered(tile.sheetPoint(u,t,q))};
 }
 return Object.freeze({evaluate,world,ancestry,state:(id,time)=>clone(state(id,time).n),definition:()=>clone(doc)});
}
module.exports={open,digest,version:'mother.objects/1'};
