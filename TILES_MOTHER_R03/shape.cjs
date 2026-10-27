'use strict';
// R02 zero-detail circle specialization with analytic normal; metres, no display data.
function create(size,bend){
 if(!Array.isArray(size)||size.length!==3||!size.every(x=>Number.isFinite(x)&&x>=0.0001&&x<=10)||!Number.isFinite(bend)||Math.abs(bend)>1)throw Error('Size must be 0.1–10000 mm; bend must be in [-1,1]');
 if(Math.max(...size)/Math.min(...size)>1000)throw Error('Supported aspect ratio is <= 1000');
 const [L,W,T]=size,h=.45*W*bend,k=2*h/(W*W/4+h*h);
 if(Math.abs(k)*T>=.8)throw Error('Bend too strong for thickness: |curvature| × thickness must be < 0.8');
 const contains=(u,t,q=0)=>[u,t,q].every(Number.isFinite)&&Math.abs(u)<=1&&t>=0&&t<=1&&q>=0&&q<=1;
 const position=(u,t,q=0)=>{if(!contains(u,t,q))throw Error('Outside material domain');const x=u*W/2,c=Math.sqrt(Math.max(0,1-k*k*x*x));return[x*(1+q*T*k),T/2+k*x*x/(1+c)-q*T*c,(t-.5)*L]};
 const materialPoint=(u,t,q=0)=>{if(!contains(u,t,q))throw Error('Outside material domain');return[u*W/2,(.5-q)*T,(t-.5)*L]};
 return Object.freeze({position,materialPoint,contains,curvature:k});
}
module.exports=Object.freeze({create});
