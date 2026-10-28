'use strict';
const Sheet=require('./route-a.cjs');
function create({library,width,length,thickness,seed=31,strength=1,scale=1,geometryGain=.25,materialReference=null}){
 if(!library||![width,length,thickness,scale].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(strength)||strength<0||!Number.isFinite(geometryGain)||geometryGain<0)throw Error('Invalid flat sheet');
 const dims={width,length,thickness},input=Sheet.instantiate(library,'flat',{sheet:dims,press:{amount:0,edgeGain:0},wave:{seed,strength,scale}}).definition();
 input.materialReference.sheet={...input.materialReference.sheet,...dims};input.materialReference.press={...input.materialReference.press,amount:0,formGain:0,edgeGain:0,endWidth:width,endThickness:thickness,rise:[0,0],lift:[0,0],shoulder:null};
 if(materialReference)input.materialReference=JSON.parse(JSON.stringify(materialReference));
 const e=Sheet.create(input);
 function position(u,t,q=0){let base=e.shape(u,t,q),full=e.position(u,t,q),p=base.map((v,i)=>v+(full[i]-v)*geometryGain);p[1]+=thickness;return p}
 function evaluate(u,t,q=0,footprint=.0012){let v=e.evaluate(u,t,q,footprint),base=e.shape(u,t,q);v.position=base.map((x,i)=>x+(v.position[i]-x)*geometryGain);v.position[1]+=thickness;return v}
 return Object.freeze({position,evaluate,materialPoint:e.materialPoint,definition:()=>({rule:'tiles.flat-sheet/1',mother:'kaopu.sheet/3',unit:'m',variables:{...dims,geometryGain},materialReference:e.definition().materialReference,source:'09H source-profile interpretation',error_m:null})});
}
module.exports={create,version:'tiles.flat-sheet/1'};
