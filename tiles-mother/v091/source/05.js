
/* Candidate construction constraints. Units: metres. No imported geometry. */
(()=>{'use strict';
const G=TilesMotherV08Parts.geometry,C=TilesStudyCore;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sha=(s)=>C.hash(String(s));
class Surface {
 constructor(raw,pose={}){
  this.raw=raw;this.pose={x:0,y:0,z:0,angleX:0,angleZ:0,...pose};
  this.m=G.transform(raw,this.pose); const p=this.m.positions;
  this.minX=Infinity;this.maxX=-Infinity;this.minZ=Infinity;this.maxZ=-Infinity;
  for(let i=0;i<p.length;i+=3){this.minX=Math.min(this.minX,p[i]);this.maxX=Math.max(this.maxX,p[i]);this.minZ=Math.min(this.minZ,p[i+2]);this.maxZ=Math.max(this.maxZ,p[i+2]);}
  this.nx=28;this.nz=36;this.sx=this.nx/(this.maxX-this.minX);this.sz=this.nz/(this.maxZ-this.minZ);
  this.bins=Array.from({length:this.nx*this.nz},()=>[]);this.tris=[];
  const I=this.m.indices;
  for(let i=0;i<I.length;i+=3){
   const a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3;
   const x0=p[a],z0=p[a+2],dx1=p[b]-x0,dz1=p[b+2]-z0,dx2=p[c]-x0,dz2=p[c+2]-z0;
   const det=dx1*dz2-dz1*dx2;if(Math.abs(det)<1e-14)continue;
   const tr=[x0,z0,p[a+1],dx1,dz1,dx2,dz2,p[b+1]-p[a+1],p[c+1]-p[a+1],1/det];
   const ti=this.tris.length;this.tris.push(tr);
   const xlo=this.ix(Math.min(p[a],p[b],p[c])),xhi=this.ix(Math.max(p[a],p[b],p[c]));
   const zlo=this.iz(Math.min(p[a+2],p[b+2],p[c+2])),zhi=this.iz(Math.max(p[a+2],p[b+2],p[c+2]));
   for(let z=zlo;z<=zhi;z++)for(let x=xlo;x<=xhi;x++)this.bins[z*this.nx+x].push(ti);
  }
 }
 ix(x){return clamp(Math.floor((x-this.minX)*this.sx),0,this.nx-1)}
 iz(z){return clamp(Math.floor((z-this.minZ)*this.sz),0,this.nz-1)}
 span(x,z){
  if(x<this.minX-1e-8||x>this.maxX+1e-8||z<this.minZ-1e-8||z>this.maxZ+1e-8)return null;
  let lo=Infinity,hi=-Infinity;
  for(const idx of this.bins[this.iz(z)*this.nx+this.ix(x)]){
   const a=this.tris[idx],dx=x-a[0],dz=z-a[1];
   const u=(dx*a[6]-dz*a[5])*a[9],v=(a[3]*dz-a[4]*dx)*a[9];
   if(u < -1e-6||v < -1e-6||u+v>1+1e-6)continue;
   const y=a[2]+u*a[7]+v*a[8];lo=Math.min(lo,y);hi=Math.max(hi,y);
  }
  return lo===Infinity?null:[lo,hi];
 }
}
function footprint(a,b){const x0=Math.max(a.minX,b.minX)+1e-6,x1=Math.min(a.maxX,b.maxX)-1e-6,z0=Math.max(a.minZ,b.minZ)+1e-6,z1=Math.min(a.maxZ,b.maxZ)-1e-6;return x1>x0&&z1>z0?{x0,x1,z0,z1}:null}
function compare(a,b,dense=false){
 const box=footprint(a,b);if(!box)return null;
 let worst=-Infinity,minGap=Infinity,count=0,at=null;
 const visit=(x,z)=>{if(x<box.x0||x>box.x1||z<box.z0||z>box.z1)return;const sa=a.span(x,z),sb=b.span(x,z);if(!sa||!sb)return;const gap=sb[0]-sa[1];count++;if(gap<minGap){minGap=gap;at=[x,sa[1],z];}worst=Math.max(worst,-gap);};
 const nx=Math.max(5,Math.ceil((box.x1-box.x0)/(dense?.0018:.005))),nz=Math.max(5,Math.ceil((box.z1-box.z0)/(dense?.0025:.006)));
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)visit(box.x0+(box.x1-box.x0)*i/nx,box.z0+(box.z1-box.z0)*j/nz);
 for(const s of [a,b]){const p=s.m.positions;const stride=dense?3:12;for(let k=0;k<p.length;k+=stride)visit(p[k],p[k+2]);}
 return count?{required:worst,gap:minGap,count,at}:null;
}
function auditGeometry(raw){
 const p=raw.positions,I=raw.indices,n=raw.normals;let volume=0,badOutward=0,degenerate=0,badNormal=0;
 const edges=new Map();const keys=[];
 for(let v=0;v<p.length/3;v++)keys.push([p[v*3],p[v*3+1],p[v*3+2]].map(x=>Math.round(x*1e7)).join(','));
 let count=0;
 for(let k=0;k<I.length;k+=3){
  const va=I[k],vb=I[k+1],vc=I[k+2],a=va*3,b=vb*3,c=vc*3;
  const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
  const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
  if(Math.hypot(cx,cy,cz)<1e-12)degenerate++;
  if(cx*(n[a]+n[b]+n[c])+cy*(n[a+1]+n[b+1]+n[c+1])+cz*(n[a+2]+n[b+2]+n[c+2])<=0)badNormal++;
  volume+=(p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]))/6;
  const face=raw.face[va];
  let ex=0,ey=0,ez=0;
  if(face===1||face===0){
   for(const v of [va,vb,vc]){const u=face===1?v:v-raw.count;ex+=(p[u*3]-p[(u+raw.count)*3]);ey+=(p[u*3+1]-p[(u+raw.count)*3+1]);ez+=(p[u*3+2]-p[(u+raw.count)*3+2]);}
   if(face===0){ex=-ex;ey=-ey;ez=-ez;}
  } else if(face===-1)ez=-1;else if(face===-3)ez=1;
  else {
   const sign=face===-2?1:-1;
   if(raw.profile==='cover'){const theta=Math.PI*.472;ex=sign*Math.cos(theta)*raw.tile.dimensions.width*.5;ey=-Math.sin(theta)*raw.tile.dimensions.curve;}
   else{ex=sign;ey=2*raw.tile.dimensions.curve/(raw.tile.dimensions.width*.5);}
  }
  if(cx*ex+cy*ey+cz*ez<=0)badOutward++;
  for(const [v,w] of [[va,vb],[vb,vc],[vc,va]]){const kv=keys[v],kw=keys[w],key=kv<kw?kv+'|'+kw:kw+'|'+kv;let r=edges.get(key);if(!r){r={count:0,balance:0};edges.set(key,r)}r.count++;r.balance+=kv<kw?1:-1;}
  count++;
 }
 let boundary=0,orientation=0,nonmanifold=0;for(const e of edges.values()){if(e.count===1)boundary++;if(e.count>2)nonmanifold++;if(e.balance!==0)orientation++;}
 return {triangles:count,vertices:p.length/3,volumeM3:volume,outwardErrors:badOutward,normalErrors:badNormal,degenerate,boundaryEdges:boundary,nonmanifoldEdges:nonmanifold,directedEdgeErrors:orientation,minThicknessMM:raw.metrics.minThickness*1000,
  pass:volume>0&&badOutward===0&&badNormal===0&&degenerate===0&&boundary===0&&nonmanifold===0&&orientation===0};
}
function tileRaw(family,row,col,settings,budget){
 const base=family==='pan'?{length:32,width:22,thickness:1.15,curve:3.1,taper:10}:{length:32,width:15.8,thickness:1.05,curve:6.3,taper:42};
 const seed=sha(settings.seed+'/'+family+'/'+row+'/'+col)||1;
 const d={...base,warp:settings.form,pores:settings.pores,damage:settings.edge};
 const tile=G.tile(family,`roof/${family}/${row}/${col}`,seed,d,{});
 const raw=G.mesh(tile,{...budget,damage:settings.age/150*.25});return {raw,tile};
}
function place(raw,pose,obstacles,dense=false){
 let s=new Surface(raw,pose);let shift=-Infinity;let hits=[];
 for(const ob of obstacles){const cmp=compare(ob.surface,s,dense);if(cmp){shift=Math.max(shift,cmp.required);hits.push({id:ob.id,...cmp});}}
 if(shift!==-Infinity){pose={...pose,y:(pose.y||0)+shift+.00055};s=new Surface(raw,pose);}
 return {surface:s,pose,hits};
}
async function build(settings,budget,yieldUI=async()=>{}){
 const records=[];const step=.22*1.05+.0055,rowStep=.32*settings.exposure;
 for(let row=0;row<4;row++)for(let col=0;col<3;col++){
  const id=`pan/${row}/${col}`,{raw,tile}=tileRaw('pan',row,col,settings,budget);
  const pose={x:(col-1)*step,y:0,z:(row-1.5)*rowStep,angleX:0,angleZ:0};
  const obs=records.filter(r=>r.family==='pan'&&r.col===col);
  const placed=place(raw,pose,obs,true);
  records.push({id,family:'pan',row,col,raw,tile,...placed});await yieldUI(records.length/28);
 }
 const increments=records.filter(r=>r.row>0).map(r=>r.pose.y-records.find(p=>p.col===r.col&&p.row===r.row-1).pose.y);
 const pitch=-.12;
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const id=`cover/${row}/${col}`,{raw,tile}=tileRaw('cover',row,col,settings,budget);
  const base={x:(col-1.5)*step,y:0,z:(row-1.5)*rowStep,angleX:pitch,angleZ:0};
  const obs=records.filter(r=>r.family==='pan'||r.family==='cover'&&r.col===col);
  // Search small roll angles on actual projected triangles, never compare unrelated UVs.
  let best=null;for(const roll of [-.024,0,.024]){
   const candidate=place(raw,{...base,angleZ:roll},obs,false);
   const score=candidate.pose.y+Math.abs(roll)*.006;
   if(!best||score<best.score)best={...candidate,score};
  }
  const placed=place(raw,best.pose,obs,true);
  records.push({id,family:'cover',row,col,raw,tile,...placed});await yieldUI(records.length/28);
 }
 const relations=[];let penetrations=0,samples=0,minGap=Infinity;
 for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
  const a=records[i],b=records[j],r=compare(a.surface,b.surface,true);if(!r)continue;
  const spanA=a.surface.span(r.at[0],r.at[2]),spanB=b.surface.span(r.at[0],r.at[2]);
  const bad=r.gap<-.00015;penetrations+=bad?1:0;samples+=r.count;minGap=Math.min(minGap,r.gap);
  relations.push({a:a.id,b:b.id,gapMM:r.gap*1000,samples:r.count,at:r.at,status:bad?'penetration':r.gap<.0045?'near-contact':'gap'});
 }
 const topology=records.map(r=>({id:r.id,...auditGeometry(r.raw)}));
 const paths=[];
 for(let col=0;col<3;col++){
  const pans=records.filter(r=>r.family==='pan'&&r.col===col);const points=[];
  const zmin=Math.min(...pans.map(r=>r.surface.minZ))+.001,zmax=Math.max(...pans.map(r=>r.surface.maxZ))-.001;
  const x=(col-1)*step;let reverse=0,previous=Infinity;
  for(let k=0;k<=100;k++){const z=zmax+(zmin-zmax)*k/100;let y=-Infinity;for(const r of pans){const v=r.surface.span(x,z);if(v)y=Math.max(y,v[1]);}if(y===-Infinity)continue;
   // Display pitched height, so small local handmade pits are not falsely global reversals.
   const h=y*Math.cos(settings.slope)-z*Math.sin(settings.slope);
   if(h>previous+.0008)reverse++;previous=h;points.push([x,y+.0015,z]);}
  paths.push({col,points,localUpslopeSamples:reverse});
 }
 return {records,relations,topology,paths,pitch,step,rowStep,qa:{tileCount:records.length,panCount:12,coverCount:16,samples,overlapPairs:relations.length,sampledPenetrations:penetrations,minSampleGapMM:minGap*1000,topologyPassed:topology.every(t=>t.pass),minThicknessMM:Math.min(...topology.map(t=>t.minThicknessMM)),boundaryCapSupport:'two edge columns are cropped continuation with one visible pan support',testScope:'projected vertical solid intervals, both mesh-vertex sets and dense XZ sampling; not a complete triangle-triangle intersection proof',visualApproved:false,productionApproved:false}};
}
window.TilesRoof091={Surface,compare,auditGeometry,tileRaw,build};
})();

