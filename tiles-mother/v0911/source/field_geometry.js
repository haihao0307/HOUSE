/* Local procedural geometry generated on state change, never per render frame.
   Noise controls fracture roughness; an explicit demand model controls the cut locus.
   'opened' specimens are inspection explosions, not rigid-body flight simulations. */
function fieldRoughWood(g,seed){
 const broken=g.userData.surfaces.filter(s=>s.broken);
 if(!broken.length)return g;
 const P=Array.from(g.attributes.position.array),U=Array.from(g.attributes.uv.array),C=Array.from(g.attributes.color.array),oldI=g.index.array,newI=[],faces=[];
 const radius=g.userData.radius,radial=g.userData.radial,ringCount=8;
 const fieldRaggedRim=(theta,seed)=>.08+.20*(.5+.5*Math.sin(theta*3+seed*.13))+.65*Math.pow(.5+.5*Math.sin(theta*7+seed*.17),5);
 const ends=broken.map(part=>{const ix=oldI[part.start]*3;return {part,cx:P[ix],cy:P[ix+1],cz:P[ix+2],sign:part.name==='end'?1:-1};});
 const fieldAmp=Math.min(radius*.62,.027,...ends.flatMap(a=>ends.filter(b=>Math.abs(a.cz-b.cz)>1e-7).map(b=>Math.abs(a.cz-b.cz)*.30)));
 // Move duplicated shell/end boundary vertices together. Original intact ends stay flat.
 for(const e of ends)for(let j=0;j<P.length;j+=3)if(Math.abs(P[j+2]-e.cz)<1e-7){
  const theta=Math.atan2(P[j+1]-e.cy,P[j]-e.cx),rho=Math.min(1,Math.hypot(P[j]-e.cx,P[j+1]-e.cy)/radius);
  P[j+2]+=e.sign*fieldAmp*rho*fieldRaggedRim(theta,seed);
 }
 // Follow the actual fibre coordinate on the moved side ring; cap UVs stay separate.
 const sidePart=g.userData.surfaces.find(part=>part.name==='side');
 for(let k=sidePart.start;k<sidePart.start+sidePart.count;k++){const i=oldI[k];U[i*2+1]=P[i*3+2]/g.userData.length+.5;}
 for(const part of g.userData.surfaces){
  const start=newI.length;
  if(!part.broken){for(let k=part.start;k<part.start+part.count;k++)newI.push(oldI[k]);faces.push({...part,start,count:newI.length-start});continue;}
  const centre=oldI[part.start],cx=P[centre*3],cy=P[centre*3+1],cz=ends.find(e=>e.part===part).cz,end=part.name==='end',sign=end?1:-1;
  const originalRim=[];for(let k=part.start;k<part.start+part.count;k+=3){const ix=oldI[k+(end?1:2)];originalRim.push(ix);}
  const ring=[[]],amp=fieldAmp;
  const add=(x,y,z,rho,theta)=>{
   const i=P.length/3,noise=noise2((x-cx)/radius*5.2,(y-cy)/radius*5.2,seed+933);
   P.push(x,y,z);U.push(.5+(end?1:-1)*(x-cx)/(radius*2),.5+(y-cy)/(radius*2));
   const fresh=new THREE.Color().setRGB(.29+noise*.10,.185+noise*.073,.091+noise*.045);C.push(fresh.r,fresh.g,fresh.b);return i;
  };
  const c0=add(cx,cy,cz+sign*amp*.20,0,0);
  for(let r=1;r<=ringCount;r++){
   const rho=r/ringCount,ids=[];
   for(let i=0;i<radial;i++){
    const a=originalRim[i],x=lerp(cx,P[a*3],rho),y=lerp(cy,P[a*3+1],rho);
    const n=noise2((x-cx)/radius*6,(y-cy)/radius*6,seed+977),n2=noise2((x-cx)/radius*13,(y-cy)/radius*13,seed+991);
    const splinter=(n-.4)*1.05+Math.pow(n2,4)*.55;
    // Match the moved shell rim exactly, with signed depth along the fibre axis.
    const z=lerp(cz,P[a*3+2],rho*rho)+sign*amp*(1-rho*rho)*splinter;
    ids.push(add(x,y,z,rho,i/radial*Math.PI*2));
   }ring[r]=ids;
  }
  for(let i=0;i<radial;i++){const a=ring[1][i],b=ring[1][(i+1)%radial];end?newI.push(c0,a,b):newI.push(c0,b,a);}
  for(let r=1;r<ringCount;r++)for(let i=0;i<radial;i++){
   const a=ring[r][i],b=ring[r][(i+1)%radial],c=ring[r+1][i],d=ring[r+1][(i+1)%radial];
   end?newI.push(a,c,b,b,c,d):newI.push(a,b,c,b,d,c);
  }
  faces.push({...part,start,count:newI.length-start,fieldCap:true});
 }
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(P,3));out.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));out.setAttribute('color',new THREE.Float32BufferAttribute(C,3));out.setIndex(newI);out.computeVertexNormals();out.computeBoundingBox();out.computeBoundingSphere();out.userData={...g.userData,surfaces:faces,fieldFracture:true};faces.forEach(s=>out.addGroup(s.start,s.count,s.name==='side'?0:1));g.dispose();return out;
}
function woodGeometry(length,segments,seed,radius=.04,sampler=()=>({loss:0,y:0}),breakRanges=[]){
 const g=woodGeometryV0910(length,segments,seed,radius,sampler,breakRanges);
 if(!g.index.count){g.userData.detached=true;return g;}
 return state.fieldMode&&state.fibreEnds?fieldRoughWood(g,seed):g;
}
function woodUVGate(g){
 if(g.userData.detached&&g.index.count===0)return {allPassed:true,status:'not_applicable_detached_geometry',faces:[]};
 if(!g.userData.fieldFracture)return woodUVGateV0910(g);
 // Existing side and original ends remain checked by the original gate.
 // A true rough end is no longer planar; its winding must still face outward.
 const P=g.attributes.position.array,U=g.attributes.uv.array,I=g.index.array;
 const base=woodUVGateV0910(g);
 for(const face of base.faces){if(face.face==='side')continue;
  let ok=true,uvOK=true,min=Infinity,count=0;
  for(const f of g.userData.surfaces.filter(f=>f.name===face.face))for(let k=f.start;k<f.start+f.count;k+=3){
   const a=I[k],b=I[k+1],c=I[k+2];const ab=new THREE.Vector3(P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]),ac=new THREE.Vector3(P[c*3]-P[a*3],P[c*3+1]-P[a*3+1],P[c*3+2]-P[a*3+2]);
   const n=ab.cross(ac),area=n.length(),dot=n.z*(face.face==='end'?1:-1)/Math.max(area,1e-20);min=Math.min(min,dot);count++;
   ok&&=area>1e-12&&dot>1e-6;
   const d=(U[b*2]-U[a*2])*(U[c*2+1]-U[a*2+1])-(U[b*2+1]-U[a*2+1])*(U[c*2]-U[a*2]);uvOK&&=d>1e-10;
  }
  face.outward=ok&&count>0;face.minOutwardDot=min;face.outwardCriterion='positive signed fibre-axis component on nonplanar end';face.nonMirrored=uvOK;face.passed=face.finite&&face.uvRange&&face.nonzeroArea&&uvOK&&face.outward;
 }base.allPassed=base.faces.every(f=>f.passed);return base;
}
function fieldCutS(t,seed,s0){return clamp(s0+.033*Math.sin(t*12+seed*.01)+.015*Math.sin(t*39+seed*.037),-.65,.65);}
function fieldTileHalf(kind,seed,side,s0){
 const opt={seed,damageClass:0,edgeStrength:state.edgeStrength,pores:poreEvents(seed,10),chipSide:1,chipEnd:1};
 const nu=22,nv=46,qs=[0,.10,.32,.65,.9,1],P=[],U=[],F=[],CV=[],RL=[],CUT=[],I=[],surfaces=[];
 const sample=(u,t,q)=>{
  const cut=fieldCutS(t,seed,s0),s=side<0?lerp(-1,cut,u):lerp(cut,1,u),o=studyBoundary(kind,s,t,opt);
  const atCut=side<0?u===1:u===0;
  const pt=studyRoundPosition(o,q);
  if(atCut)pt.x+=.0008*Math.sin(Math.PI*q)*Math.sin(t*81+q*9+seed*.1);
  return {pt,s,t,q,cut:atCut};
 };
 const add=(s,u,v,isCut)=>{const i=P.length/3;P.push(...s.pt.toArray());U.push(u,v);F.push(s.q<.01?1:0);CV.push(0);RL.push(0);CUT.push(isCut?1:0);return i;};
 const patch=(name,nx,ny,fn,order,isCut=false)=>{
  const start=I.length,grid=[];for(let j=0;j<=ny;j++){grid[j]=[];for(let i=0;i<=nx;i++){const v=i/nx,w=j/ny;grid[j][i]=add(fn(v,w),v,w,isCut);}}
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i],d=grid[j+1][i+1];order?I.push(a,c,b,b,c,d):I.push(a,b,c,b,d,c);}
  surfaces.push({name,start,count:I.length-start});
 };
 patch('top',nu,nv,(u,t)=>sample(u,t,0),true);patch('bottom',nu,nv,(u,t)=>sample(u,t,1),false);
 patch('left',nv,10,(t,q)=>sample(0,t,q),true,side>0);patch('right',nv,10,(t,q)=>sample(1,t,q),false,side<0);
 patch('eave',nu,10,(u,q)=>sample(u,0,q),false);patch('ridge',nu,10,(u,q)=>sample(u,1,q),true);
 const g=new THREE.BufferGeometry();for(const [n,a,k] of [['position',P,3],['uv',U,2],['tileFace',F,1],['tileCavity',CV,1],['tileRelief',RL,1],['waveCut',CUT,1]])g.setAttribute(n,new THREE.Float32BufferAttribute(a,k));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={kind,profile:PROFILE[kind],surfaces,fieldFragment:true,seed,side,s0};return g;
}
function fieldMossGroup(items,amount=1,limit=100){
 if(!state.mossEnabled||!state.fieldMode||amount<=0||state.mode==='uv'||state.mode==='clay')return null;
 const P=[],C=[],U=[],I=[];let patches=0,minClear=Infinity,maxHeight=0;
 const low=new THREE.Color('#495238'),high=new THREE.Color('#858651');
 for(const item of items){
  if(patches>=limit)break;const seed=item.seed,proxy=item.proxy||makeProxy(item.geometry),m=item.matrix||new THREE.Matrix4(),count=item.patches??2;
  for(let ev=0;ev<count&&patches<limit;ev++){
   const bounds=proxy,rangeX=bounds.xmax-bounds.xmin,rangeZ=bounds.zmax-bounds.zmin;
   const cx=lerp(bounds.xmin+rangeX*.21,bounds.xmax-rangeX*.21,hash01(seed,ev,71));
   const cz=lerp(bounds.zmin+rangeZ*.18,bounds.zmin+rangeZ*.48,hash01(seed,ev,79));
   const rx=Math.min(rangeX*.19,.022)*( .7+hash01(seed,ev,83)*.55),rz=Math.min(rangeZ*.15,.026)*(.8+hash01(seed,ev,87)*.7),H=(.005+hash01(seed,ev,89)*.008)*amount;
   const radial=14,bands=5,grid=[],positions=[];let valid=true;
   const form=(rho,ang)=>{
    const wobble=1+.17*Math.sin(ang*3+seed*.1)+.10*Math.cos(ang*7+ev),x=cx+rx*rho*Math.cos(ang)*wobble,z=cz+rz*rho*Math.sin(ang)*wobble;
    const y=proxy.height(x,z);if(!Number.isFinite(y)){valid=false;return null;}
    const n=noise2(x*350,z*350,seed+ev*53),e=Math.max(0,1-rho*rho),height=.00022+H*Math.pow(e,.70)*(.60+.40*n);
    const v=new THREE.Vector3(x,y+height,z).applyMatrix4(m);return {v,n,height};
   };
   const centre=form(0,0);for(let r=1;r<=bands;r++){positions[r]=[];for(let a=0;a<radial;a++)positions[r].push(form(r/bands,a/radial*Math.PI*2));}
   if(!valid)continue;
   const put=(o,u,v)=>{const i=P.length/3;P.push(...o.v.toArray());U.push(u,v);const c=low.clone().lerp(high,o.n*.65);C.push(c.r,c.g,c.b);minClear=Math.min(minClear,o.height);maxHeight=Math.max(maxHeight,o.height);return i;};
   const ci=put(centre,.5,.5);
   for(let r=1;r<=bands;r++){grid[r]=[];for(let a=0;a<radial;a++)grid[r].push(put(positions[r][a],.5+Math.cos(a/radial*6.283)*r/bands*.5,.5+Math.sin(a/radial*6.283)*r/bands*.5));}
   for(let a=0;a<radial;a++)I.push(ci,grid[1][(a+1)%radial],grid[1][a]);
   for(let r=1;r<bands;r++)for(let a=0;a<radial;a++){const b=(a+1)%radial,x=grid[r][a],y=grid[r][b],z=grid[r+1][a],w=grid[r+1][b];I.push(x,y,z,y,w,z);}
   patches++;
  }
 }
 if(!P.length)return null;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingSphere();
 const mesh=new THREE.Mesh(g,waveMossMaterial());mesh.castShadow=mesh.receiveShadow=state.scene!=='roof';mesh.userData={kind:'field-moss',patches,triangles:I.length/3,minimumSurfaceClearance:minClear,maximumCandidateThickness:maxHeight};return mesh;
}
function fieldAddTrioMoss(){
 const tiles=stageRoot.children.filter(o=>o.isMesh&&o.userData.kind&&PROFILE[o.userData.kind]);
 for(const [i,m] of tiles.entries()){
  const moss=fieldMossGroup([{geometry:m.geometry,seed:state.seed+i*739,patches:2}],state.mossThickness*(.55+i*.22),8);
  if(moss)m.add(moss);
 }
}
function fieldAddRoofMoss(record){
 if(record.roof.userData.fieldDecorated)return;
 const items=[];for(const family of ['panFits','coverFits'])for(const fit of record[family]){
  if(!fit||hash01(fit.id,state.seed,610)<.75)continue;
  const p=fit.proxy;items.push({geometry:p.geometry,matrix:p.matrix,seed:state.seed+fit.id*739,patches:1});
 }
 const amount=state.mossThickness*(state.care==='abandoned'?.20+.80*Math.min(1,state.year/6):.20);
 const m=fieldMossGroup(items,amount,record.kind==='roof'?84:20);if(m)record.roof.add(m);record.roof.userData.fieldDecorated=true;record.fieldMoss=m?.userData??null;
}
let fieldLabReport=null;
function buildFieldLab(){
 clearStage();const years=state.care==='maintained'?0:state.year,seed=state.seed,kind=state.trioFamily==='cover'?'cover':'pan',both=state.specimen==='both';
 const makeTile=()=>{
  const demand=fieldTileDemand(kind,years,seed,state.rainInput,state.loadFactor),gap=state.openCut*.065;
  const group=new THREE.Group();group.position.set(both?-.28:0,both?.105:0,0);group.rotation.x=-.20;group.scale.setScalar(both?1.9:2.35);stageRoot.add(group);
  const items=[];
  if(demand.failed&&state.fieldMode){for(const side of [-1,1]){const g=fieldTileHalf(kind,seed,side,demand.s),mat=state.mode==='clay'?new THREE.MeshStandardMaterial({color:0x9c9d96,roughness:.86}):studyClayMaterial(kind,1,state.initialAge+state.year),m=new THREE.Mesh(g,mat);m.position.x=side*gap*.5;m.castShadow=m.receiveShadow=true;group.add(m);const moss=fieldMossGroup([{geometry:g,seed:seed+side*731,patches:2}],state.mossThickness,5);if(moss)m.add(moss);}}
  else{const m=tileMesh(kind,1,state.initialAge+state.year);group.add(m);const moss=fieldMossGroup([{geometry:m.geometry,seed,patches:3}],state.mossThickness,4);if(moss)m.add(moss);}
  return {demand,inspectionGap:gap};
 };
 const makeWood=()=>{
  const length=.62,r=.048,demand=fieldBeamDemand(length,r,years,seed+437,state.rainInput,state.loadFactor),t=demand.t,gap=state.openCut*.075;
  const lossFn=t=>fieldDamageAt(t,years,seed+437,state.rainInput),sample=t=>{const d=lossFn(t);return {loss:d.loss,stain:d.damage*.65,y:-.003*d.damage*Math.sin(t*Math.PI)};};
  const ranges=demand.failed?[[Math.max(.06,t-.020-gap/(2*length)),Math.min(.94,t+.020+gap/(2*length))]]:[];
  const g=woodGeometry(length,60,seed+437,r,sample,ranges),m=new THREE.Mesh(g,state.mode==='clay'?[new THREE.MeshStandardMaterial({color:0x9c9d96,roughness:.86}),new THREE.MeshStandardMaterial({color:0x9c9d96,roughness:.86})]:getWoodMaterials(false));
  m.rotation.set(.25,.5,0);m.position.set(both?.37:0,both?-.015:0,0);m.castShadow=m.receiveShadow=true;stageRoot.add(m);
  return {demand,inspectionGap:gap,uv:woodUVGate(g),geometry:g};
 };
 const tile=state.specimen!=='wood'?makeTile():null,wood=state.specimen!=='tile'?makeWood():null;
 fieldLabReport={year:state.year,exposureYears:years,care:state.care,tile:tile?.demand??null,wood:wood?.demand??null,woodUV:wood?.uv??null,inspectionExploded:true,fullStructuralSolver:false};
 $('#sceneStats').innerHTML=`<b>噪波材质 · 受水与断口样台</b><span>失养经过 ${years} 年；原房龄 ${state.initialAge} 年。统一种子与局部坐标，噪波不随相机游动。</span><span>${tile?'陶瓦相对失效指标 '+tile.demand.ratio.toFixed(2)+'，断口横向位置 '+tile.demand.s.toFixed(3):''} ${wood?'木材相对失效指标 '+wood.demand.ratio.toFixed(2)+'，峰值在长度的 '+(wood.demand.t*100).toFixed(1)+'%':''}</span><span>值达到 1 触发本示意模型的断裂。受力简化与材料参数未标定；展开断口用于检查，不表示刚体坠落。</span><span>纯计算材质；苔厚独立几何；顺纤维参差断面。可切回上一版表面作同机位比较。</span>`;
 const box=new THREE.Box3().setFromObject(stageRoot),centre=box.getCenter(new THREE.Vector3());target.copy(centre);yaw=-.38;pitch=.48;distance=(both?2.15:1.40)*Math.max(1,.95/camera.aspect);updateCamera();
 $('#contactGate').textContent='断口示意 · 非承载校核';$('#contactGate').className='pill';
}
