(() => {
'use strict';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const smoother=t=>t*t*t*(t*(t*6-15)+10);
const v3=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v3(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>v3(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>v3(a.x*s,a.y*s,a.z*s);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const len=a=>Math.hypot(a.x,a.y,a.z);
const norm=a=>{const l=len(a)||1;return mul(a,1/l);};
const lerp3=(a,b,t)=>v3(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));

class RNG{
  constructor(seed){this.s=(Number(seed)>>>0)||1;}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296;}
  range(a,b){return mix(a,b,this.next());}
  int(a,b){return Math.floor(this.range(a,b+1));}
  pick(a){return a[Math.min(a.length-1,Math.floor(this.next()*a.length))];}
  sign(){return this.next()<.5?-1:1;}
}

function hashInt(x,y,z,seed){let h=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^Math.imul(seed|0,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
function noise3(x,y,z,seed){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),tx=smoother(x-xi),ty=smoother(y-yi),tz=smoother(z-zi);
  const h=(dx,dy,dz)=>hashInt(xi+dx,yi+dy,zi+dz,seed);
  const x00=mix(h(0,0,0),h(1,0,0),tx),x10=mix(h(0,1,0),h(1,1,0),tx),x01=mix(h(0,0,1),h(1,0,1),tx),x11=mix(h(0,1,1),h(1,1,1),tx);
  return mix(mix(x00,x10,ty),mix(x01,x11,ty),tz)*2-1;
}
function fbm3(x,y,z,seed,oct=4){let v=0,a=.56,f=1,t=0;for(let i=0;i<oct;i++){v+=noise3(x*f,y*f,z*f,seed+i*1009)*a;t+=a;a*=.49;f*=2.03;}return v/Math.max(t,1e-6);}
function ridged3(x,y,z,seed,oct=4){let v=0,a=.56,f=1,t=0;for(let i=0;i<oct;i++){const n=1-Math.abs(noise3(x*f,y*f,z*f,seed+i*811));v+=n*n*a;t+=a;a*=.48;f*=2.09;}return v/Math.max(t,1e-6);}
function rotateY(p,a){const c=Math.cos(a),s=Math.sin(a);return v3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);}

function solvePlanes(a,b,c){
  const bc=cross(b.n,c.n),ca=cross(c.n,a.n),ab=cross(a.n,b.n),det=dot(a.n,bc);
  if(Math.abs(det)<1e-8)return null;
  return mul(add(add(mul(bc,a.d),mul(ca,b.d)),mul(ab,c.d)),1/det);
}
function basisFromNormal(n){const axis=Math.abs(n.y)<.86?v3(0,1,0):v3(1,0,0),u=norm(cross(axis,n)),v=norm(cross(n,u));return{u,v};}
function dedupePoints(points,tol){const out=[];for(const p of points){let found=false;for(const q of out){if(len(sub(p,q))<tol){found=true;break;}}if(!found)out.push(p);}return out;}
function convexPolyhedron(planes,scale=1){
  const tol=1e-5*Math.max(1,scale),raw=[];
  for(let i=0;i<planes.length-2;i++)for(let j=i+1;j<planes.length-1;j++)for(let k=j+1;k<planes.length;k++){
    const p=solvePlanes(planes[i],planes[j],planes[k]);if(!p)continue;
    let inside=true;for(const pl of planes){if(dot(pl.n,p)-pl.d>tol*18){inside=false;break;}}if(inside)raw.push(p);
  }
  const vertices=dedupePoints(raw,tol*16),faces=[];
  for(let pi=0;pi<planes.length;pi++){
    const pl=planes[pi],pts=vertices.filter(p=>Math.abs(dot(pl.n,p)-pl.d)<tol*48);
    if(pts.length<3)continue;
    const center=mul(pts.reduce((a,p)=>add(a,p),v3()),1/pts.length),{u,v}=basisFromNormal(pl.n);
    pts.sort((a,b)=>Math.atan2(dot(sub(a,center),v),dot(sub(a,center),u))-Math.atan2(dot(sub(b,center),v),dot(sub(b,center),u)));
    const clean=[];for(const p of pts){if(!clean.length||len(sub(clean[clean.length-1],p))>tol*8)clean.push(p);}if(clean.length<3)continue;
    const check=cross(sub(clean[1],clean[0]),sub(clean[2],clean[0]));if(dot(check,pl.n)<0)clean.reverse();
    faces.push({poly:clean,n:pl.n,kind:pl.kind??2,id:pi,rand:pl.rand??hashInt(pi,planes.length,0,417)});
  }
  return{vertices,faces};
}

function pointSegmentDistance2D(px,py,ax,ay,bx,by){const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,t=clamp((wx*vx+wy*vy)/Math.max(vx*vx+vy*vy,1e-9),0,1),dx=px-(ax+t*vx),dy=py-(ay+t*vy);return Math.hypot(dx,dy);}
function polygonEdgeDistance2D(p,poly){let d=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];d=Math.min(d,pointSegmentDistance2D(p.x,p.y,a.x,a.y,b.x,b.y));}return d;}

