'use strict';
const Sheet=require('./route-a.cjs');
const clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
function create({library,outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth,seed=31,strength=1,scale=1,materialReference=null}){
 if(!library||![outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth,scale].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(strength)||strength<0)throw Error('Invalid folded sheet');
 const flat=Sheet.instantiate(library,'flat',{sheet:{width:2*outerHalf,length:outerRise+innerDrop,thickness:depth},press:{amount:0},wave:{seed,strength,scale}}),M=flat.definition().material;
 const ref=materialReference?{...materialReference}:{version:'tiles.folded-ref/1',outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth};if(ref.version!=='tiles.folded-ref/1'||![ref.outerHalf,ref.innerHalf,ref.outerRise,ref.innerRise,ref.innerDrop,ref.depth].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid folded material reference');
 function materialPoint(u,v,q){if(![u,v,q].every(Number.isFinite)||u<-1||u>1||v<0||v>1||q<0||q>1)throw Error('Outside folded sheet');const side=1-Math.abs(u),x=u*(ref.outerHalf*(1-v)+ref.innerHalf*v),y=(ref.outerRise*side)*(1-v)+(-ref.innerDrop+ref.innerRise*side)*v;return[x,y,ref.depth*(.5-q)]}
 function height(p){let a=Sheet.field(p,seed,6*scale,.0012).value,b=Sheet.field(p,seed,26*scale,.0012).value;return strength*(.0008*clamp(a)+.0003*clamp(b))}
 function position(u,v,q=0){let refPoint=materialPoint(u,v,q),h=height(refPoint),side=1-Math.abs(u),x=u*(outerHalf*(1-v)+innerHalf*v),y=(outerRise*side)*(1-v)+(-innerDrop+innerRise*side)*v;return[x,y+h*.2*(1-2*v),depth*(.5-q)+h*(1-2*q)]}
 function evaluate(u,v,q=0,footprint=.0012){let p=materialPoint(u,v,q),w=Sheet.fieldRule(...p,Sheet.identity(seed),24*scale,footprint,.30,.85),m=Sheet.materialRule(w.value,w.fine,...w.gradient,M,strength,Sheet.skinRule(q));return{position:position(u,v,q),materialPoint:p,materialAddress:[u,v,q],...m,displacementHeight:height(p)}}
 return Object.freeze({position,materialPoint,evaluate,sheetPoint:flat.sheetPoint,definition:()=>({rule:'tiles.folded-sheet/1',mother:'kaopu.sheet/3',variables:{outerHalf,innerHalf,outerRise,innerRise,innerDrop,depth},materialReference:{...ref},unit:'m',source:'D5 diagram interpretation',error_m:null})});
}
module.exports={create,version:'tiles.folded-sheet/1'};
