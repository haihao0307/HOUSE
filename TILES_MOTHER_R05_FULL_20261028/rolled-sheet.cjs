'use strict';
// Shared flat sheet, rolled into a circular or half-circular wall. The material
// reference is a fixed periodic embedding, so a closed tube has a true seam.
const Sheet=require('./route-a.cjs');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function create({library,outer,inner,length,angle=Math.PI*2,seed=31,strength=1,scale=1,geometryGain=.35,materialReference=null}){
 if(!library||![outer,inner,length,angle,scale].every(v=>Number.isFinite(v)&&v>0)||inner>=outer||angle>2*Math.PI+1e-9||!Number.isFinite(strength)||strength<0||!Number.isFinite(geometryGain)||geometryGain<0)throw Error('Invalid rolled sheet');
 const width=outer*angle,wall=outer-inner,flat=Sheet.instantiate(library,'flat',{sheet:{length,width,thickness:wall},press:{amount:0},wave:{seed,strength,scale}}),M=flat.definition().material;
 const ref=materialReference?{...materialReference}:{version:'tiles.rolled-ref/1',outer,inner,length,angle};
 if(ref.version!=='tiles.rolled-ref/1'||![ref.outer,ref.inner,ref.length,ref.angle].every(v=>Number.isFinite(v)&&v>0)||ref.inner>=ref.outer)throw Error('Invalid rolled material reference');
 function reference(u,t,q){
  if(![u,t,q].every(Number.isFinite)||u<-1||u>1||t<0||t>1||q<0||q>1)throw Error('Outside rolled sheet');
  const a=(u+1)*ref.angle/2,r=ref.outer-q*(ref.outer-ref.inner);return[r*Math.cos(a),r*Math.sin(a),(t-.5)*ref.length];
 }
 function displacement(ref,q){let b=Sheet.field(ref,seed,6*scale,.0012).value,m=Sheet.field(ref,seed,26*scale,.0012).value,p=Sheet.field(ref,seed,80*scale,.0012).value,po=smooth(.56,.67,p),amp=1-.48*q;return strength*geometryGain*amp*(.00135*clamp(b,-1,1)+.00045*clamp(m,-1,1)-.00075*po)}
 function position(u,t,q=0){let refPoint=reference(u,t,q),a=(u+1)*angle/2,r=outer-q*wall+displacement(refPoint,q);return[r*Math.cos(a),r*Math.sin(a),(t-.5)*length]}
 function evaluate(u,t,q=0,footprint=.0012){let ref=reference(u,t,q),w=Sheet.fieldRule(...ref,Sheet.identity(seed),24*scale,footprint,.30,.85),mat=Sheet.materialRule(w.value,w.fine,...w.gradient,M,strength,Sheet.skinRule(q));return{position:position(u,t,q),materialPoint:ref,materialAddress:[u,t,q],...mat,displacementHeight:displacement(ref,q)}}
 return Object.freeze({position,evaluate,materialPoint:reference,sheetPoint:flat.sheetPoint,definition:()=>({rule:'tiles.rolled-sheet/1',mother:'kaopu.sheet/3',unit:'m',outer_m:outer,inner_m:inner,length_m:length,angle_rad:angle,geometryGain,source:'09H source-profile interpretation',materialReference:{...ref},error_m:null})});
}
module.exports={create,version:'tiles.rolled-sheet/1'};