class MeshBuilder{
  constructor(){this.positions=[];this.normals=[];this.surface=[];this.indices=[];}
  addVertex(p,n,s){this.positions.push(p.x,p.y,p.z);this.normals.push(n.x,n.y,n.z);this.surface.push(s[0],s[1],s[2],s[3]);return this.positions.length/3-1;}
  tri(a,b,c){this.indices.push(a,b,c);}
  append(other){const off=this.positions.length/3;this.positions.push(...other.positions);this.normals.push(...other.normals);this.surface.push(...other.surface);for(const i of other.indices)this.indices.push(i+off);}
  finish(meta={}){return{positions:new Float32Array(this.positions),normals:new Float32Array(this.normals),surface:new Float32Array(this.surface),indices:new Uint32Array(this.indices),triangles:this.indices.length/3,vertices:this.positions.length/3,...meta};}
}

function faceRelief(family,kind,p,seed,controls,scale,faceRand){
  const q=rotateY(p,faceRand*6.283+seed*.000017),rel=controls.relief;
  const macro=fbm3(q.x*.55/scale,q.y*.55/scale,q.z*.55/scale,seed+101,4);
  const meso=fbm3(q.x*1.85/scale,q.y*1.55/scale,q.z*1.85/scale,seed+211,3);
  const ridge=ridged3(q.x*2.45/scale,q.y*1.90/scale,q.z*2.45/scale,seed+307,3)-.56;
  let amp=.0085,detail=macro*.75+meso*.25;
  if(family===0){amp=kind===1?.0065:kind>=3?.018:.0105;detail=macro*.70+meso*.22+ridge*.08;}
  else if(family===1){amp=kind===1?.017:kind>=3?.026:.020;detail=macro*.66+meso*.20+ridge*.14;}
  else{amp=kind===1?.007:kind>=3?.019:.013;detail=macro*.72+meso*.18+ridge*.10;}
  return detail*amp*scale*rel;
}

function appendConvexFace(builder,face,family,seed,controls,quality,scale){
  const poly=face.poly,n=face.n,{u,v}=basisFromNormal(n),center=mul(poly.reduce((a,p)=>add(a,p),v3()),1/poly.length),poly2=poly.map(p=>{const d=sub(p,center);return{x:dot(d,u),y:dot(d,v)};});
  const edgeWidth=mix(.055,.095,controls.edge)*scale,baseSub=Math.max(3,Math.round(mix(4,9,quality)));
  function displaced(base){
    const d=sub(base,center),uv={x:dot(d,u),y:dot(d,v)},edgeDist=polygonEdgeDistance2D(uv,poly2),fade=smoothstep(0,edgeWidth,edgeDist),h=faceRelief(family,face.kind,base,seed+face.id*131,controls,scale,face.rand)*fade;
    return{p:add(base,mul(n,h)),h,fade,uv};
  }
  function normalAt(base){
    const e=.0105*scale,a=displaced(base),pu=displaced(add(base,mul(u,e))),pv=displaced(add(base,mul(v,e))),tu=sub(pu.p,a.p),tv=sub(pv.p,a.p),nn=norm(cross(tu,tv));return dot(nn,n)<0?mul(nn,-1):nn;
  }
  for(let k=0;k<poly.length;k++){
    const A=center,B=poly[k],C=poly[(k+1)%poly.length],area=.5*len(cross(sub(B,A),sub(C,A))),subdiv=Math.max(2,Math.round(baseSub*clamp(Math.sqrt(area)/(1.05*scale),.58,1.22))),rows=[],local=[];
    for(let i=0;i<=subdiv;i++){
      rows[i]=[];
      for(let j=0;j<=subdiv-i;j++){
        const wb=i/subdiv,wc=j/subdiv,wa=1-wb-wc,base=v3(A.x*wa+B.x*wb+C.x*wc,A.y*wa+B.y*wb+C.y*wc,A.z*wa+B.z*wb+C.z*wc),d=displaced(base),nn=normalAt(base),edge=1-d.fade,event=clamp(.5+.5*ridged3(base.x*1.7/scale,base.y*1.5/scale,base.z*1.7/scale,seed+face.id*71,3),0,1);
        rows[i][j]=builder.addVertex(d.p,nn,[face.kind,face.rand,edge,event]);
      }
    }
    for(let i=0;i<subdiv;i++)for(let j=0;j<subdiv-i;j++){
      const a=rows[i][j],b=rows[i+1][j],c=rows[i][j+1];builder.tri(a,b,c);
      if(j<subdiv-i-1){const d=rows[i+1][j+1];builder.tri(b,d,c);}
    }
  }
}

