/* V099 bounded edge/profile study. Units: metres. No source scans at runtime.
   Evidence anchors: Jiangwutang source ae5510c0..., user line drawings 2026-09-05.
   Profile dimensions are inherited; edge amplitudes are visual candidates.
   V098 remains callable. Geometry seed is independent from surface parameters. */
function studyBoundary(kind,s,t,opt){
  const p=PROFILE[kind],seed=opt.seed,amount=clamp(opt.edgeStrength??1,0,1.5);
  const n=(x,k)=>noise2(x,1.7,seed+k)-.5;
  const left=n(t*3.6,17011)*.0017+n(t*8.3,17029)*.00035;
  const right=n(t*3.3,18013)*.0017+n(t*8.7,18041)*.00035;
  const edgeShift=lerp(left,right,(s+1)*.5)*amount;
  const w=lerp(p.widthEave,p.widthRidge,t);
  const h=lerp(p.riseEave,p.riseRidge,t);
  let x=s*w*.5+edgeShift;
  // End-line motion is independent at the two ends and remains sub-mm.
  const end0=(n((s+1)*2.1,19001)*.0014+n((s+1)*5.3,19009)*.00025)*amount;
  const end1=(n((s+1)*2.3,19103)*.0014+n((s+1)*5.1,19121)*.00025)*amount;
  let z=(t-.5)*p.length+lerp(end0,end1,t);
  let y=circleArcY(kind,s*w*.5,w,h);
  const hand=(fbm((s+1)*1.7,t*3.2,seed+31,5)-.5)*.0036+(fbm((s+1)*7.5,t*10.1,seed+73,3)-.5)*.00125;
  y+=hand*(.52+.48*Math.sin(Math.PI*t));
  // A bounded longitudinal variation, not an asserted historic flattened crown.
  y+=amount*Math.sin(Math.PI*t)*Math.sin(Math.PI*(s+1)*.5)*(n(t*2.5,19433)*.0008);
  let cavity=0;
  for(const e of opt.pores){const du=(s-e.s)/e.rx,dv=(t-e.t)/e.ry,r2=du*du+dv*dv;if(r2<5){const g=Math.exp(-r2*1.5),lip=Math.exp(-Math.pow(Math.sqrt(r2)-1.15,2)*8);y-=e.d*g;y+=e.d*.10*lip;cavity=Math.max(cavity,g);}}
  // Sparse local events with independent side identities. No full-edge sawtooth.
  const side=opt.chipSide,level=opt.damageClass;
  const bump=(q,c,r)=>{let d=Math.abs(q-c)/r;return d<1?(1-d*d)**2:0;};
  if(level>0){const at=.24+hash01(seed,2111)*.54,radius=.07+hash01(seed,2113)*.05;
    const near=smooth(.68,1,side*s),event=bump(t,at,radius)*near;
    x-=side*event*(kind==='pan'?.007:.002)*(level===2?1:.52)*amount;
    y-=event*.0016*(level===2?1:.5)*amount;
    // A larger corner loss is retained for the severe lifecycle category.
    if(level===2){const end=opt.chipEnd>0?t:1-t,c=smooth(.65,1,side*s)*smooth(.68,1,end);x-=side*c*(kind==='pan'?.011:.0025)*amount;y-=c*.003*amount;}
  }
  const normal=surfaceNormal(kind,s,t,opt);
  const thick=p.thickness*(1+amount*(n(t*2.7,19831)*.10+n((s+1)*1.8,19841)*.04));
  // Tangent-plane outset; compatible corner values keep all six patches closed.
  let out=new THREE.Vector3(Math.sign(s)*smooth(.78,1,Math.abs(s)),0,Math.sign(t-.5)*smooth(.78,1,Math.abs(2*t-1)));
  out.addScaledVector(normal,-out.dot(normal));
  const bevel=(kind==='pan'?.0016:.00125)*(1+amount*n(t*3+(s+1),19913)*.25);
  return {p:new THREE.Vector3(x,y,z),normal,out,thick,bevel,cavity,relief:hand};
}
function studyRoundPosition(o,q){
  const b=.18;let inset=0;
  if(q<b)inset=1-Math.sqrt(Math.max(0,1-(1-q/b)**2));
  else if(q>1-b)inset=1-Math.sqrt(Math.max(0,1-(1-(1-q)/b)**2));
  return o.p.clone().addScaledVector(o.normal,-o.thick*q).addScaledVector(o.out,-o.bevel*inset);
}
function smoothCoincidentNormals(g){
  // Weld the normal accumulator only. UV islands and vertex attributes stay split.
  const P=g.attributes.position.array,I=g.index.array,N=new Float32Array(P.length),sums=new Map(),keys=[];
  for(let i=0;i<P.length;i+=3)keys.push([P[i],P[i+1],P[i+2]].map(v=>Math.round(v*1e7)).join(','));
  for(let k=0;k<I.length;k+=3){const a=I[k],b=I[k+1],c=I[k+2],ax=P[b*3]-P[a*3],ay=P[b*3+1]-P[a*3+1],az=P[b*3+2]-P[a*3+2],bx=P[c*3]-P[a*3],by=P[c*3+1]-P[a*3+1],bz=P[c*3+2]-P[a*3+2],n=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];for(const j of [a,b,c]){let sum=sums.get(keys[j]);if(!sum){sum=[0,0,0];sums.set(keys[j],sum);}for(let v=0;v<3;v++)sum[v]+=n[v];}}
  for(let i=0;i<keys.length;i++){const n=sums.get(keys[i])||[0,1,0],len=Math.hypot(...n)||1;for(let v=0;v<3;v++)N[i*3+v]=n[v]/len;}
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
}
function makeTileGeometryV099(kind='pan',options={}){
  if(!PROFILE[kind])throw new Error('Unknown tile family');
  const opt={seed:1,damageClass:0,edgeStrength:1,...options},p=PROFILE[kind];
  opt.pores=poreEvents(opt.seed,10+opt.damageClass*5);opt.chipSide=hash01(opt.seed,901)>.5?1:-1;opt.chipEnd=hash01(opt.seed,902)>.5?1:-1;
  const nu=options.nu??36,nv=options.nv??46;
  const pos=[],uv=[],cavity=[],face=[],relief=[],param=[],idx=[],surfaces=[],top=[],bottom=[];
  const add=(P,u,v,c,fc,r,stq)=>{const i=pos.length/3;param.push(...stq);pos.push(P.x,P.y,P.z);uv.push(u,v);cavity.push(c);face.push(fc);relief.push(r);return i;};
  const begin=name=>surfaces.push({name,start:idx.length,count:0}),end=()=>surfaces.at(-1).count=idx.length-surfaces.at(-1).start;
  for(let j=0;j<=nv;j++){top[j]=[];bottom[j]=[];for(let i=0;i<=nu;i++){const o=studyBoundary(kind,i/nu*2-1,j/nv,opt);top[j][i]=add(studyRoundPosition(o,0),i/nu,j/nv,o.cavity,1,o.relief,[i/nu*2-1,j/nv,0]);bottom[j][i]=add(studyRoundPosition(o,1),i/nu,j/nv,0,0,0,[i/nu*2-1,j/nv,1]);}}
  begin('top');for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=top[j][i],b=top[j][i+1],c=top[j+1][i],d=top[j+1][i+1];idx.push(a,c,b,b,c,d);}end();
  begin('bottom');for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=bottom[j][i],b=bottom[j][i+1],c=bottom[j+1][i],d=bottom[j+1][i+1];idx.push(a,b,c,b,d,c);}end();
  const qs=nv<=22?[0,.18,.5,.82,1]:[0,.05272,.18,.5,.82,.94728,1];
  function edge(name,n,fn,order){begin(name);const grid=[],lengths=[0];let prev=null,total=0;
    for(let k=0;k<=n;k++){const [s,t]=fn(k/n),o=studyBoundary(kind,s,t,opt);if(prev)total+=o.p.distanceTo(prev);lengths[k]=total;prev=o.p;grid[k]={o,s,t,ids:[]};}
    for(let k=0;k<=n;k++){const o=grid[k].o;for(const q of qs)grid[k].ids.push(add(studyRoundPosition(o,q),lengths[k]/total,1-q,0,0,0,[grid[k].s,grid[k].t,q]));}
    for(let k=0;k<n;k++)for(let r=0;r<qs.length-1;r++){const a=grid[k].ids[r],b=grid[k+1].ids[r],c=grid[k].ids[r+1],d=grid[k+1].ids[r+1];if(order==='A')idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}end();
  }
  edge('left',nv,t=>[-1,t],'A');edge('right',nv,t=>[1,t],'B');edge('eave',nu,u=>[u*2-1,0],'B');edge('ridge',nu,u=>[u*2-1,1],'A');
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('studyParam',new THREE.Float32BufferAttribute(param,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('tileCavity',new THREE.Float32BufferAttribute(cavity,1));g.setAttribute('tileFace',new THREE.Float32BufferAttribute(face,1));g.setAttribute('tileRelief',new THREE.Float32BufferAttribute(relief,1));g.setIndex(idx);smoothCoincidentNormals(g);surfaces.forEach((s,i)=>g.addGroup(s.start,s.count,i));g.computeBoundingSphere();
  g.userData={kind,profile:p,surfaces,geometryRevision:'0.9.9-edge-study',seed:opt.seed,edgeStrength:opt.edgeStrength,bevelBands:qs.length-1,uvConvention:{top:['+x','+z'],bottom:['+x','+z'],left:['+z','innerToOuter'],right:['+z','innerToOuter'],eave:['+x','innerToOuter'],ridge:['+x','innerToOuter']}};return g;
}
function makeTileGeometry(kind='pan',options={}){
  return state.geometryRevision===0?makeTileGeometryV098(kind,options):makeTileGeometryV099(kind,{edgeStrength:state.edgeStrength??1,...options});
}

// V098 used a fixed world-axis side-normal sign. A rounded side crosses that
// sign legitimately; evaluate the shell-normal/edge-outward profile instead.
// Winding, UV direction and normal attributes are checked independently.
function uvGate(geometry){
 const result=uvGateV098(geometry);
 if(geometry.userData.geometryRevision!=='0.9.9-edge-study')return result;
 const P=geometry.attributes.position.array,I=geometry.index.array,Q=geometry.attributes.studyParam.array;
 for(const f of result.faces){
  const surf=geometry.userData.surfaces.find(s=>s.name===f.face);let minDot=1;
  for(let k=surf.start;k<surf.start+surf.count;k+=3){
   const ids=[I[k],I[k+1],I[k+2]],v=ids.map(i=>new THREE.Vector3(P[i*3],P[i*3+1],P[i*3+2]));
   const actual=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();let expected;
   if(f.face==='top'||f.face==='bottom')expected=new THREE.Vector3(0,f.face==='top'?1:-1,0);
   else{
    const stq=[0,0,0];for(const id of ids)for(let d=0;d<3;d++)stq[d]+=Q[id*3+d]/3;
    const [s,t,q]=stq,opt={seed:geometry.userData.seed,edgeStrength:geometry.userData.edgeStrength,damageClass:0,pores:[]};
    const o=studyBoundary(geometry.userData.kind,s,t,opt),N=o.normal;
    const vector={left:[-1,0,0],right:[1,0,0],eave:[0,0,-1],ridge:[0,0,1]}[f.face];
    const L=new THREE.Vector3(...vector);L.addScaledVector(N,-L.dot(N));
    let derivative=0;const b=.18;
    if(q<b){const a=1-q/b;derivative=a/(b*Math.sqrt(Math.max(1e-10,1-a*a)));}
    else if(q>1-b){const a=1-(1-q)/b;derivative=-a/(b*Math.sqrt(Math.max(1e-10,1-a*a)));}
    expected=L.clone().normalize().multiplyScalar(o.thick).addScaledVector(N,o.bevel*L.length()*derivative).normalize();
   }
   minDot=Math.min(minDot,actual.dot(expected));
  }
  f.noGeometricFold=minDot>0;f.minOutwardDot=minDot;f.outwardCriterion='shell normal and rounded edge-profile outward direction';
  f.passed=f.noGeometricFold&&f.finite&&f.inRange&&f.zeroAreaTriangles===0&&f.orientationConsistent&&f.tangentAligned&&f.bitangentAligned;
 }
 result.allPassed=result.faces.every(f=>f.passed);return result;
}
