// Temporary render tessellation. The contact mesh is retained unchanged.
function displayMesh09F(mesh){
 if(!mesh.reference||!['pan','cover'].includes(mesh.definition?.kind))return mesh;
 if(DISPLAY_CACHE09F.has(mesh))return DISPLAY_CACHE09F.get(mesh);
 const count=mesh.p.length/3,n=Math.round((-64+Math.sqrt(4096-8*(62-count)))/4),B=15;
 if(2*(n+1)*(n+1)+4*(n+1)*B!==count)return mesh;
 let stride=4,grid,error;
 const point=i=>Array.from(mesh.p.slice(i*3,i*3+3));
 function measure(step,custom=null){let xs=Array.from({length:Math.ceil(n/step)+1},(_,i)=>Math.min(n,i*step)),zs=xs.slice();if(custom)xs=custom;if(mesh.definition.kind==='cover'){zs=Array.from({length:n+1},(_,i)=>i);let c=mesh.definition.profile,neck=mesh.definition.neck,k=Math.floor(n*(1-neck/c.l));for(let j=Math.max(0,k-2);j<=Math.min(n,k+2);j++)zs.push(j);zs=[...new Set(zs)].sort((a,b)=>a-b)}let err=0,bad=new Set();
  for(let q=0;q<2;q++)for(let z=0;z<zs.length-1;z++)for(let x=0;x<xs.length-1;x++){let x0=xs[x],x1=xs[x+1],z0=zs[z],z1=zs[z+1],base=q*(n+1)*(n+1),a=point(base+z0*(n+1)+x0),b=point(base+z0*(n+1)+x1),c=point(base+z1*(n+1)+x0),d=point(base+z1*(n+1)+x1);for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){let u=(i-x0)/(x1-x0),v=(j-z0)/(z1-z0),p=point(base+j*(n+1)+i),t=u+v<=1?a.map((a,k)=>a*(1-u-v)+b[k]*u+c[k]*v):d.map((d,k)=>d*(u+v-1)+b[k]*(1-v)+c[k]*(1-u));let deviation=Math.hypot(...p.map((v,k)=>v-t[k]));err=Math.max(err,deviation);if(deviation>.0008)bad.add(x0)}}
 return {xs,zs,error:err,bad:[...bad]};}
 grid=measure(stride);if(mesh.definition.kind==='cover')for(let k=0;k<3&&grid.error>.0008;k++){let xs=grid.xs.flatMap((x,i,a)=>grid.bad.includes(x)&&a[i+1]-x>1?[x,Math.floor((x+a[i+1])/2)]:[x]);grid=measure(stride,xs)}if(grid.error>.0008){stride=2;grid=measure(stride)}if(grid.error>.0008){let out={...mesh,definition:{...mesh.definition,displayOnly:{fallback:true,error:grid.error}}};DISPLAY_CACHE09F.set(mesh,out);return out}
 let indices=[],quad=(a,b,c,d,flip)=>{indices.push(...(flip?[a,c,b,b,c,d]:[a,b,c,b,d,c]))};
 for(let q=0;q<2;q++){let base=q*(n+1)*(n+1);for(let j=0;j<grid.zs.length-1;j++)for(let i=0;i<grid.xs.length-1;i++){let a=base+grid.zs[j]*(n+1)+grid.xs[i],b=base+grid.zs[j]*(n+1)+grid.xs[i+1],c=base+grid.zs[j+1]*(n+1)+grid.xs[i],d=base+grid.zs[j+1]*(n+1)+grid.xs[i+1];quad(a,b,c,d,q===0)}}
 for(let edge=0;edge<4;edge++){let base=2*(n+1)*(n+1)+edge*(n+1)*B,axis=edge<2?grid.zs:grid.xs;for(let i=0;i<axis.length-1;i++)for(let k=0;k<B-1;k++)quad(base+axis[i]*B+k,base+axis[i+1]*B+k,base+axis[i]*B+k+1,base+axis[i+1]*B+k+1,edge===0||edge===3)}
 let ids=[...new Set(indices)],map=new Map(ids.map((v,i)=>[v,i])),out={...mesh,idx:new Uint32Array(indices.map(i=>map.get(i)))};
 for(let [name,size]of [['p',3],['n',3],['meta',4],['reference',3]])out[name]=new Float32Array(ids.flatMap(i=>Array.from(mesh[name].slice(i*size,i*size+size))));
 out.definition={...mesh.definition,displayOnly:{retainedContactTriangles:mesh.idx.length/3,displayTriangles:out.idx.length/3,sampledVertexErrorM:grid.error,stride}};DISPLAY_CACHE09F.set(mesh,out);return out;
}

const BOUNDS_CACHE09F=new WeakMap();
function transformedBounds09F(mesh,m){let cache=BOUNDS_CACHE09F.get(mesh);if(!cache){cache=new Map();BOUNDS_CACHE09F.set(mesh,cache)}let key=[...m.slice(0,12)].join('/'),b=cache.get(key);if(!b){let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<mesh.p.length;i+=3){let p=mesh.p;for(let k=0;k<3;k++){let v=m[k]*p[i]+m[4+k]*p[i+1]+m[8+k]*p[i+2];lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v)}}b={lo,hi};cache.set(key,b)}return {lo:b.lo.map((x,k)=>x+m[12+k]),hi:b.hi.map((x,k)=>x+m[12+k])};}
