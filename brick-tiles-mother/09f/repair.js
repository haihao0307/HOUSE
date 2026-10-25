// 09A uses the accepted 08D shell construction and Microscope field.
// Display tessellations are rebuilt from dimensions; they are not persistent identity.
const TILE_CACHE=new Map();
function tilePoint(kind,u,t,seed=23){
 if(kind==='pan')return tilePoint08D(kind,u,t,seed);
 const P=PROFILE.cover,C=ACTIVE_COVER,z=(t-.5)*P.l,bodyEnd=C.body/P.l;
 const shoulder=.002/P.l,a=smooth(bodyEnd-shoulder,bodyEnd,t);
 const w=mix(mix(C.w,C.w*.965,Math.min(1,t/bodyEnd)),C.wn,a),h=mix(C.h,C.hn,a);
 const R=(w*w*.25+h*h)/(2*h),x=u*w*.5;
 const base=tilePoint08D(kind,u,t,seed),oldW=mix(P.w0,P.w1,t),oldH=mix(P.h0,P.h1,t),oldR=(oldW*oldW*.25+oldH*oldH)/(2*oldH),oldX=u*oldW*.5;
 return [x+(base[0]-oldX),Math.sqrt(Math.max(1e-8,R*R-x*x))-(R-h)+(base[1]-(Math.sqrt(Math.max(1e-8,oldR*oldR-oldX*oldX))-(oldR-oldH))),z+(base[2]-(t-.5)*P.l)];
}
let ACTIVE_COVER=spec().cover;
function tileN(kind,u,t,seed){let a=V.sub(tilePoint(kind,u+.0001,t,seed),tilePoint(kind,u-.0001,t,seed));if(kind==='cover')return V.norm([-a[1],a[0],0]);let b=V.sub(tilePoint(kind,u,t+.0001,seed),tilePoint(kind,u,t-.0001,seed));return V.norm(V.cross(b,a));}
function shellMesh(kind,set=STUDY.set){
 const detail=STUDY.family==='tile'?192:80,key=[kind,set,STUDY.datum,settings.micStrength,settings.micScale,detail].join('/');if(TILE_CACHE.has(key))return TILE_CACHE.get(key);
 const p=spec(set),C=p.cover;ACTIVE_COVER=C;
 PROFILE.pan={l:p.pan.l,w0:p.pan.w0,w1:p.pan.w1,h0:p.pan.h,h1:p.pan.h*.94,t:p.pan.t};
 PROFILE.cover={l:C.body+C.neck,w0:C.w,w1:C.wn,h0:C.h,h1:C.hn,t:C.t};
 const g=ceramic(kind,23,0,detail),points=Array.from(g.p);g.p=[];g.idx=Array.from(g.idx);g.meta=Array.from(g.meta);
 for(let i=0;i<points.length/3;i++){let p=points.slice(i*3,i*3+3),m=g.meta.slice(i*4,i*4+4),o=allSurfaceOffset(p,m,kind),hand=tileHand(p,m,31);g.p.push(...p.map((v,k)=>v+o[k]+hand[k]*.55));}
 g.finish();g.reference=new Float32Array(points);g.definition={kind,set,profile:JSON.parse(JSON.stringify(PROFILE[kind])),neck:kind==='cover'?C.neck:null,source:'08D ceramic normal-offset shell + independent neck shoulder',microscope:{source:'08D 17-octave kernel',strength:settings.micStrength,scale:settings.micScale,baked:true},unit:'m',error_m:null};TILE_CACHE.set(key,g);return g;
}
// Same exact projected-triangle method as the prior audit, accelerated with an x/z index.
function contact(lower,lm,upper,um){
 const L=triangles(lower,lm),U=triangles(upper,um),cell=.009,bins=new Map();
 const range=t=>[Math.floor(t.xmin/cell),Math.floor(t.xmax/cell),Math.floor(t.zmin/cell),Math.floor(t.zmax/cell)];
 for(let i=0;i<L.length;i++){let [x0,x1,z0,z1]=range(L[i]);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){let k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(i)}}
 let min=Infinity,count=0,where=null;for(let b of U){let ids=new Set(),[x0,x1,z0,z1]=range(b);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(let i of bins.get(x+','+z)||[])ids.add(i);for(let i of ids){let a=L[i];if(a.xmin>b.xmax||a.xmax<b.xmin||a.zmin>b.zmax||a.zmax<b.zmin)continue;let poly=intersect(a,b);if(poly.length<3)continue;count++;for(let [x,z] of poly){let d=b.y(x,z)-a.y(x,z);if(d<min){min=d;where=[x,z]}}}}
 return {minGapM:min,trianglePairs:count,where,pass:count>0&&min>=-.00005};
}
const ROOF_CACHE=new Map();
function conformingBed(pan,angle,cutZ,baseY,slope,maxZ=null){
 const top=[],faces=[],map=new Map(),pm=M.rx(angle),vtx=p=>{let k=p.map(v=>Math.round(v*1e8)).join(',');if(!map.has(k)){map.set(k,top.length);top.push(p)}return map.get(k)};
 for(let j=0;j<pan.idx.length;j+=3){let ids=Array.from(pan.idx.slice(j,j+3));if(!ids.every(i=>pan.meta[i*4+2]===1&&pan.meta[i*4]===1))continue;
  let poly=ids.map(i=>M.transform(pm,Array.from(pan.p.slice(i*3,i*3+3))));
  if(cutZ!==null){let out=[];for(let k=0;k<poly.length;k++){let a=poly[k],b=poly[(k+1)%poly.length],inside=a[2]>=cutZ,next=b[2]>=cutZ;if(inside)out.push(a);if(inside!==next){let t=(cutZ-a[2])/(b[2]-a[2]);out.push(a.map((x,n)=>mix(x,b[n],t)))}}poly=out;}
  if(!STUDY.deck){for(let [edge,sign]of [[-.04,1],[.04,-1]]){let out=[];for(let k=0;k<poly.length;k++){let a=poly[k],b=poly[(k+1)%poly.length],inside=sign*(a[0]-edge)>=0,next=sign*(b[0]-edge)>=0;if(inside)out.push(a);if(inside!==next){let t=(edge-a[0])/(b[0]-a[0]);out.push(a.map((x,n)=>mix(x,b[n],t)))}}poly=out;}}if(maxZ!==null){let out=[];for(let k=0;k<poly.length;k++){let a=poly[k],b=poly[(k+1)%poly.length],inside=a[2]<=maxZ,next=b[2]<=maxZ;if(inside)out.push(a);if(inside!==next){let t=(maxZ-a[2])/(b[2]-a[2]);out.push(a.map((x,n)=>mix(x,b[n],t)))}}poly=out;}if(poly.length<3)continue;let ix=poly.map(p=>vtx([p[0],p[1]-.00005,p[2]]));for(let k=1;k<ix.length-1;k++)faces.push([ix[0],ix[k+1],ix[k]]);
 }
 let G=new Mesh(),n=top.length,edges=new Map();for(let p of top)G.vertex(p);for(let p of top)G.vertex([p[0],baseY+slope*p[2],p[2]]);
 for(let f of faces){G.tri(...f);G.tri(f[2]+n,f[1]+n,f[0]+n);for(let k=0;k<3;k++){let a=f[k],b=f[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}}
 for(let [a,b]of edges.values())G.quad(b,a,b+n,a+n);
 G.definition={kind:'assumed bedding fitted to displaced tile underside',topGapM:.00005,notHistoricalMeasurement:true};return G.finish();
}
function roofSeats(){
 let key=[STUDY.set,STUDY.datum,settings.micStrength,settings.micScale].join('/');if(ROOF_CACHE.has(key))return ROOF_CACHE.get(key);
 const p=spec(),pan=shellMesh('pan'),cover=shellMesh('cover'),xs=Array.from(pan.p).filter((_,i)=>i%3===0),spacing=Math.max(...xs)-Math.min(...xs)+.001,step=p.cover.body-.003,panAngle=.07,pm=M.rx(panAngle),phase=-p.cover.neck-.010;
 const panLap=contact(pan,pm,pan,M.mul(M.translate(0,0,step),pm)),rise=-panLap.minGapM+.00005;
 // Cover roll balances the two genuine bearing edges, then translation solves their contact.
 let roll=0,cy=0,angle=0,left,right;
 for(let n=0;n<5;n++){
  let rot=M.mul(M.rz(roll),M.rx(angle)),lap=contact(cover,rot,cover,M.mul(M.translate(0,rise,step),rot));angle-=(lap.minGapM-.00010)/step;
  let cm=M.mul(M.translate(0,0,phase),M.mul(M.rz(roll),M.rx(angle)));left=contact(pan,M.mul(M.translate(-spacing/2,0,0),pm),cover,cm);right=contact(pan,M.mul(M.translate(spacing/2,0,0),pm),cover,cm);
  roll+=clamp((left.minGapM-right.minGapM)/Math.max(.005,right.where[0]-left.where[0]),-.025,.025);
 }
 let cm=M.mul(M.rz(roll),M.rx(angle));
 left=contact(pan,M.mul(M.translate(-spacing/2,0,0),pm),cover,M.mul(M.translate(0,0,phase),cm));right=contact(pan,M.mul(M.translate(spacing/2,0,0),pm),cover,M.mul(M.translate(0,0,phase),cm));cy=-Math.min(left.minGapM,right.minGapM)+.00005;
 const checks=[];for(let r of [-1,0,1])for(let side of [-1,1]){let lower=M.mul(M.translate(side*spacing/2,r*rise,r*step),pm),upper=M.mul(M.translate(0,cy,phase),cm),c=contact(pan,lower,cover,upper);checks.push({kind:'cover-pan',row:r,side,...c});}
 let correction=Math.max(0,...checks.map(c=>-c.minGapM+.00005));cy+=correction;
 let lap=contact(cover,cm,cover,M.mul(M.translate(0,rise,step),cm));
 for(let c of checks){c.minGapM+=correction;c.pass=c.trianglePairs===0||c.minGapM>=-.00005;}
 const result={spacing,step,rise,phase,panAngle,coverY:cy,roll,angle,checks,coverLap:lap,panLap:{...panLap,minGapM:panLap.minGapM+rise,pass:true},supportStatus:'solved from actual displaced triangles; unmeasured bedding is explicit'};ROOF_CACHE.set(key,result);return result;
}
const WOOD_PRESET=TimberOriginal.getYunnanTimberPreset('yunnan_warm_medium_v2');
const WOOD_FINISH={kind:'wood',...TimberOriginal.deriveMemberParameters(270889,4401),seed01:.2727171828,roughness:(WOOD_PRESET.surface.roughnessMin+WOOD_PRESET.surface.roughnessMax)*.5};
function woodMesh(raw,axis='x',lift=0,round=false,radius=.1){
 if(['mortised-post','multi-mortised-post','tenoned-beam','source-plane timber profile'].includes(raw.metadata?.type))raw=subdivideTimber(raw);
 let grainHeights=sampleWoodGrain(raw,round,radius),g=new Mesh();g.gp=raw.grainPositions;g.gn=raw.normals;g.sc=raw.surfaceClasses;
 const turn=p=>axis==='y'?[-p[1],p[0],p[2]]:axis==='z'?[p[2],p[1],-p[0]]:p;
 let minX=Infinity,maxX=-Infinity;for(let i=0;i<raw.positions.length;i+=3){minX=Math.min(minX,raw.positions[i]);maxX=Math.max(maxX,raw.positions[i]);}
 for(let i=0;i<raw.positions.length;i+=3){let p=Array.from(raw.positions.slice(i,i+3)),n=Array.from(raw.normals.slice(i,i+3)),s=raw.surfaceClasses[i/3];
  // End and joint cuts remain exact, so relief cannot fill a mortise or alter a tenon fit.
  let gp=Array.from(raw.grainPositions.slice(i,i+3)),gate=smooth(0,.012,Math.min(p[0]-minX,maxX-p[0]));
  if(raw.metadata?.mortise){let m=raw.metadata.mortise;gate*=smooth(0,.012,Math.max(Math.abs(p[0]-m.center)-m.height/2,Math.abs(p[2])-m.depth/2,0));}
  if(raw.metadata?.voids)for(let m of raw.metadata.voids)gate*=smooth(0,.012,Math.max(Math.abs(p[0]-(m.y-raw.bounds.length/2))-m.h/2,Math.abs(p[2])-m.d/2,0));
  if(raw.metadata?.tenon)gate*=smooth(0,.012,Math.max(0,raw.bounds.bodyLength/2-Math.abs(p[0])));
  let h=(woodMacro(gp,s,WOOD_PRESET,WOOD_FINISH)*2.2+(s===0?grainHeights[i/3]:0))*gate,r=Math.max(.001,Math.hypot(gp[1],gp[2])),d=turn([p[0],p[1]+gp[1]/r*h,p[2]+gp[2]/r*h]);d[1]+=lift;g.vertex(d);}
 g.idx=Array.from(raw.indices);let windingRepairs=0;for(let j=0;j<g.idx.length;j+=3){let ids=g.idx.slice(j,j+3),p=ids.map(i=>Array.from(raw.positions.slice(i*3,i*3+3))),n=ids.reduce((s,i)=>V.add(s,Array.from(raw.normals.slice(i*3,i*3+3))),[0,0,0]);if(V.dot(V.cross(V.sub(p[1],p[0]),V.sub(p[2],p[0])),n)<0){[g.idx[j+1],g.idx[j+2]]=[g.idx[j+2],g.idx[j+1]];windingRepairs++;}}
 g.finish(false);g.wood={round,radius};g.definition={kind:raw.metadata?.type||'timber',dimensions:raw.bounds,geometry:raw.metadata,grainAxis:axis,material:'original PBR timber master / yunnan_warm_medium_v2',macroRelief:'original CPU macro x2.2 plus original GLSL coarse/medium grain sampled into geometry, 12 mm end/joint fade',grainDisplacementMaxM:Math.max(...grainHeights.map(Math.abs)),windingRepairs,unit:'m'};return g;
}
function subdivideTimber(raw){
 const out={positions:[],normals:[],grainPositions:[],surfaceClasses:[],indices:[],bounds:raw.bounds,metadata:raw.metadata};
 for(let j=0;j<raw.indices.length;j+=3){let ids=Array.from(raw.indices.slice(j,j+3)),v=ids.map(i=>Array.from(raw.positions.slice(i*3,i*3+3))),gn=ids.map(i=>Array.from(raw.normals.slice(i*3,i*3+3))),gp=ids.map(i=>Array.from(raw.grainPositions.slice(i*3,i*3+3))),sc=raw.surfaceClasses[ids[0]],n=Math.min(20,Math.max(1,Math.ceil(Math.max(...v.map((p,k)=>Math.hypot(...V.sub(p,v[(k+1)%3]))))/.025))),rows=[];
  for(let a=0;a<=n;a++){let row=[];for(let b=0;b<=n-a;b++){let w=[1-(a+b)/n,a/n,b/n],i=out.positions.length/3;row.push(i);for(let [name,data]of [['positions',v],['normals',gn],['grainPositions',gp]])for(let k=0;k<3;k++)out[name].push(data.reduce((sum,p,j)=>sum+p[k]*w[j],0));out.surfaceClasses.push(sc)}rows.push(row)}
  for(let a=0;a<n;a++)for(let b=0;b<n-a;b++){out.indices.push(rows[a][b],rows[a+1][b],rows[a][b+1]);if(b<n-a-1)out.indices.push(rows[a+1][b],rows[a+1][b+1],rows[a][b+1]);}
 }
 for(let k of ['positions','normals','grainPositions','surfaceClasses'])out[k]=new Float32Array(out[k]);return out;
}
function woodBox(w,h,d){let axis=h>=w&&h>=d?'y':w>=d?'x':'z',len=axis==='y'?h:axis==='x'?w:d,cross=axis==='y'?w:axis==='x'?h:h,depth=axis==='z'?w:d;return woodMesh(TimberOriginal.createSubdividedBoxGeometry(len,cross,depth,{lengthSegments:72,crossSegments:32}),axis,h/2)}
const WOOD_CACHE=new Map();
function woodRound(r,l){let key=r+'/'+l;if(WOOD_CACHE.has(key))return WOOD_CACHE.get(key);let g=woodMesh(TimberOriginal.createCylinderGeometry(l,r,96,{axialSegments:96}), 'z',0,true,r);WOOD_CACHE.set(key,g);return g}
function multiMortisedPost(height,width,depth,holes){
 const xs=[-height/2,height/2,...holes.flatMap(h=>[h.y-height/2-h.h/2,h.y-height/2+h.h/2])].sort((a,b)=>a-b),ys=[-width/2,width/2],zs=[-depth/2,depth/2,...holes.flatMap(h=>[-h.d/2,h.d/2])].sort((a,b)=>a-b);
 const X=[...new Set(xs)],Y=ys,Z=[...new Set(zs)],filled=(i,j,k)=>{if(i<0||j<0||k<0||i>=X.length-1||j>=Y.length-1||k>=Z.length-1)return false;let x=(X[i]+X[i+1])/2,z=(Z[k]+Z[k+1])/2;return !holes.some(h=>Math.abs(x-(h.y-height/2))<h.h/2&&Math.abs(z)<h.d/2)};
 let raw={positions:[],normals:[],grainPositions:[],surfaceClasses:[],indices:[],bounds:{length:height,width,depth},metadata:{type:'multi-mortised-post',voids:holes,grainAxis:[1,0,0]}};
 for(let i=0;i<X.length-1;i++)for(let j=0;j<Y.length-1;j++)for(let k=0;k<Z.length-1;k++){if(!filled(i,j,k))continue;
  const p=[[X[i],Y[j],Z[k]],[X[i+1],Y[j],Z[k]],[X[i],Y[j+1],Z[k]],[X[i+1],Y[j+1],Z[k]],[X[i],Y[j],Z[k+1]],[X[i+1],Y[j],Z[k+1]],[X[i],Y[j+1],Z[k+1]],[X[i+1],Y[j+1],Z[k+1]]];
  for(let [di,dj,dk,ids]of [[-1,0,0,[0,4,6,2]],[1,0,0,[1,3,7,5]],[0,-1,0,[0,1,5,4]],[0,1,0,[2,6,7,3]],[0,0,-1,[0,2,3,1]],[0,0,1,[4,5,7,6]]]){
   if(filled(i+di,j+dj,k+dk))continue;let b=raw.positions.length/3,outer=(di<0&&i===0)||(di>0&&i===X.length-2)||dj!==0||(dk<0&&k===0)||(dk>0&&k===Z.length-2),sc=outer?(di?1:0):2;
   for(let n of ids){raw.positions.push(...p[n]);raw.grainPositions.push(...p[n]);raw.normals.push(di,dj,dk);raw.surfaceClasses.push(sc)}raw.indices.push(b,b+1,b+2,b,b+2,b+3);
  }
 }
 for(let k of ['positions','normals','grainPositions','surfaceClasses'])raw[k]=new Float32Array(raw[k]);return woodMesh(raw,'y',height/2);
}
function woodProfile(poly,depth){
 const g=extrude(poly,depth),raw={positions:[],normals:[],grainPositions:[],surfaceClasses:[],indices:[],bounds:{},metadata:{type:'source-plane timber profile',profile_m:poly,depth_m:depth,depth_status:'assumed'}};
 let cx=(Math.min(...poly.map(p=>p[0]))+Math.max(...poly.map(p=>p[0])))/2,cy=(Math.min(...poly.map(p=>p[1]))+Math.max(...poly.map(p=>p[1])))/2;
 for(let j=0;j<g.idx.length;j+=3){let v=Array.from(g.idx.slice(j,j+3)).map(i=>Array.from(g.p.slice(i*3,i*3+3))),n=V.norm(V.cross(V.sub(v[1],v[0]),V.sub(v[2],v[0])));for(let p of v){raw.indices.push(raw.positions.length/3);raw.positions.push(...p);raw.grainPositions.push(p[0]-cx,p[1]-cy,p[2]);raw.normals.push(...n);raw.surfaceClasses.push(Math.abs(n[0])>.72?1:0)}}
 for(let k of ['positions','normals','grainPositions','surfaceClasses'])raw[k]=new Float32Array(raw[k]);return woodMesh(raw);
}
function woodFinial(profile){
 let G=new Mesh(),N=48;for(let [y,r]of profile)for(let i=0;i<=N;i++){let a=i*TAU/N;G.vertex([r*Math.cos(a),y,r*Math.sin(a)])}
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<N;i++){let a=j*(N+1)+i;G.quad(a,a+N+1,a+1,a+N+2)}
 for(let end of [0,1]){let j=end?profile.length-1:0,c=G.vertex([0,profile[j][0],0]);for(let i=0;i<N;i++)end?G.tri(c,j*(N+1)+i+1,j*(N+1)+i):G.tri(c,i,i+1)}G.finish();
 const raw={positions:[],normals:[],grainPositions:[],surfaceClasses:[],indices:G.idx,bounds:{},metadata:{type:'turned finial profile',profile_m:profile,depth_status:'radial interpretation of front outline'}};
 for(let i=0;i<G.p.length;i+=3){let p=[G.p[i+1],-G.p[i],G.p[i+2]],n=[G.n[i+1],-G.n[i],G.n[i+2]];raw.positions.push(...p);raw.grainPositions.push(...p);raw.normals.push(...n);raw.surfaceClasses.push(Math.abs(n[0])>.72?1:0)}for(let k of ['positions','normals','grainPositions','surfaceClasses'])raw[k]=new Float32Array(raw[k]);return woodMesh(raw,'y');
}
function bindWood(gl,program,wood,eye){
 const names=new Proxy({},{get:(_,k)=>gl.getUniformLocation(program,k)});
 TimberOriginal.bindOriginalTimberUniforms(gl,names,{kind:'wood',material:{...WOOD_FINISH,shapeMode:wood?.round?'round':'box',memberRadius:wood?.radius||.1},geometry:{metadata:{supportsMacroDisplacement:true}},model:TimberOriginal.mat4Identity()},{preset:WOOD_PRESET,settings:{reliefMode:'inspection'},cameraPosition:eye,view:TimberOriginal.mat4Identity(),projection:TimberOriginal.mat4Identity()});
 gl.uniform1f(names.u_parallaxM,0);gl.uniform1f(names.u_parallaxSteps,0);
}