function buildConvexStone(planes,family,seed,controls,quality,scale,meta={}){
  const hull=convexPolyhedron(planes,scale),builder=new MeshBuilder();
  for(const face of hull.faces)appendConvexFace(builder,face,family,seed,controls,quality,scale);
  const data=builder.finish({meta:{...meta,planeCount:planes.length,faceCount:hull.faces.length},seed,family,controls,bounds:meta.bounds});
  shiftBottom(data.positions);return data;
}

function plane(n,d,kind,rand){return{n:norm(n),d,kind,rand};}
function createAshlarMesh(seed,controls,quality=1,scale=1){
  const R=new RNG(seed^0x61c88647),hx=mix(1.42,1.54,controls.form)*scale,hy=mix(.39,.47,controls.form)*scale,hz=mix(.87,.99,controls.form)*scale,c=v3(R.range(-.025,.025)*scale,hy,R.range(-.018,.018)*scale),planes=[];
  const topN=norm(v3(R.range(-.025,.025)*controls.form,1,R.range(-.030,.030)*controls.form)),bottomN=v3(0,-1,0);
  planes.push(plane(topN,dot(topN,v3(c.x,2*hy,c.z)),1,R.next()),plane(bottomN,0,0,R.next()));
  const sideTilt=.035*controls.form;
  planes.push(plane(v3(1,R.range(-sideTilt,sideTilt),R.range(-.016,.016)),hx+c.x+R.range(-.018,.018)*scale,2,R.next()));
  planes.push(plane(v3(-1,R.range(-sideTilt,sideTilt),R.range(-.016,.016)),hx-c.x+R.range(-.018,.018)*scale,2,R.next()));
  planes.push(plane(v3(R.range(-.016,.016),R.range(-sideTilt,sideTilt),1),hz+c.z+R.range(-.015,.015)*scale,2,R.next()));
  planes.push(plane(v3(R.range(-.016,.016),R.range(-sideTilt,sideTilt),-1),hz-c.z+R.range(-.015,.015)*scale,2,R.next()));
  const corners=[];for(const sx of[-1,1])for(const sy of[0,1])for(const sz of[-1,1])corners.push({sx,sy,sz});
  const chipCount=2+Math.round(controls.fracture*3.2);
  for(let i=0;i<chipCount&&corners.length;i++){
    const ci=R.int(0,corners.length-1),co=corners.splice(ci,1)[0],sy=co.sy?1:-1,corner=v3(co.sx*hx,co.sy?2*hy:0,co.sz*hz),n=norm(v3(co.sx*R.range(.72,1.25),sy*R.range(.30,.82),co.sz*R.range(.72,1.25))),depth=R.range(.055,.145)*scale*(.55+.65*controls.fracture);planes.push(plane(n,dot(n,corner)-depth,3,R.next()));
  }
  if(controls.fracture>.28){const sx=R.sign(),sz=R.sign(),n=norm(v3(sx*R.range(.75,1),R.range(.05,.24),sz*R.range(.10,.38))),p=v3(sx*hx,R.range(.40,1.62)*hy,sz*hz*R.range(.35,.92));planes.push(plane(n,dot(n,p)-R.range(.025,.075)*scale,4,R.next()));}
  return buildConvexStone(planes,0,seed,controls,quality,scale,{bounds:v3(hx+.18*scale,2*hy+.16*scale,hz+.18*scale),grammar:'ashlar'});
}

