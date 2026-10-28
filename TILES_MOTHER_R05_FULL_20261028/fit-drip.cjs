'use strict';
// A fitted drip is defined by a continuous carrier, a source outline and a
// continuous section-mapping rule. Any tessellation below is display-only.
const End=require('./end-face.cjs');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
function sourceSection(poly,x){
 const hits=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];
  if(Math.abs(a[0]-x)<1e-9)hits.push(a[1]);
  if(x>=Math.min(a[0],b[0])-1e-10&&x<=Math.max(a[0],b[0])+1e-10&&Math.abs(b[0]-a[0])>1e-12)
   hits.push(mix(a[1],b[1],clamp((x-a[0])/(b[0]-a[0]))));
 }
 if(!hits.length)throw Error('Source outline has no section at '+x);
 return [Math.min(...hits),Math.max(...hits)];
}
function create({id,source,carrier,depth=.012,relief=.0012}){
 if(!source?.outline||!source?.curves||!carrier?.position)throw Error('Fitted drip requires source outline and continuous carrier');
 const front=(u,q)=>{const p=carrier.position(u,0,q);return [-p[0],p[1]]};
 // End bands bracket possible roots; refined answers always query the continuous function.
 const sides=[-1,1].map(u=>Array.from({length:33},(_,i)=>({q:i/32,p:front(u,i/32)})));
 const ends=[front(-1,0),front(1,0),front(-1,1),front(1,1),...sides.flatMap(side=>side.map(p=>p.p))];
 const xmin=Math.min(...ends.map(p=>p[0])),xmax=Math.max(...ends.map(p=>p[0]));
 const omin=Math.min(...source.outline.map(p=>p[0])),omax=Math.max(...source.outline.map(p=>p[0]));
 const xFromSource=x=>mix(xmin,xmax,clamp((x-omin)/(omax-omin)));
 function root(fn,a,b,x,pa,pb){
  pa=pa||fn(a);pb=pb||fn(b);
  if(x<Math.min(pa[0],pb[0])-1e-10||x>Math.max(pa[0],pb[0])+1e-10)return null;
  if(Math.abs(pa[0]-x)<1e-12)return pa;
  if(Math.abs(pb[0]-x)<1e-12)return pb;
  const ascending=pb[0]>pa[0];
  for(let i=0;i<31;i++){const m=(a+b)/2,pm=fn(m);if((pm[0]<x)===ascending)a=m;else b=m;}
  return fn((a+b)/2);
 }
 const memo=new Map();
 function carrierSection(x){
  const key=Math.round(x*1e10);if(memo.has(key))return memo.get(key);
  const hits=[];
  for(const q of [0,1]){const hit=root(u=>front(u,q),-1,1,x);if(hit)hits.push(hit[1]);}
  for(let side=0;side<2;side++){
   const u=side?1:-1,band=sides[side];
   for(let i=0;i<band.length-1;i++){
    if(x<Math.min(band[i].p[0],band[i+1].p[0])-1e-10||x>Math.max(band[i].p[0],band[i+1].p[0])+1e-10)continue;
    const hit=root(q=>front(u,q),band[i].q,band[i+1].q,x,band[i].p,band[i+1].p);if(hit)hits.push(hit[1]);
   }
  }
  if(!hits.length){const near=ends.reduce((a,p)=>Math.abs(p[0]-x)<Math.abs(a[0]-x)?p:a);if(Math.abs(near[0]-x)>1e-7)throw Error('Carrier has no front section at '+x);hits.push(near[1]);}
  const value=[Math.min(...hits),Math.max(...hits)];memo.set(key,value);return value;
 }
 function section(x){
  x=clamp(x,xmin,xmax);const p=carrierSection(x),old=sourceSection(source.outline,mix(omin,omax,(x-xmin)/(xmax-xmin)));
  return [Math.min(p[0]-.0002,p[1]-Math.max(.001,old[1]-old[0])),p[1]+.0002];
 }
 const curves=source.curves.map(c=>({...c,points:c.points.map(p=>{
  const x=xFromSource(p[0]),old=sourceSection(source.outline,p[0]),u=clamp((p[1]-old[0])/Math.max(1e-8,old[1]-old[0])),v=section(x);
  return[x,mix(v[0],v[1],u)];
 })}));
 const trace={...source,curves,width_m:xmax-xmin};
 const face=End.create({id,trace,depth,relief,domain:(x,y)=>{if(x<xmin-1e-10||x>xmax+1e-10)return false;const a=section(x);return y>=a[0]-1e-10&&y<=a[1]+1e-10;}});
 function sampleBoundary(detail=80){
  let xs=[xmin,xmax,...source.outline.map(p=>xFromSource(p[0])),...Array.from({length:321},(_,i)=>mix(xmin,xmax,i/320))];
  for(let i=0;i<=detail;i++)for(const q of [0,1])xs.push(clamp(front(2*i/detail-1,q)[0],xmin,xmax));
  xs=xs.sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-7);
  const top=[],bottom=[];for(const x of xs){let v=section(x);top.push([x,v[1]]);bottom.push([x,v[0]])}
  return {xs,top,bottom,trace:{...trace,outline:[...top,...bottom.slice().reverse()]}};
 }
 return Object.freeze({id,section,carrierSection,xmin,xmax,xFromSource,position:face.position,evaluate:face.evaluate,contains:face.contains,reliefAt:face.reliefAt,sampleBoundary,definition:()=>({id,rule:'tiles.fitted-drip/1',faceRule:'tiles.end-face/1',carrierRule:'kaopu.sheet/3',sourceRef:'tile-source-curves.json#'+id,depth_m:depth,relief_m:relief,frame:'carrier front',error_m:null})});
}
module.exports={create,version:'tiles.fitted-drip/1'};
