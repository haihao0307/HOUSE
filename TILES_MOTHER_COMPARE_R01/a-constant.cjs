'use strict';
// A: flat material sheet -> height deformation -> full normal thickness.
const {prepare}=require('./contract.cjs');
function create(size,bend,edges=[1,1]){
 const {L,W,T,k,contains,check,materialPoint,frame}=prepare(size,bend,edges);
 const flat=(u,t)=>[u*W/2,0,(t-.5)*L];
 const bendPoint=p=>{const c=Math.sqrt(Math.max(0,1-k*k*p[0]*p[0]));return[p[0],k*p[0]*p[0]/(1+c),p[2]]};
 const normal=u=>{check(u,.5,0);const x=u*W/2,c=Math.sqrt(Math.max(0,1-k*k*x*x)),slope=k*x/c,d=1/Math.hypot(slope,1);return[-slope*d,d,0]};
 const position=(u,t,q=0)=>{check(u,t,q);const p=bendPoint(flat(u,t)),n=normal(u);return[p[0]-q*T*n[0],T/2+p[1]-q*T*n[1],p[2]]};
 return Object.freeze({position,normal,materialPoint,contains,frame});
}
module.exports=Object.freeze({create});
