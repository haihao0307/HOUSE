'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{createIntersector}=require('./ray.cjs');
let count=0,maxHit=0,maxChart=0;
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
for(const size of[[.24,.21,.014],[.004,.003,.0001],[10,8,.4]])for(const bend of[0,1e-10,-1e-10,.45,-.9])for(const edges of[[1,1],[.94,.88],[.2,.8]]){
 const[L,W,T]=size,h=.45*W*bend,k=2*h/(W*W/4+h*h),ray=createIntersector(size,bend,edges),point=(u,t,q)=>{const x=u*W/2,c=Math.sqrt(1-k*k*x*x);return[x*(1+q*T*k),T/2+k*x*x/(1+c)-q*T*c,(t-.5)*L]};
 for(let j=0;j<160;j++){const u=-edges[0]+(edges[0]+edges[1])*(j+.5)/160,t=.03+.94*((j*.61803398875)%1),q=.03+.94*((j*.41421356237)%1),p=point(u,t,q),a=ray.materialAddress(p);assert(ray.domain(p));maxChart=Math.max(maxChart,dist([a.u,a.t,a.q],[u,t,q]));assert(dist([a.u,a.t,a.q],[u,t,q])<1e-10);const faces=[[point(u,t,0),[-k*(u*W/2),Math.sqrt(1-k*k*(u*W/2)**2),0]],[point(u,t,1),[k*(u*W/2),-Math.sqrt(1-k*k*(u*W/2)**2),0]],[point(u,0,q),[0,0,-1]],[point(u,1,q),[0,0,1]]];for(const s of[-1,1]){const e=edges[s<0?0:1],x=e*W/2;faces.push([point(s*e,t,q),[s*Math.sqrt(1-k*k*x*x),k*x,0]])}for(const[p,n]of faces){const offset=Math.min(...size)*.02,ro=p.map((v,i)=>v+n[i]*offset),rd=n.map(v=>-v),hit=ray.hit(ro,rd);assert(Number.isFinite(hit.t));maxHit=Math.max(maxHit,Math.abs(hit.t-offset));assert(Math.abs(hit.t-offset)<1e-8,JSON.stringify({size,bend,edges,j,p,n,hit,offset}));count++}}
}
const report={pass:true,checks:count,independentBoundaryHitMaxErrorM:maxHit,materialAddressMaxError:maxChart,scope:'Actual edge-trimmed analytic ray and inverse material chart versus independent parametric boundaries. No browser/GPU claim.'};fs.writeFileSync(path.join(__dirname,'RAY_TEST.json'),JSON.stringify(report,null,2));console.log(report);
