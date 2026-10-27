'use strict';
const {mix,contains,validate,skin}=require('./variable-contract.cjs');
function create(size,endWidth,rise){
 validate(size,endWidth,rise);const[L,W,T]=size;rise=rise.slice();
 const base=(u,t)=>{const w=mix(W,endWidth,t),h=mix(...rise,t),x=u*W/2*w/W,k=2*h/(w*w/4+h*h);return[x,k*x*x/(1+Math.sqrt(Math.max(0,1-k*k*x*x))),(t-.5)*L]};
 const position=skin(base,T),materialPoint=(u,t,q=0)=>{if(!contains(u,t,q))throw Error('Outside material domain');return[u*W/2,(.5-q)*T,(t-.5)*L]};return Object.freeze({position,materialPoint,contains});
}
module.exports=Object.freeze({create});
