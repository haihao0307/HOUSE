'use strict';
const frame=Object.freeze({origin:Object.freeze([0,0,0]),axes:'x transverse, y up, z path',unit:'m',width:'top chord at bend, material width at flat'});
function prepare(size,bend,edges){
 if(!Array.isArray(size)||size.length!==3||!size.every(x=>Number.isFinite(x)&&x>=.0001&&x<=10)||Math.max(...size)/Math.min(...size)>1000)throw Error('Invalid supported size/aspect');
 if(!Number.isFinite(bend)||Math.abs(bend)>1||!Array.isArray(edges)||edges.length!==2||!edges.every(x=>Number.isFinite(x)&&x>=.1&&x<=1))throw Error('Invalid bend/edge domain');
 const[L,W,T]=size,h=.45*W*bend,k=2*h/(W*W/4+h*h),lo=-edges[0],hi=edges[1];if(Math.abs(k)*T>=.8)throw Error('Invalid curvature thickness');
 const contains=(u,t,q=0)=>[u,t,q].every(Number.isFinite)&&u>=lo&&u<=hi&&t>=0&&t<=1&&q>=0&&q<=1;
 const check=(u,t,q)=>{if(!contains(u,t,q))throw Error('Outside material domain')};
 const materialPoint=(u,t,q=0)=>{check(u,t,q);return[u*W/2,(.5-q)*T,(t-.5)*L]};
 return {L,W,T,k,contains,check,materialPoint,frame};
}
module.exports={prepare};
