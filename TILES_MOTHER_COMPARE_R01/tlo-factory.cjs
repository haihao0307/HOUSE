'use strict';
const material=require('./material.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function createRules(shape,letter){
 const mother='tile.compare.'+letter+'/1';
 function create(input){
  const r=clone(input),o=r.Object,keys=(v,a)=>v&&Object.keys(v).every(k=>a.includes(k));
  if(!keys(r,['Time','Location','Object'])||!keys(r.Location,['site'])||!keys(o,['id','mother','shape','material'])||!keys(o.shape,['size','bend','edges'])||!keys(o.material,['frequency','amplitude','seed']))throw Error('Unknown TLO fields');
  if(typeof r.Time!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.Time)||new Date(r.Time+'T00:00:00Z').toISOString().slice(0,10)!==r.Time||typeof r.Location.site!=='string'||!r.Location.site.trim()||typeof o.id!=='string'||!o.id||o.mother!==mother)throw Error('Invalid TLO identity/date/site');
  const s=shape.create(o.shape.size,o.shape.bend,o.shape.edges),m=material.create(o.material.frequency,o.material.amplitude,o.material.seed);
  const evaluate=(u,t,q=0)=>{const p=s.materialPoint(u,t,q);return{position:s.position(u,t,q),materialPoint:p,...m.evaluate(p)}};
  return Object.freeze({...s,evaluate,definition:()=>clone(r)});
 }
 return Object.freeze({create,mother});
}
module.exports={createRules};
