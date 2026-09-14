'use strict';
// Re-run after diagnostic-confirmed pan-top mating strip guard.
const fs=require('fs'),path=require('path');
const H=__dirname;
const base=fs.readFileSync(path.join(H,'qa_geometry.cjs'),'utf8');
const cut=base.indexOf('const report=');
if(cut<0) throw new Error('qa_geometry diagnostic insertion marker not found');
const prefix=base.slice(0,cut);
const program=prefix+String.raw`
function trianglesMeta(mesh,m){
  const world=[];
  for(let i=0;i<mesh.p.length;i+=3) world.push(A.M.transform(m,[...mesh.p.slice(i,i+3)]));
  const out=[];
  for(let j=0;j<mesh.idx.length;j+=3){
    const ids=[...mesh.idx.slice(j,j+3)],v=ids.map(i=>world[i]),a=v[0],b=v[1],c=v[2];
    const d=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
    if(Math.abs(d)<1e-13)continue;
    const fy=((b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]))/d;
    const fz=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/d;
    out.push({
      ids,
      v:v.map(p=>[p[0],p[2]]),sgn:Math.sign(d),
      xmin:Math.min(...v.map(p=>p[0])),xmax:Math.max(...v.map(p=>p[0])),
      zmin:Math.min(...v.map(p=>p[2])),zmax:Math.max(...v.map(p=>p[2])),
      y:(x,z)=>a[1]+fy*(x-a[0])+fz*(z-a[2]),
      meta:ids.map(i=>Array.from(mesh.meta.slice(i*4,i*4+4))),
      local:ids.map(i=>Array.from(mesh.p.slice(i*3,i*3+3)))
    });
  }
  return out;
}
function intersectMeta(a,b){
  let poly=a.v;
  for(let j=0;j<3;j++){
    const p=b.v[j],q=b.v[(j+1)%3],sign=b.sgn;
    const dist=v=>sign*((q[0]-p[0])*(v[1]-p[1])-(q[1]-p[1])*(v[0]-p[0]));
    const out=[];
    for(let k=0;k<poly.length;k++){
      const v=poly[k],w=poly[(k+1)%poly.length],d=dist(v),e=dist(w),inside=d>=-1e-12,next=e>=-1e-12;
      if(inside)out.push(v);
      if(inside!==next){const t=d/(d-e);out.push([v[0]+t*(w[0]-v[0]),v[1]+t*(w[1]-v[1])]);}
    }
    poly=out;if(poly.length<3)return[];
  }
  return poly;
}
function diagnosticGap(lower,lm,upper,um){
  const L=trianglesMeta(lower,lm),U=trianglesMeta(upper,um);let min=Infinity,best=null,count=0;
  for(const a of L)for(const b of U){
    if(a.xmin>b.xmax||a.xmax<b.xmin||a.zmin>b.zmax||a.zmax<b.zmin)continue;
    const poly=intersectMeta(a,b);if(poly.length<3)continue;count++;
    for(const [x,z] of poly){
      const d=b.y(x,z)-a.y(x,z);
      if(d<min){min=d;best={where:[x,z],lower:a,upper:b};}
    }
  }
  const summarize=t=>({ids:t.ids,meta:t.meta,local:t.local,qRange:[Math.min(...t.meta.map(m=>m[2])),Math.max(...t.meta.map(m=>m[2]))],uRange:[Math.min(...t.meta.map(m=>m[3])),Math.max(...t.meta.map(m=>m[3]))],tagRange:[Math.min(...t.meta.map(m=>m[1])),Math.max(...t.meta.map(m=>m[1]))]});
  return {trianglePairs:count,minGapMm:Number.isFinite(min)?min*1000:null,where:best&&best.where,lower:best&&summarize(best.lower),upper:best&&summarize(best.upper)};
}
function hashDiag(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967295;}
const sidDiag=n=>3+hashDiag(n)*97;
const cases=[];
for(const seed of [314159,161803])for(const strength of [3,3.3]){
  const pan=mesh('pan',sidDiag(seed),strength,.5),cover=mesh('cover',sidDiag(seed+389),strength,.5);
  const r=diagnosticGap(pan,A.tileModel('pan',-S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase));
  cases.push({seed,strength,...r});
}
const out={version:'08F.1-contact-surface-diagnostic',cases};
fs.writeFileSync(H+'/CONTACT_SURFACE_DIAGNOSTIC.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
`;
eval(program);
