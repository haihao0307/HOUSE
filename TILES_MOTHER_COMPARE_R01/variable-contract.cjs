'use strict';
const mix=(a,b,t)=>a+(b-a)*t;
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);if(n<1e-14)throw Error('Singular surface');return a.map(v=>v/n)};
const contains=(u,t,q=0)=>[u,t,q].every(Number.isFinite)&&Math.abs(u)<=1&&t>=0&&t<=1&&q>=0&&q<=1;
function validate(size,endWidth,rise){if(!Array.isArray(size)||size.length!==3||!size.every(v=>Number.isFinite(v)&&v>=.0001&&v<=10)||!Number.isFinite(endWidth)||endWidth<.0001||endWidth>10||!Array.isArray(rise)||rise.length!==2||!rise.every(Number.isFinite))throw Error('Invalid section parameters');if(Math.max(...size,endWidth)/Math.min(...size,endWidth)>1000)throw Error('Aspect ratio > 1000');for(let j=0;j<=128;j++){const w=mix(size[1],endWidth,j/128),h=mix(...rise,j/128),k=2*h/(w*w/4+h*h);if(Math.abs(h)>=w/2*.999999||Math.abs(k)*size[2]>=.8)throw Error('Unsupported section');}}
function skin(base,thickness){return(u,t,q=0)=>{if(!contains(u,t,q))throw Error('Outside material domain');const p=base(u,t),du=sub(base(u+.0001,t),base(u-.0001,t)),dv=sub(base(u,t+.0001),base(u,t-.0001)),n=norm(cross(dv,du));return[p[0]-q*thickness*n[0],p[1]+thickness/2-q*thickness*n[1],p[2]-q*thickness*n[2]]};}
module.exports={mix,contains,validate,skin};
