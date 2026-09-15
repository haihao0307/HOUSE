'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const H=__dirname;
const base=fs.readFileSync(path.join(H,'qa_geometry.cjs'),'utf8');
const cut=base.search(/for\(const strength of \[/);
if(cut<0) throw new Error('qa_geometry loop marker missing');
const prefix=base.slice(0,cut);
const program=prefix+String.raw`
function trianglesMeta(mesh,m){
 const points=[];
 for(let i=0;i<mesh.p.length;i+=3) points.push(A.M.transform(m,[...mesh.p.slice(i,i+3)]));
 const out=[];
 for(let j=0;j<mesh.idx.length;j+=3){
  const ids=[...mesh.idx.slice(j,j+3)],v=ids.map(i=>points[i]),a=v[0],b=v[1],c=v[2];
  const d=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(d)<1e-13)continue;
  const fy=((b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]))/d;
  const fz=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/d;
  out.push({ids,v:v.map(p=>[p[0],p[2]]),sgn:Math.sign(d),xmin:Math.min(...v.map(p=>p[0])),xmax:Math.max(...v.map(p=>p[0])),zmin:Math.min(...v.map(p=>p[2])),zmax:Math.max(...v.map(p=>p[2])),y:(x,z)=>a[1]+fy*(x-a[0])+fz*(z-a[2]),meta:ids.map(i=>Array.from(mesh.meta.slice(i*4,i*4+4))),local:ids.map(i=>Array.from(mesh.p.slice(i*3,i*3+3)))});
 }
 return out;
}
function clipMeta(a,b){
 let poly=a.v;
 for(let j=0;j<3;j++){
  const p=b.v[j],q=b.v[(j+1)%3],sign=b.sgn,dist=v=>sign*((q[0]-p[0])*(v[1]-p[1])-(q[1]-p[1])*(v[0]-p[0])),next=[];
  for(let k=0;k<poly.length;k++){
   const v=poly[k],w=poly[(k+1)%poly.length],d=dist(v),e=dist(w),inside=d>=-1e-12,win=e>=-1e-12;
   if(inside)next.push(v);if(inside!==win){const t=d/(d-e);next.push([v[0]+t*(w[0]-v[0]),v[1]+t*(w[1]-v[1])]);}
  }
  poly=next;if(poly.length<3)return[];
 }
 return poly;
}
function gapMeta(name,lower,lm,upper,um){
 const L=trianglesMeta(lower,lm),U=trianglesMeta(upper,um);let min=Infinity,detail=null,count=0;
 for(const a of L)for(const b of U){
  if(a.xmin>b.xmax||a.xmax<b.xmin||a.zmin>b.zmax||a.zmax<b.zmin)continue;
  const poly=clipMeta(a,b);if(poly.length<3)continue;count++;
  for(const [x,z] of poly){const d=b.y(x,z)-a.y(x,z);if(d<min){min=d;detail={where:[x,z],lowerIds:a.ids,upperIds:b.ids,lowerMeta:a.meta,upperMeta:b.meta,lowerLocal:a.local,upperLocal:b.local};}}
 }
 return{name,trianglePairs:count,minGapMm:Number.isFinite(min)?min*1000:null,detail};
}
const seeds=[314159,271828,161803],out=[];
for(const strength of [3,3.6])for(const seed of seeds){
 const pan=mesh('pan',sid(seed),strength,.5),panRight=mesh('pan',sid(seed+1777),strength,.5),cover=mesh('cover',sid(seed+389),strength,.5);
 out.push({seed,strength,left:gapMeta('cover on left pan',pan,A.tileModel('pan',-S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase)),right:gapMeta('cover on right adjacent pan',panRight,A.tileModel('pan',S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase))});
}
fs.writeFileSync(H+'/CONTACT_META_DIAGNOSTIC.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
`;
eval(program);
