'use strict';
// B: line path -> angular circular section -> signed radial thickness.
const {prepare}=require('./contract.cjs');
function create(size,bend,edges=[1,1]){
 const {L,W,T,k,contains,check,materialPoint,frame}=prepare(size,bend,edges);
 const path=t=>[0,0,(t-.5)*L];
 const normal=u=>{check(u,.5,0);const theta=Math.asin(k*u*W/2);return[-Math.sin(theta),Math.cos(theta),0]};
 const section=(u,q)=>{const x=u*W/2,theta=Math.asin(k*x),s=Math.sin(theta),c=Math.cos(theta),h=k===0?0:2*Math.sin(theta/2)**2/k;return[x+q*T*s,T/2+h-q*T*c]};
 const position=(u,t,q=0)=>{check(u,t,q);const p=path(t),s=section(u,q);return[p[0]+s[0],p[1]+s[1],p[2]]};
 return Object.freeze({position,normal,materialPoint,contains,frame});
}
module.exports=Object.freeze({create});
