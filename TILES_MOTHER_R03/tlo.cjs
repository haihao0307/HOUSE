'use strict';
// TLO adapter over the existing R02 continuous sheet. No display dependency.
const sheet=require('./shape.cjs');
const VERSION='kaopu.brick-tiles-tlo/1';
const clone=x=>JSON.parse(JSON.stringify(x));
const FRAME=Object.freeze({unit:'m',origin:Object.freeze([0,0,0]),axes:'x transverse, y up, z longitudinal',anchor:'material centre (u=0,t=0.5,q=0.5)'});
function create(record){
 const r=clone(record),o=r.Object;
 const keys=(x,allowed)=>x&&Object.keys(x).every(k=>allowed.includes(k));
 if(!keys(r,['Time','Location','Object'])||!keys(r.Location,['site'])||!keys(o,['id','mother','size','bend']))throw Error('Only TLO rule parameters are allowed');
 if(typeof r.Time!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.Time)||new Date(r.Time+'T00:00:00Z').toISOString().slice(0,10)!==r.Time)throw Error('Time must be a creation date');
 if(!r.Location||typeof r.Location.site!=='string'||!r.Location.site.trim())throw Error('Location requires a site label');
 if(!o||o.mother!==VERSION||typeof o.id!=='string'||!o.id)throw Error('Invalid Object identity');
 if(!Array.isArray(o.size)||o.size.length!==3||!o.size.every(v=>Number.isFinite(v)&&v>0))throw Error('size=[length,width,thickness] in metres');
 if(!Number.isFinite(o.bend)||Math.abs(o.bend)>1)throw Error('bend must be in [-1,1]');
 const e=sheet.create(o.size,o.bend),position=e.position,materialPoint=e.materialPoint;
 const evaluate=(u,t,q=0)=>({position:position(u,t,q),materialAddress:[u,t,q],materialPoint:materialPoint(u,t,q),color:[.30,.30,.30],roughness:.88,metallic:0,waveAmplitude:0});
 return Object.freeze({position,shape:position,materialPoint,evaluate,contains:e.contains,definition:()=>clone(r),frame:FRAME});
}
module.exports=Object.freeze({create,version:VERSION,frame:FRAME});
