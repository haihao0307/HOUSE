/* V0.9.10: same projected-triangle algorithm and tolerances as V0.9.9.
 * Scratch storage replaces per-pair arrays/Sets. No lower-resolution proxy.
 * The solver is synchronous; no callback or nested invocation shares scratch.
 */
const gapScratch={a:new Float64Array(24),b:new Float64Array(24),marks:new WeakMap()};
function clipTriangleScratch(a,b){
 let src=gapScratch.a,dst=gapScratch.b,n=3;
 src[0]=a.a[0];src[1]=a.a[1];src[2]=a.b[0];src[3]=a.b[1];src[4]=a.c[0];src[5]=a.c[1];
 const sign=Math.sign(b.den);
 for(let e=0;e<3&&n;e++){
  const v=e===0?b.a:e===1?b.b:b.c,w=e===0?b.b:e===1?b.c:b.a;
  const dx=w[0]-v[0],dz=w[1]-v[1];let m=0,px=src[(n-1)*2],pz=src[(n-1)*2+1];
  let d0=sign*(dx*(pz-v[1])-dz*(px-v[0]));
  for(let i=0;i<n;i++){
   const cx=src[i*2],cz=src[i*2+1],d1=sign*(dx*(cz-v[1])-dz*(cx-v[0]));
   if(d1>=-1e-10){
    if(d0< -1e-10){const k=d0/(d0-d1);dst[m++]=px+k*(cx-px);dst[m++]=pz+k*(cz-pz);}
    dst[m++]=cx;dst[m++]=cz;
   }else if(d0>=-1e-10){const k=d0/(d0-d1);dst[m++]=px+k*(cx-px);dst[m++]=pz+k*(cz-pz);}
   px=cx;pz=cz;d0=d1;
  }
  n=m/2;const tmp=src;src=dst;dst=tmp;
 }
 return {data:src,count:n};
}
function exactGap(upper,lower){
 if(upper.xmax<lower.xmin||upper.xmin>lower.xmax||upper.zmax<lower.zmin||upper.zmin>lower.zmax)return {gap:Infinity,point:null,pairs:0};
 let gap=Infinity,point=null,pairs=0,book=gapScratch.marks.get(lower);
 if(!book||book.marks.length!==lower.top.length){book={marks:new Uint32Array(lower.top.length),stamp:0};gapScratch.marks.set(lower,book);}
 for(const a of upper.bottom){
  if(a.maxx<lower.xmin||a.minx>lower.xmax||a.maxz<lower.zmin||a.minz>lower.zmax)continue;
  book.stamp=(book.stamp+1)>>>0;if(!book.stamp){book.marks.fill(0);book.stamp=1;}
  const stamp=book.stamp,marks=book.marks,bx0=lower.bx(a.minx),bx1=lower.bx(a.maxx),bz0=lower.bz(a.minz),bz1=lower.bz(a.maxz);
  for(let z=bz0;z<=bz1;z++)for(let x=bx0;x<=bx1;x++)for(const n of lower.bins[z*lower.nx+x]){
   if(marks[n]===stamp)continue;marks[n]=stamp;const b=lower.top[n];
   if(a.maxx<b.minx||a.minx>b.maxx||a.maxz<b.minz||a.minz>b.maxz)continue;
   const poly=clipTriangleScratch(a,b);if(!poly.count)continue;pairs++;
   for(let i=0;i<poly.count;i++){
    const px=poly.data[i*2],pz=poly.data[i*2+1];
    const d=(a.A-b.A)*px+(a.B-b.B)*pz+a.C-b.C+upper.yOffset-lower.yOffset;
    if(d<gap){gap=d;point=[px,b.A*px+b.B*pz+b.C+lower.yOffset,pz];}
   }
  }
 }
 return {gap,point,pairs};
}