function createRubbleMesh(seed,controls,quality=1,scale=1){
  const R=new RNG(seed^0x9e3779b9),h=mix(1.02,1.34,controls.form)*scale,hx=mix(1.18,1.52,controls.form)*scale,hz=mix(.88,1.17,controls.form)*scale,c=v3(R.range(-.14,.14)*scale,0,R.range(-.12,.12)*scale),planes=[];
  planes.push(plane(v3(0,-1,0),0,0,R.next()));
  const topTilt=norm(v3(R.range(-.12,.12)*controls.form,1,R.range(-.13,.13)*controls.form)),topP=v3(c.x+R.range(-.06,.06)*scale,h,c.z+R.range(-.06,.06)*scale);planes.push(plane(topTilt,dot(topTilt,topP),1,R.next()));
  const topCutCount=2+Math.round(controls.form),topOffset=R.range(0,Math.PI*2);
  for(let i=0;i<topCutCount;i++){
    const a=topOffset+i*Math.PI*2/topCutCount+R.range(-.25,.25),slope=R.range(.34,.62)*(.60+.55*controls.form),n=norm(v3(Math.cos(a)*slope,1,Math.sin(a)*slope)),p=v3(c.x+Math.cos(a)*hx*R.range(.32,.55),h*R.range(.91,1.02),c.z+Math.sin(a)*hz*R.range(.32,.55));
    planes.push(plane(n,dot(n,p),4,R.next()));
  }
  const sideCount=7+Math.round(controls.form*3),offset=R.range(0,Math.PI*2);
  for(let i=0;i<sideCount;i++){
    const a=offset+i*Math.PI*2/sideCount+R.range(-.105,.105),support=1/Math.sqrt(Math.cos(a)**2/(hx*hx)+Math.sin(a)**2/(hz*hz)),rad=support*R.range(.80,1.09),ny=R.range(-.27,.31)*controls.form,n=norm(v3(Math.cos(a),ny,Math.sin(a))),p=v3(c.x+Math.cos(a)*rad,h*R.range(.30,.72),c.z+Math.sin(a)*rad);
    planes.push(plane(n,dot(n,p),2,R.next()));
  }
  const cutCount=3+Math.round(controls.fracture*3.2);
  for(let i=0;i<cutCount;i++){
    const a=offset+R.range(0,Math.PI*2),support=1/Math.sqrt(Math.cos(a)**2/(hx*hx)+Math.sin(a)**2/(hz*hz)),up=i===0?R.range(.10,.38):R.range(-.36,.58),n=norm(v3(Math.cos(a)*R.range(.72,1.18),up,Math.sin(a)*R.range(.72,1.18))),p=v3(c.x+Math.cos(a)*support*R.range(.62,.89),h*R.range(.28,.88),c.z+Math.sin(a)*support*R.range(.62,.89));
    planes.push(plane(n,dot(n,p)-R.range(.015,.060)*scale,i===0?4:3,R.next()));
  }
  if(controls.fracture>.48){const a=offset+R.range(0,Math.PI*2),n=norm(v3(Math.cos(a)*.72,R.range(.55,.86),Math.sin(a)*.72)),p=v3(c.x+Math.cos(a)*hx*.26,h*R.range(.70,.92),c.z+Math.sin(a)*hz*.26);planes.push(plane(n,dot(n,p),4,R.next()));}
  return buildConvexStone(planes,1,seed,controls,quality,scale,{bounds:v3(hx+.26*scale,h+.22*scale,hz+.26*scale),grammar:'rubble'});
}

