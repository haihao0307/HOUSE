/* Brick Mother R5. Independent procedural specimen kernel, 2026-09-06.
   No imports, network, external meshes or image textures. A regular sampled
   signed field is NOT guaranteed to be an exact Euclidean distance field.
   Body field evaluations are cached. Only local cutters touch local voxels.
   Surface-net quads reuse vertices. Normals are accumulated from triangles. */
function createBrickKernel(){
'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), mix=(a,b,t)=>a+(b-a)*t;
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rng(s){return()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;}}
function hash(x,y,z,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1274126177)^s;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
function noise(x,y,z,s){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);x-=ix;y-=iy;z-=iz;x=x*x*(3-2*x);y=y*y*(3-2*y);z=z*z*(3-2*z);return mix(mix(mix(hash(ix,iy,iz,s),hash(ix+1,iy,iz,s),x),mix(hash(ix,iy+1,iz,s),hash(ix+1,iy+1,iz,s),x),y),mix(mix(hash(ix,iy,iz+1,s),hash(ix+1,iy,iz+1,s),x),mix(hash(ix,iy+1,iz+1,s),hash(ix+1,iy+1,iz+1,s),x),y),z);}
function derive(master,layer){let v=master>>>0;for(let i=0;i<layer.length;i++){v=Math.imul(v^layer.charCodeAt(i),16777619)>>>0;}return v;}
const defaults={kiln:{shape:'long',damage:.27,relief:.38,edgeWear:.62,grain:.43,color:1.1,wet:0,rough:.80},dressed:{shape:'long',damage:.43,relief:.60,grain:.55,color:1,wet:0,rough:.87},pebble:{shape:'sample',damage:.14,relief:.33,grain:.20,color:1,wet:0,rough:.67},fired:{shape:'long',damage:.23,relief:.36,edgeWear:.62,grain:.50,color:1,wet:0,rough:.84},stone:{shape:'sample',damage:.55,relief:.74,grain:.55,color:1,wet:0,rough:.90},rubble:{shape:'sample',damage:.62,relief:.68,grain:.60,color:1,wet:0,rough:.90},adobe:{shape:'sample',damage:.27,relief:.42,edgeWear:.78,grain:.50,color:1,wet:0,rough:.97}};
function validate(c){if(c?.edgeWear!==undefined&&(!Number.isFinite(c.edgeWear)||c.edgeWear<0||c.edgeWear>1))throw Error('圆蚀参数越界');if(!c||typeof c!=='object'||!Object.prototype.hasOwnProperty.call(defaults,c.family))throw Error('未知材料');for(const k of ['damage','relief'])if(!Number.isFinite(c[k])||c[k]<0||c[k]>1)throw Error('形体参数越界');if(!['sample','long','half','thin'].includes(c.shape))throw Error('未知形态');if(!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295)throw Error('主种子需为32位非负整数');if(!Number.isInteger(c.resolution)||c.resolution<40||c.resolution>120)throw Error('采样精度越界');for(const k of ['shapeSeed','damageSeed','colorSeed','fiberSeed'])if(c[k]!==undefined&&(!Number.isInteger(c[k])||c[k]<0||c[k]>4294967295))throw Error('子种子越界');}
function build(c){
 validate(c);const begin=performance.now(),family=c.family,isStone=family==='stone'||family==='rubble'||family==='dressed',isBrick=family==='fired'||family==='kiln',isPebble=family==='pebble';
 const seed=c.seed>>>0,ss=(c.shapeSeed??derive(seed,'shape'))>>>0,ds=(c.damageSeed??derive(seed,'damage'))>>>0,cs=(c.colorSeed??derive(seed,'color'))>>>0,fs=(c.fiberSeed??derive(seed,'fiber'))>>>0;
 const R=rng(ss),D=rng(ds),h=c.shape==='thin'?[1.24,.66,.24]:c.shape==='long'?[1.32,.56,.43]:c.shape==='half'?[.74,.80,.44]:[1.17,.80,.44];
 if(isPebble){const ph=c.shape==='long'?[1.18,.54,.54]:c.shape==='thin'?[.99,.41,.70]:[.89,.70,.68];h.splice(0,3,...ph);h[0]*=.96+R()*.08;h[1]*=.96+R()*.08;h[2]*=.96+R()*.08;}
 if(family==='rubble'){h[0]*=.90+R()*.13;h[1]*=.92+R()*.19;h[2]*=1.32+R()*.28;}if(family==='stone'){h[2]*=1.1;}
 const dx=2*(Math.max(...h)+.16)/(c.resolution-1),dims=h.map(a=>Math.ceil(2*(a+.14)/dx)+1),[nx,ny,nz]=dims,N=nx*ny*nz,org=dims.map(n=>-(n-1)*dx/2),stride=nx*ny;
 const field=new Float32Array(N),jitter=new Float32Array(N),baseValues=N;let stampValues=0;
 const planes=[];if(family==='rubble')for(let j=0;j<9;j++){let n=norm([R()*2-1,R()*2-1,R()*2-1]);planes.push([...n,(Math.abs(n[0])*h[0]+Math.abs(n[1])*h[1]+Math.abs(n[2])*h[2])*(.61+R()*.27)]);}
 // Radius is a bounded, nominal modelling scale. No historical dimensions are claimed.
 const soft=isBrick||family==='adobe',wear=c.edgeWear??(family==='adobe'?.78:.62);
 const phase=R()*20,radius=soft?(family==='adobe'?.055+wear*.135:.042+wear*.098):.036;
 const beds=[];let level=-h[1]*1.1;while(level<h[1]*1.2){level+=.09+R()*.22;beds.push([level,(R()-.5)*.16]);}
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=x+nx*y+stride*z,px=org[0]+x*dx,py=org[1]+y*dx,pz=org[2]+z*dx;
  const a=noise(px*2.8+phase,py*2.8,pz*2.8,ss)-.5,b=noise(px*12,py*12,pz*12,ss+711)-.5;
  jitter[i]=b;
  let bedOffset=0;if(family==='stone'){const w=py+px*.14+pz*.10;for(const b of beds){if(w>b[0])bedOffset=b[1];else break;}}
  const qx=Math.abs(px+.018*a)-h[0]+radius,qy=Math.abs(py+.02*a)-h[1]+radius,qz=Math.abs(pz)-h[2]-bedOffset*c.relief+radius;
  let sd=Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-radius;
  if(isPebble){const ex=px+.04*a,ey=py+.05*a,ez=pz;const k0=Math.hypot(ex/h[0],ey/h[1],ez/h[2]),k1=Math.hypot(ex/(h[0]*h[0]),ey/(h[1]*h[1]),ez/(h[2]*h[2]));sd=k1>1e-9?k0*(k0-1)/k1:-Math.min(...h);}
  for(const p of planes)sd=Math.max(sd,px*p[0]+py*p[1]+pz*p[2]-p[3]);
  if(soft){
   // Keep broad moulded faces. Round exposed edges before adding small surface changes.
   const margins=[h[0]-Math.abs(px),h[1]-Math.abs(py),h[2]-Math.abs(pz)].sort((a,b)=>a-b);
   const faceWeight=clamp(margins[1]/Math.max(radius*1.7,dx));
   sd+=(a*.032+b*.028*(.16+.84*faceWeight))*c.relief;
  }else sd+=a*(family==='rubble'?.16:.060)*c.relief+(b*(isStone?.072:.052)+Math.pow(clamp((b+.5-.35)/.36),.32)*.035)*c.relief;
  if(isPebble)sd-=a*.042*c.relief+b*.034*c.relief;
  field[i]=sd;
 }
 const baseEnd=performance.now(),eventLog=[];
 function cut(center,U,V,W,r,kind){
  const ext=[0,1,2].map(a=>Math.abs(U[a])*r[0]+Math.abs(V[a])*r[1]+Math.abs(W[a])*r[2]+dx+(soft?.04:0));
  const lo=center.map((p,a)=>clamp(Math.floor((p-ext[a]-org[a])/dx),1,dims[a]-2)),hi=center.map((p,a)=>clamp(Math.ceil((p+ext[a]-org[a])/dx),1,dims[a]-2));
  const mm=Math.min(...r);let hits=0;
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
   const i=x+y*nx+z*stride,px=org[0]+x*dx-center[0],py=org[1]+y*dx-center[1],pz=org[2]+z*dx-center[2];
   const u=(px*U[0]+py*U[1]+pz*U[2])/r[0],v=(px*V[0]+py*V[1]+pz*V[2])/r[1],w=(px*W[0]+py*W[1]+pz*W[2])/r[2];
   stampValues++;
   // Compact, softly faceted cutters. Meso jitter was cached with the base.
   const n=kind==='chip'?Math.max(Math.abs(u)*.92+Math.abs(v)*.27,Math.abs(v)*.96+Math.abs(w)*.18,Math.abs(w)*.86+Math.abs(u)*.22,(Math.abs(u)+Math.abs(v)+Math.abs(w))*.53):Math.hypot(u,v,w);
   const d=(n-1)*mm+jitter[i]*Math.min(soft?.018:.095,mm*(soft?.38:1.12));
   if(soft){
    // Smooth union of voids rounds shallow chip mouths; it never adds material.
    const k=.013+wear*.018,u=clamp(1-Math.abs(field[i]+d)/k);
    const next=Math.max(field[i],-d)+k*u*u*.25;
    if(next>field[i]){field[i]=next;hits++;}
   }else if(-d>field[i]){field[i]=-d;hits++;}
  }
  eventLog.push({kind,center,r,hits});
 }
 function faceEvent(axis,sign,u,v,ru,rv,rd,angle,kind){
  const other=[0,1,2].filter(a=>a!==axis),W=[0,0,0],A=[0,0,0],B=[0,0,0],C=[0,0,0];W[axis]=sign;A[other[0]]=1;B[other[1]]=1;
  C[other[0]]=u;C[other[1]]=v;C[axis]=sign*(h[axis]+rd*.30);
  let U=A.map((a,k)=>a*Math.cos(angle)+B[k]*Math.sin(angle)),V=A.map((a,k)=>-a*Math.sin(angle)+B[k]*Math.cos(angle));
  cut(C,U,V,W,[ru,rv,rd],kind);
 }
 const count=Math.round(c.damage*(isPebble?7:isStone?55:isBrick?66:54));
 for(let k=0;k<count;k++){
  const axis=isBrick?[2,2,1,0][Math.floor(k/2)%4]:[2,2,1,0][Math.floor(k/2)%4],sign=k%2?1:-1,oth=[0,1,2].filter(a=>a!==axis);
  const a=(D()*1.92-.96)*h[oth[0]],b=(D()*1.90-.95)*h[oth[1]],large=soft?(c.damage>.60&&k%14===0):k%10===0;
  let ru=large?.20+D()*.26:.035+D()*.11,rv=large?.12+D()*.14:ru*(.55+D()*.55),rd=large?.10+D()*.085:.038+D()*.085;
  if(soft){const severity=.48+.52*c.damage;ru*=severity;rv*=severity;rd*=.28+.50*c.damage;
   // Common aged blocks retain most of their skin; deep loss is an explicit high-damage case.
  }
  if(isStone){ru*=1.1;rv*=.58;}
  const ang=isStone?-.16+(D()-.5)*.32:D()*6.28;
  faceEvent(axis,sign,a,b,ru,rv,rd,ang,large||isStone?'chip':'pit');
 }
 // A handful of local delaminations and fractures. No through-cuts.
 if(c.damage>(soft?.50:0)&&!isPebble)for(let k=0;k<(isStone?9:3);k++){
  const yy=(k/(isStone?9:5)-.46)*h[1]*1.8+(D()-.5)*.24,xx=(D()-.5)*1.25*h[0];
  faceEvent(2,(isStone&&k%3===0)?-1:1,xx,yy,.24+D()*.38,(isStone?.025:.035)+D()*.035,(.08+D()*.11)*c.damage,-.13+(D()-.5)*.2,'chip');
 }
 if(isStone&&c.damage>0){
  for(let k=0;k<18;k++){
   const ax=[2,2,0,1][Math.floor(k/2)%4],sign=k%2?1:-1,o=[0,1,2].filter(a=>a!==ax);
   const u=(D()*1.72-.86)*h[o[0]],v=(D()*1.72-.86)*h[o[1]],angle=-.22+(D()-.5)*.66;
   faceEvent(ax,sign,u,v,.055+D()*.11,.018+D()*.018,.035+c.damage*.045,angle,'chip');
  }
 }
 if(c.shape==='half')faceEvent(0,1,.08,.04,.54,.44,.20,0,'chip');
 const stampsEnd=performance.now();
 function sample(px,py,pz){
  const q=[(px-org[0])/dx,(py-org[1])/dx,(pz-org[2])/dx];if(q.some((v,a)=>v<0||v>=dims[a]-1))return dx*3;
  const x=Math.floor(q[0]),y=Math.floor(q[1]),z=Math.floor(q[2]),i=x+y*nx+z*stride,t=q.map((v,a)=>v-Math.floor(v));
  return mix(mix(mix(field[i],field[i+1],t[0]),mix(field[i+nx],field[i+nx+1],t[0]),t[1]),mix(mix(field[i+stride],field[i+stride+1],t[0]),mix(field[i+stride+nx],field[i+stride+nx+1],t[0]),t[1]),t[2]);
 }
 // Face-consistent, multi-component surface nets. Each face resolves its
 // four-edge ambiguity from its own cached samples, shared by both cells.
 // Separate contour loops receive separate vertices, avoiding the pinches of
 // a single-vertex-per-cell implementation. Normals still use zero field calls.
 const cell=new Int32Array(N);cell.fill(-1);const cellEdges=[],P=[],I=[],C=[],K=[],faceSplitMap=new Map();
 const offsets=[0,1,nx,nx+1,stride,stride+1,stride+nx,stride+nx+1],edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
 const faces=[[0,2,6,4],[1,3,7,5],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]];
 const edgeNum=(a,b)=>edges.findIndex(e=>e.includes(a)&&e.includes(b));
 const faceEdges=faces.map(f=>f.map((c,j)=>edgeNum(c,f[(j+1)%4])));
 let ambiguousCells=0;
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const i=x+y*nx+z*stride;let mask=0;const vals=offsets.map(o=>field[i+o]);for(let j=0;j<8;j++)if(vals[j]<0)mask|=1<<j;if(mask===0||mask===255)continue;
  const points=new Array(12),parents=Array.from({length:12},(_,j)=>j),root=a=>{while(parents[a]!==a){parents[a]=parents[parents[a]];a=parents[a];}return a;},join=(a,b)=>{parents[root(a)]=root(b);};
  for(let e=0;e<12;e++){const[a,b]=edges[e];if(((mask>>a)&1)===((mask>>b)&1))continue;const t=clamp(vals[a]/(vals[a]-vals[b]),.01,.99);points[e]=[mix(a&1,b&1,t),mix((a>>1)&1,(b>>1)&1,t),mix((a>>2)&1,(b>>2)&1,t)];}
  for(let f=0;f<6;f++){
   const face=faces[f],fe=faceEdges[f],crosses=fe.filter(e=>points[e]);
   if(crosses.length===2)join(crosses[0],crosses[1]);
   if(crosses.length===4){
    const inside=face.reduce((v,c)=>v+vals[c],0)<0;
    const fKey=(i+[0,1,0,nx,0,stride][f])*3+Math.floor(f/2);
    let arc=faceSplitMap.get(fKey);const isNew=!arc;if(isNew){arc=new Map();faceSplitMap.set(fKey,arc);}
    for(let j=0;j<4;j++)if((vals[face[j]]<0)!==inside){
     const e0=fe[(j+3)%4],e1=fe[j];join(e0,e1);
     if(isNew){const p0=points[e0],p1=points[e1],vi=P.length/3;P.push(org[0]+(x+(p0[0]+p1[0])*.5)*dx,org[1]+(y+(p0[1]+p1[1])*.5)*dx,org[2]+(z+(p0[2]+p1[2])*.5)*dx);K.push(0);
      for(const e of[e0,e1])arc.set((i+offsets[edges[e][0]])*3+Math.floor(e/4),vi);
     }
    }
   }
  }
  const groups=new Map();for(let e=0;e<12;e++)if(points[e]){let r=root(e);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(e);}
  if(groups.size>1)ambiguousCells++;const edgeV=new Array(12).fill(-1);
  for(const es of groups.values()){
   let sx=0,sy=0,sz=0;for(const e of es){sx+=points[e][0];sy+=points[e][1];sz+=points[e][2];}
   const v=P.length/3;P.push(org[0]+(x+sx/es.length)*dx,org[1]+(y+sy/es.length)*dx,org[2]+(z+sz/es.length)*dx);K.push(0);for(const e of es)edgeV[e]=v;
  }
  cell[i]=cellEdges.length;cellEdges.push(...edgeV);
 }
 function vertex(i,e){return cell[i]>=0?cellEdges[cell[i]+e]:-1;}
 function quad(a,b,c,d,flip,faceKeys,edgeKey){
  if(a<0||b<0||c<0||d<0)return;const v=[a,b,c,d],poly=[];
  for(let j=0;j<4;j++){poly.push(v[j]);const mid=faceSplitMap.get(faceKeys[j])?.get(edgeKey);if(mid!==undefined)poly.push(mid);}
  if(poly.length===4){if(flip)I.push(a,c,b,a,d,c);else I.push(a,b,c,a,c,d);return;}
  // A face may have two distinct contour arcs with the same endpoints.
  // Their shared face-midpoints keep those arcs topologically separate.
  let q=[0,0,0];for(const vi of poly)for(let a=0;a<3;a++)q[a]+=P[vi*3+a]/poly.length;
  const center=P.length/3;P.push(...q);K.push(0);
  for(let j=0;j<poly.length;j++){const k=(j+1)%poly.length;if(flip)I.push(center,poly[k],poly[j]);else I.push(center,poly[j],poly[k]);}
 }
 for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
  const i=x+y*nx+z*stride,sg=field[i]<0;
  if(sg!==(field[i+1]<0))quad(vertex(i,0),vertex(i-nx,1),vertex(i-nx-stride,3),vertex(i-stride,2),!sg,[i*3+1,(i-nx)*3+2,(i-stride)*3+1,i*3+2],i*3);
  if(sg!==(field[i+nx]<0))quad(vertex(i,4),vertex(i-stride,6),vertex(i-stride-1,7),vertex(i-1,5),!sg,[i*3+2,(i-stride)*3,(i-1)*3+2,i*3],i*3+1);
  if(sg!==(field[i+stride]<0))quad(vertex(i,8),vertex(i-1,9),vertex(i-1-nx,11),vertex(i-nx,10),!sg,[i*3,(i-1)*3+1,(i-nx)*3,i*3+1],i*3+2);
 }
 // The specimen is one retained solid; discard isolated numerical crumbs.
 const parent=new Int32Array(P.length/3);for(let j=0;j<parent.length;j++)parent[j]=j;
 function rootOf(a){while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;}
 for(let j=0;j<I.length;j+=3){parent[rootOf(I[j+1])]=rootOf(I[j]);parent[rootOf(I[j+2])]=rootOf(I[j]);}
 const comp=new Map();for(let j=0;j<I.length;j+=3){const r=rootOf(I[j]);comp.set(r,(comp.get(r)||0)+1);}
 let largest=-1,best=0;for(const[r,n]of comp)if(n>best){largest=r;best=n;}
 const removedBodyComponents=Math.max(0,comp.size-1),removedBodyTriangles=I.length/3-best;
 if(removedBodyComponents){const map=new Map(),p=[],ix=[];for(let j=0;j<I.length;j+=3)if(rootOf(I[j])===largest)for(let a=0;a<3;a++){const v=I[j+a];if(!map.has(v)){map.set(v,p.length/3);p.push(P[v*3],P[v*3+1],P[v*3+2]);}ix.push(map.get(v));}
  P.length=0;I.length=0;K.length=0;for(const v of p)P.push(v);for(const v of ix)I.push(v);for(let i=0;i<P.length/3;i++)K.push(0);
 }
 const bodyVertices=P.length/3,bodyIndexCount=I.length,normals=new Array(P.length).fill(0);
 for(let i=0;i<I.length;i+=3){const a=I[i]*3,b=I[i+1]*3,d=I[i+2]*3,v=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],w=[P[d]-P[a],P[d+1]-P[a+1],P[d+2]-P[a+2]],n=cross(v,w);for(const j of[a,b,d])for(let t=0;t<3;t++)normals[j+t]+=n[t];}
 const hullEnd=performance.now();
 for(let i=0;i<bodyVertices;i++){
  const p=P.slice(i*3,i*3+3),n=norm(normals.slice(i*3,i*3+3));normals.splice(i*3,3,...n);
  const macro=noise(p[0]*2.2,p[1]*2.2,p[2]*2.2,cs),meso=noise(p[0]*7.5,p[1]*7.5,p[2]*7.5,cs+88),fine=noise(p[0]*26,p[1]*26,p[2]*26,cs+19);
  let ao=0;for(const d of[.045,.095,.18]){const f=sample(p[0]+n[0]*d,p[1]+n[1]*d,p[2]+n[2]*d);ao+=clamp((d-f)/d)*.16;}
  C.push(macro,meso,fine,1-ao);
 }
 const bodyBounds={min:[0,1,2].map(a=>{let m=Infinity;for(let i=a;i<P.length;i+=3)m=Math.min(m,P[i]);return m}),max:[0,1,2].map(a=>{let m=-Infinity;for(let i=a;i<P.length;i+=3)m=Math.max(m,P[i]);return m})};
 const fiberAudit=[],rejectedFibers=[];
 if(family==='adobe'){
  const F=rng(fs);
  function surface(p,N){let lo=null,hi=.19;const value=t=>sample(...p.map((v,k)=>v+N[k]*t));if(value(hi)<=0)return null;for(let j=1;j<=64;j++){const t=.19-.77*j/64;if(value(t)<0){lo=t;break;}hi=t;}if(lo===null)return null;for(let j=0;j<22;j++){const mid=(lo+hi)/2;if(value(mid)<0)lo=mid;else hi=mid;}return p.map((v,k)=>v+N[k]*(lo+hi)/2);}
  for(let f=0;f<288;f++){
   const fa=f%12,axis=fa<6?2:fa<10?1:0,sign=fa%2?1:-1,N=[0,0,0];N[axis]=sign;const oth=[0,1,2].filter(a=>a!==axis),p=[0,0,0];p[axis]=sign*h[axis];p[oth[0]]=(F()*1.65-.825)*h[oth[0]];p[oth[1]]=(F()*1.65-.825)*h[oth[1]];
   const typ=f%11===0?1:f%5===0?3:f%3===0?2:4,ang=F()*Math.PI*2,U=[0,0,0];U[oth[0]]=Math.cos(ang);U[oth[1]]=Math.sin(ang);const V=norm(cross(N,U));
   const length=typ===1?.16+F()*.15:.06+F()*.18,width=typ===1?.0055+F()*.0035:typ===3?.006+F()*.006:typ===2?.004+F()*.006:.0025+F()*.002,
      thick=typ===1?width:width*(typ===4?.65:.22),bend=(F()-.5)*.045,segments=16,sides=6,start=P.length/3,node=F()>.5?F()*.55+.24:-10,enter=.22+F()*.14,exit=.22+F()*.14;
   const centers=[],values=[],points=[],meta=[],snorm=[];let valid=true;
   for(let j=0;j<=segments;j++){
    const t=j/segments,q=p.map((v,k)=>v+U[k]*(t-.5)*length+V[k]*bend*Math.sin(t*Math.PI)),hit=surface(q,N);if(!hit){valid=false;break;}
    // Both ends lie inside by multiple cell widths. Surface follows the host.
    const ea=clamp(t/enter),eb=clamp((1-t)/exit),hump=Math.min(ea*ea*(3-2*ea),eb*eb*(3-2*eb)),depth=mix(-dx*2.2-thick,thick*(.16+.13*Math.sin(t*9+f)),hump),center=hit.map((v,k)=>v+N[k]*depth),tip=.35+.65*Math.pow(Math.sin(t*Math.PI),.32),ring=typ===1?Math.exp(-Math.pow((t-node)/.030,2)):0;
    centers.push(center);values.push(sample(...center));
    for(let a=0;a<sides;a++){
     const an=a/sides*Math.PI*2,rr=(1+ring*.17),pt=center.map((v,k)=>v+V[k]*Math.cos(an)*width*tip*rr+N[k]*Math.sin(an)*thick*tip*rr);
     points.push(...pt);snorm.push(...norm(V.map((v,k)=>v*Math.cos(an)/width+N[k]*Math.sin(an)/thick)));
     meta.push(t,ring,a/sides,clamp(-sample(...pt)/Math.max(thick,dx*.10)));  // Stable pseudo-random tint, geometry unchanged on color edits.
    }
   }
   if(!valid){rejectedFibers.push({id:'straw-'+f,reason:'no bracketed host surface'});continue;}
   const buried=values.filter(v=>v< -dx*.65).length,exposed=values.filter(v=>v>0).length;
   if(buried<4||values[0]>=-dx*.65||values.at(-1)>=-dx*.65){rejectedFibers.push({id:'straw-'+f,reason:'insufficient two-ended anchor'});continue;}
   P.push(...points);normals.push(...snorm);C.push(...meta);for(let j=0;j<points.length/3;j++)K.push(typ);
   for(let j=0;j<segments;j++)for(let a=0;a<sides;a++){const k=start+j*sides+a,l=start+j*sides+(a+1)%sides;I.push(k,l,k+sides,l,l+sides,k+sides);}
   // End caps close each individual strand; all endpoints are buried.
   for(let a=1;a<sides-1;a++)I.push(start,start+a+1,start+a,start+segments*sides,start+segments*sides+a,start+segments*sides+a+1);
   for(let n=I.length-(segments*sides*6+(sides-2)*6);n<I.length;n+=3){
    const a=I[n]*3,b=I[n+1]*3,d=I[n+2]*3;
    const v=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],w=[P[d]-P[a],P[d+1]-P[a+1],P[d+2]-P[a+2]],cr=cross(v,w);
    if(cr[0]*(normals[a]+normals[b]+normals[d])+cr[1]*(normals[a+1]+normals[b+1]+normals[d+1])+cr[2]*(normals[a+2]+normals[b+2]+normals[d+2])<0){const z=I[n+1];I[n+1]=I[n+2];I[n+2]=z;}
   }
   fiberAudit.push({id:'straw-'+f,type:typ,face:['x','y','z'][axis]+(sign>0?'+':'-'),buriedSamples:buried,exposedCenterSamples:exposed,head:centers[0],tail:centers.at(-1),headField:values[0],tailField:values.at(-1),anchorSamples:centers.filter((p,i)=>values[i]<-dx*.65),vertexStart:start,vertexCount:points.length/3});
  }
 }
 const allEnd=performance.now();
 return {position:new Float32Array(P),normal:new Float32Array(normals),data:new Float32Array(C),kind:new Float32Array(K),index:new Uint32Array(I),stats:{version:'R5.0.0',edgeWear:soft?wear:null,roundRadius:radius,family,seed,shape:c.shape,shapeSeed:ss,damageSeed:ds,colorSeed:cs,fiberSeed:fs,grid:dims,spacing:dx,baseFieldEvaluations:baseValues,localCutterEvaluations:stampValues,normalFieldEvaluations:0,ambiguousCellsResolved:ambiguousCells,removedBodyComponents,removedBodyTriangles,bodyVertices,bodyTriangles:bodyIndexCount/3,bodyIndexCount,vertices:P.length/3,triangles:I.length/3,buildMs:allEnd-begin,stages:{baseMs:baseEnd-begin,cutMs:stampsEnd-baseEnd,meshMs:hullEnd-stampsEnd,attributesAndFibersMs:allEnd-hullEnd},bounds:bodyBounds,fibers:fiberAudit.length,riceHusks:0,fiberAudit,rejectedFibers,eventCount:eventLog.length,liveAnimation:false},debug:c.debug?{field,dims,org,dx,events:eventLog}:undefined};
}
return{build,derive,defaults,noise,validate};
}
if(typeof module!=='undefined'&&module.exports)module.exports=createBrickKernel();
