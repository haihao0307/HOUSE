'use strict';
const Sheet=require('./route-a.cjs');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const curves={
 d5:x=>.28*Math.pow(Math.max(0,(x+.40)/1.0),3),
 snail:x=>.38*Math.pow(Math.max(0,1-(x/.52)**2),.65),
 wave:x=>.045+.065*(1+Math.cos((x+.04)*Math.PI*2/.21)),
 tail:x=>.18*Math.pow(Math.max(0,(-x+.2)/.8),2)
};
function create({library,curve,x0,x1,y,thick,depth,seed=31,strength=1,scale=1,materialReference=null}){
 if(!library||!curves[curve]||![x0,x1,y,thick,depth,strength,scale].every(Number.isFinite)||x1<=x0||thick<=0||depth<=0||strength<0||scale<=0)throw Error('Invalid curved sheet band');
 const flat=Sheet.instantiate(library,'flat',{sheet:{length:thick,width:x1-x0,thickness:depth},press:{amount:0},wave:{seed,strength,scale}}),M=flat.definition().material;
 const ref=materialReference?{...materialReference}:{version:'tiles.band-ref/1',curve,x0,x1,y,thick,depth};if(ref.version!=='tiles.band-ref/1'||!curves[ref.curve]||![ref.x0,ref.x1,ref.y,ref.thick,ref.depth].every(Number.isFinite)||ref.x1<=ref.x0||ref.thick<=0||ref.depth<=0)throw Error('Invalid band material reference');
 function materialPoint(u,v,q){if(![u,v,q].every(Number.isFinite)||u<0||u>1||v<0||v>1||q<0||q>1)throw Error('Outside band');let x=ref.x0+(ref.x1-ref.x0)*u;return[x,ref.y+curves[ref.curve](x)+(v-1)*ref.thick,ref.depth*(.5-q)]}
 function height(p){let a=Sheet.field(p,seed,6*scale,.0012).value,b=Sheet.field(p,seed,26*scale,.0012).value;return strength*(.0008*clamp(a,-1,1)+.0003*clamp(b,-1,1))}
 function position(u,v,q=0){let refPoint=materialPoint(u,v,q),h=height(refPoint),x=x0+(x1-x0)*u;return[x,y+curves[curve](x)+(v-1)*thick+h*.2*(2*v-1),depth*(.5-q)+h*(1-2*q)]}
 function evaluate(u,v,q=0,footprint=.0012){let p=materialPoint(u,v,q),w=Sheet.fieldRule(...p,Sheet.identity(seed),24*scale,footprint,.30,.85),mat=Sheet.materialRule(w.value,w.fine,...w.gradient,M,strength,Sheet.skinRule(q));return{position:position(u,v,q),materialPoint:p,materialAddress:[u,v,q],...mat,displacementHeight:height(p)}}
 return Object.freeze({position,materialPoint,evaluate,definition:()=>({rule:'tiles.curved-band/1',mother:'kaopu.sheet/3',curve,variables:{x0,x1,y,thick,depth},materialReference:{...ref},unit:'m',source:'09H source curve interpretation',error_m:null})});
}
module.exports={create,curves,version:'tiles.curved-band/1'};