function radialFootprint(seed,count,hx,hz,form){
  const R=new RNG(seed),pts=[],phase=R.range(0,Math.PI*2),phase2=R.range(0,Math.PI*2),offset=R.range(0,Math.PI*2),notches=[];
  const notchCount=2+Math.round(form*2.2);for(let i=0;i<notchCount;i++)notches.push({c:R.range(0,count),w:R.range(.32,.78),d:R.range(.070,.205)*(.58+.58*form)});
  for(let i=0;i<count;i++){
    const base=offset+i*Math.PI*2/count,a=base+R.range(-.070,.070)*(.72+form),ell=1/Math.sqrt(Math.cos(a)**2/(hx*hx)+Math.sin(a)**2/(hz*hz));
    let r=ell*(.96+.095*Math.sin(base*2+phase)+.070*Math.sin(base*3+phase2)+R.range(-.080,.075)*form);
    for(const n of notches){let d=Math.abs(i-n.c);d=Math.min(d,count-d);r*=1-n.d*Math.exp(-(d*d)/(2*n.w*n.w));}
    pts.push({x:Math.cos(a)*r,z:Math.sin(a)*r});
  }
  return pts;
}
function footprintCenter(poly){return{ x:poly.reduce((s,p)=>s+p.x,0)/poly.length, z:poly.reduce((s,p)=>s+p.z,0)/poly.length};}
function edgeDistanceXZ(x,z,poly){let d=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];d=Math.min(d,pointSegmentDistance2D(x,z,a.x,a.z,b.x,b.z));}return d;}
function appendFlagFace(builder,poly,top,seed,controls,quality,scale,kind){
  const c2=footprintCenter(poly),A=v3(c2.x,top(c2.x,c2.z),c2.z),subdiv=Math.max(4,Math.round(mix(5,11,quality))),normalSign=kind===1?1:-1;
  function evalP(x,z){return v3(x,top(x,z),z);}
  function normalAt(x,z){const e=.008*scale,p=evalP(x,z),px=evalP(x+e,z),pz=evalP(x,z+e),n=norm(cross(sub(pz,p),sub(px,p)));return normalSign>0?n:mul(n,-1);}
  for(let k=0;k<poly.length;k++){
    const B=evalP(poly[k].x,poly[k].z),C=evalP(poly[(k+1)%poly.length].x,poly[(k+1)%poly.length].z),rows=[];
    for(let i=0;i<=subdiv;i++){rows[i]=[];for(let j=0;j<=subdiv-i;j++){
      const wb=i/subdiv,wc=j/subdiv,wa=1-wb-wc,x=A.x*wa+B.x*wb+C.x*wc,z=A.z*wa+B.z*wb+C.z*wc,p=evalP(x,z),edge=1-smoothstep(0,.075*scale,edgeDistanceXZ(x,z,poly)),ev=clamp(.5+.5*fbm3(x*.9/scale,p.y*.6/scale,z*.9/scale,seed+kind*97,3),0,1);rows[i][j]=builder.addVertex(p,normalAt(x,z),[kind,(k+.5)/poly.length,edge,ev]);
    }}
    for(let i=0;i<subdiv;i++)for(let j=0;j<subdiv-i;j++){const a=rows[i][j],b=rows[i+1][j],c=rows[i][j+1];if(kind===1)builder.tri(a,c,b);else builder.tri(a,b,c);if(j<subdiv-i-1){const d=rows[i+1][j+1];if(kind===1)builder.tri(b,c,d);else builder.tri(b,d,c);}}
  }
}
function circularDistance(a,b,n){let d=Math.abs(a-b);return Math.min(d,n-d);}
function createFlagstoneMesh(seed,controls,quality=1,scale=1){
  const R=new RNG(seed^0x85ebca6b),hx=mix(1.44,1.78,controls.form)*scale,hz=mix(.84,1.09,controls.form)*scale,h=mix(.27,.43,controls.form)*scale,count=11+Math.round(controls.form*4),polyTop=radialFootprint(seed+47,count,hx,hz,controls.form),bottomShift=v3(R.range(-.035,.035)*scale,0,R.range(-.028,.028)*scale),polyBottom=polyTop.map((p,i)=>{const f=R.range(.91,1.015)-(.035+.030*controls.edge)*Math.max(0,Math.sin((i/count)*Math.PI*2+R.range(-.5,.5)));return{x:p.x*f+bottomShift.x,z:p.z*f+bottomShift.z};}),slopeX=R.range(-.035,.035)*controls.form,slopeZ=R.range(-.032,.032)*controls.form;
  const top=(x,z)=>h+slopeX*x+slopeZ*z+fbm3(x*.46/scale,z*.46/scale,1.7,seed+421,3)*.022*scale*controls.relief;
  const bottom=(x,z)=>fbm3(x*.60/scale,z*.60/scale,3.9,seed+457,2)*.006*scale*controls.relief;
  const layers=[];for(let i=0;i<1+Math.round(controls.fracture*1.6);i++)layers.push({edge:R.range(0,count),span:R.range(.32,.82),y:R.range(.25,.74),width:R.range(.032,.065),amp:R.range(.018,.052)*scale*(.55+.80*controls.fracture),sign:R.next()<.30?1:-1});
  const builder=new MeshBuilder();appendFlagFace(builder,polyTop,top,seed,controls,quality,scale,1);appendFlagFace(builder,polyBottom,bottom,seed+17,controls,quality,scale,0);
  const segV=Math.max(4,Math.round(mix(5,10,quality)));
  for(let ei=0;ei<count;ei++){
    const at=polyTop[ei],bt=polyTop[(ei+1)%count],ab=polyBottom[ei],bb=polyBottom[(ei+1)%count],dx=bt.x-at.x,dz=bt.z-at.z,L=Math.hypot(dx,dz),out=norm(v3(dz,0,-dx)),segU=Math.max(2,Math.round(L/(.13*scale)*mix(.68,1.18,quality))),rows=[];
    const posAt=(u,v)=>{const xt=mix(at.x,bt.x,u),zt=mix(at.z,bt.z,u),xb=mix(ab.x,bb.x,u),zb=mix(ab.z,bb.z,u),yb=bottom(xb,zb),yt=top(xt,zt),x=mix(xb,xt,v),z=mix(zb,zt,v),edgeCoord=ei+u;let offset=fbm3(x*1.34/scale,(yb+(yt-yb)*v)*2.2/scale,z*1.34/scale,seed+589,3)*.008*scale*controls.relief,event=0;
      for(const lay of layers){const dg=circularDistance(edgeCoord,lay.edge,count),gE=Math.exp(-(dg*dg)/(2*lay.span*lay.span)),gY=Math.exp(-((v-lay.y)*(v-lay.y))/(2*lay.width*lay.width)),g=gE*gY;offset+=lay.amp*lay.sign*g;event=Math.max(event,g);}
      const jag=(ridged3(x*3.8/scale,v*2.4,z*3.8/scale,seed+641,3)-.52)*.010*scale*controls.fracture;offset+=jag*(.30+.70*event);return{p:v3(x+out.x*offset,mix(yb,yt,v),z+out.z*offset),event};};
    for(let iu=0;iu<=segU;iu++){rows[iu]=[];for(let iv=0;iv<=segV;iv++){
      const u=iu/segU,v=iv/segV,q=posAt(u,v),e=.004,qu=posAt(clamp(u+e,0,1),v),qv=posAt(u,clamp(v+e,0,1)),n=norm(cross(sub(qv.p,q.p),sub(qu.p,q.p)));if(dot(n,out)<0)n=mul(n,-1);const edge=Math.max(1-smoothstep(0,.10,v),smoothstep(.90,1,v));rows[iu][iv]=builder.addVertex(q.p,n,[2,(ei+.5)/count,edge,q.event]);
    }}
    for(let iu=0;iu<segU;iu++)for(let iv=0;iv<segV;iv++){const p00=rows[iu][iv],p10=rows[iu+1][iv],p01=rows[iu][iv+1],p11=rows[iu+1][iv+1];builder.tri(p00,p01,p10);builder.tri(p10,p01,p11);}
  }
  const flakes=layers.filter(l=>l.sign>0).slice(0,1);
  for(let fi=0;fi<flakes.length;fi++){
    const lay=flakes[fi],ei=Math.floor(lay.edge)%count,at=polyTop[ei],bt=polyTop[(ei+1)%count],ab=polyBottom[ei],bb=polyBottom[(ei+1)%count],dx=bt.x-at.x,dz=bt.z-at.z,out=norm(v3(dz,0,-dx)),u0=.24,u1=.70,v0=clamp(lay.y-.028,.14,.80),v1=clamp(lay.y+.032,.18,.86),th=.014*scale,off=lay.amp*.72;
    const point=(u,v,o,yoff=0)=>{const xt=mix(at.x,bt.x,u),zt=mix(at.z,bt.z,u),xb=mix(ab.x,bb.x,u),zb=mix(ab.z,bb.z,u),x=mix(xb,xt,v),z=mix(zb,zt,v),y=mix(bottom(xb,zb),top(xt,zt),v)+yoff;return v3(x+out.x*o,y,z+out.z*o);};
    const fp=[point(u0,v0,off),point(u1,v0,off),point(u1,v1,off+th,.008*scale),point(u0,v1,off+th,.008*scale),point(u0,v0,off+th),point(u1,v0,off+th)],faces=[[0,1,2,3],[4,5,1,0],[3,2,5,4],[0,3,4],[1,5,2]];
    for(const ids of faces){const nn=norm(cross(sub(fp[ids[1]],fp[ids[0]]),sub(fp[ids[2]],fp[ids[0]]))),base=builder.positions.length/3;for(const id of ids)builder.addVertex(fp[id],nn,[4,(ei+.5)/count,0,1]);if(ids.length===4){builder.tri(base,base+1,base+2);builder.tri(base,base+2,base+3);}else builder.tri(base,base+1,base+2);}
  }
  const data=builder.finish({seed,family:2,controls,bounds:v3(hx+.30*scale,h+.22*scale,hz+.30*scale),meta:{grammar:'flagstone',layers:layers.length,flakes:flakes.length}});shiftBottom(data.positions);return data;
}

