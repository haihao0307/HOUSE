'use strict';
// An elliptically bounded piece is a trimmed common sheet. The display adapter
// can sample it as a filled disk, but the object is this continuous definition.
const Sheet=require('./route-a.cjs');
function create({library,rx,ry,depth,waveStrength=1,waveScale=1,seed=31,materialReference=null}){
 if(!library||![rx,ry,depth,waveScale].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(waveStrength)||waveStrength<0)throw Error('Invalid profile tile');
 const dimensions={length:2*ry,width:2*rx,thickness:depth};
 const initial=Sheet.instantiate(library,'flat',{sheet:dimensions,press:{amount:0,edgeGain:0},wave:{seed,strength:waveStrength,scale:waveScale}}).definition();
 initial.materialReference.sheet={...initial.materialReference.sheet,...dimensions};
 initial.materialReference.press={...initial.materialReference.press,amount:0,formGain:0,edgeGain:0,endWidth:2*rx,endThickness:depth,rise:[0,0],lift:[0,0],shoulder:null};
 if(materialReference)initial.materialReference=JSON.parse(JSON.stringify(materialReference));
 const e=Sheet.create(initial);
 function contains(u,t){return Number.isFinite(u)&&Number.isFinite(t)&&u*u+(2*t-1)**2<=1+1e-10}
 function position(u,t,q=0){if(!contains(u,t)||q<0||q>1)throw Error('Outside elliptic sheet');let p=e.position(u,t,q);return [p[0],p[2],p[1]+depth/2]}
 function evaluate(u,t,q=0,footprint=.0012){if(!contains(u,t))throw Error('Outside elliptic sheet');let v=e.evaluate(u,t,q,footprint),p=v.position;return {...v,position:[p[0],p[2],p[1]+depth/2]}}
 return Object.freeze({contains,position,evaluate,materialPoint:e.materialPoint,definition:()=>({rule:'tiles.elliptic-sheet/1',mother:'kaopu.sheet/3',unit:'m',rx_m:rx,ry_m:ry,depth_m:depth,boundary:'(x/rx)^2+(y/ry)^2<=1',source:'09H displayed profile; physical construction unverified',object:e.definition(),error_m:null})});
}
module.exports={create,version:'tiles.elliptic-sheet/1'};