function icosphere(subdiv){
  const t=(1+Math.sqrt(5))/2,verts=[v3(-1,t,0),v3(1,t,0),v3(-1,-t,0),v3(1,-t,0),v3(0,-1,t),v3(0,1,t),v3(0,-1,-t),v3(0,1,-t),v3(t,0,-1),v3(t,0,1),v3(-t,0,-1),v3(-t,0,1)].map(norm);
  let faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for(let s=0;s<subdiv;s++){const cache=new Map(),mid=(a,b)=>{const k=a<b?a+','+b:b+','+a;if(cache.has(k))return cache.get(k);const i=verts.push(norm(add(verts[a],verts[b])))-1;cache.set(k,i);return i;},next=[];for(const[a,b,c]of faces){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}faces=next;}
  return{verts,faces};
}
function calcIndexedNormals(pos,idx){const n=new Float32Array(pos.length);for(let i=0;i<idx.length;i+=3){const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3,a=v3(pos[ia],pos[ia+1],pos[ia+2]),b=v3(pos[ib],pos[ib+1],pos[ib+2]),c=v3(pos[ic],pos[ic+1],pos[ic+2]),fn=cross(sub(b,a),sub(c,a));for(const j of[ia,ib,ic]){n[j]+=fn.x;n[j+1]+=fn.y;n[j+2]+=fn.z;}}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
function createCobbleMesh(seed,controls,quality=1,scale=1){
  const R=new RNG(seed^0xc2b2ae35),subdiv=quality>.78?5:quality>.48?4:3,base=icosphere(subdiv),rx=R.range(1.08,1.40)*scale,ry=R.range(.76,.98)*scale,rz=R.range(.82,1.14)*scale,yaw=R.range(-.30,.30),lobeDirs=[],lobeAmp=[],impactDirs=[],facets=[];
  for(let i=0;i<3;i++){lobeDirs.push(norm(v3(R.range(-1,1),R.range(-.75,.85),R.range(-1,1))));lobeAmp.push(R.range(-.050,.082));}
  for(let i=0;i<1+Math.round(controls.fracture*1.6);i++)impactDirs.push({d:norm(v3(R.range(-1,1),R.range(-.42,.42),R.range(-1,1))),depth:R.range(.010,.030)*scale*(.55+controls.fracture),width:R.range(.038,.080)});
  const facetCount=controls.edge>.74?1:0;for(let i=0;i<facetCount;i++){const n=norm(v3(R.range(-1,1),R.range(-.45,.15),R.range(-1,1)));facets.push({n,d:R.range(.968,.986),soft:R.range(.012,.026),id:R.next()});}
  const positions=new Float32Array(base.verts.length*3),surface=new Float32Array(base.verts.length*4),skewX=R.range(.045,.125)*controls.form,skewZ=R.range(-.070,.070)*controls.form,centerX=R.range(-.08,.08)*scale,centerZ=R.range(-.07,.07)*scale;
  for(let i=0;i<base.verts.length;i++){
    const d=base.verts[i],macro=fbm3(d.x*.90,d.y*.90,d.z*.90,seed+701,4),meso=fbm3(d.x*2.6,d.y*2.6,d.z*2.6,seed+743,3);let lobe=0;for(let k=0;k<lobeDirs.length;k++)lobe+=lobeAmp[k]*Math.pow(Math.max(0,dot(d,lobeDirs[k])),2.2);const rad=1+lobe+macro*.040*controls.form+meso*.007*controls.relief;
    let p=v3(d.x*rx*rad+centerX,d.y*ry*rad,d.z*rz*rad+centerZ),impact=0,facetMask=0;
    p=v3(p.x+p.y*skewX+p.z*p.z*.010/scale,p.y,p.z+p.x*p.y*skewZ/scale);
    for(const imp of impactDirs){const a=1-dot(d,imp.d),g=Math.exp(-(a*a)/(2*imp.width*imp.width));p=mul(p,1-imp.depth/Math.max(rx,ry,rz)*g);impact=Math.max(impact,g);}
    for(const f of facets){const support=Math.sqrt((f.n.x*rx)**2+(f.n.y*ry)**2+(f.n.z*rz)**2),limit=support*f.d,ex=dot(f.n,p)-limit;if(ex>0){const w=smoothstep(0,f.soft*scale,ex);p=sub(p,mul(f.n,ex*(.70+.22*w)));facetMask=Math.max(facetMask,w);}}
    p=rotateY(p,yaw);positions[i*3]=p.x;positions[i*3+1]=p.y+ry*.96;positions[i*3+2]=p.z;surface.set([5,.5+.5*macro,facetMask,impact],i*4);
  }
  let minY=Infinity;for(let i=1;i<positions.length;i+=3)minY=Math.min(minY,positions[i]);const band=.12*scale;for(let i=1;i<positions.length;i+=3){const y=positions[i],d=y-minY;if(d<band){const t=smoothstep(0,band,d);positions[i]=minY+d*(.34+.66*t);surface[(i-1)/3*4+2]=Math.max(surface[(i-1)/3*4+2],1-t);}}
  const indices=new Uint32Array(base.faces.flat()),normals=calcIndexedNormals(positions,indices),data={positions,normals,surface,indices,triangles:indices.length/3,vertices:positions.length/3,seed,family:3,controls,bounds:v3(rx+.25*scale,ry*2+.20*scale,rz+.25*scale),meta:{grammar:'cobble',subdiv,impacts:impactDirs.length,facets:facets.length}};shiftBottom(data.positions);return data;
}

function shiftBottom(pos){let minY=Infinity;for(let i=1;i<pos.length;i+=3)minY=Math.min(minY,pos[i]);for(let i=1;i<pos.length;i+=3)pos[i]-=minY;}
function buildMesh(family,seed,controlsInput={},quality=1,scale=1){
  const controls={form:controlsInput.form??.55,fracture:controlsInput.fracture??.42,edge:controlsInput.edge??.35,relief:controlsInput.relief??.45,weather:controlsInput.weather??.4,rough:controlsInput.rough??.8};
  if(family===0)return createAshlarMesh(seed,controls,quality,scale);
  if(family===1)return createRubbleMesh(seed,controls,quality,scale);
  if(family===2)return createFlagstoneMesh(seed,controls,quality,scale);
  return createCobbleMesh(seed,controls,quality,scale);
}

const api={buildMesh,createAshlarMesh,createRubbleMesh,createFlagstoneMesh,createCobbleMesh,convexPolyhedron};
if(typeof module!=='undefined')module.exports=api;
if(typeof window!=='undefined')window.BrickMotherStoneFormGeometryV33=api;
})();
