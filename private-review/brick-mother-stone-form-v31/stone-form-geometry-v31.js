(() => {
'use strict';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const v3=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v3(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>v3(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>v3(a.x*s,a.y*s,a.z*s);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>v3(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const len=a=>Math.hypot(a.x,a.y,a.z);
const norm=a=>{const l=len(a)||1;return mul(a,1/l);};

class RNG{
  constructor(seed){this.s=(Number(seed)>>>0)||1;}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296;}
  range(a,b){return mix(a,b,this.next());}
  int(a,b){return Math.floor(this.range(a,b+1));}
}

function hashInt(x,y,z,seed){let h=(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^Math.imul(seed|0,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;}
function smoother(t){return t*t*t*(t*(t*6-15)+10);}
function noise3(x,y,z,seed){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),tx=smoother(x-xi),ty=smoother(y-yi),tz=smoother(z-zi);
  const h=(dx,dy,dz)=>hashInt(xi+dx,yi+dy,zi+dz,seed);
  const x00=mix(h(0,0,0),h(1,0,0),tx),x10=mix(h(0,1,0),h(1,1,0),tx),x01=mix(h(0,0,1),h(1,0,1),tx),x11=mix(h(0,1,1),h(1,1,1),tx);
  return mix(mix(x00,x10,ty),mix(x01,x11,ty),tz)*2-1;
}
function fbm3(x,y,z,seed,oct=4){let value=0,amp=.55,freq=1,total=0;for(let i=0;i<oct;i++){value+=noise3(x*freq,y*freq,z*freq,seed+i*1009)*amp;total+=amp;amp*=.49;freq*=2.03;}return value/Math.max(total,1e-6);}
function ridged3(x,y,z,seed,oct=4){let value=0,amp=.55,freq=1,total=0;for(let i=0;i<oct;i++){const n=1-Math.abs(noise3(x*freq,y*freq,z*freq,seed+i*811));value+=n*n*amp;total+=amp;amp*=.48;freq*=2.09;}return value/Math.max(total,1e-6);}

function sdRoundBox(p,b,r){const qx=Math.abs(p.x)-b.x+r,qy=Math.abs(p.y)-b.y+r,qz=Math.abs(p.z)-b.z+r;const ox=Math.max(qx,0),oy=Math.max(qy,0),oz=Math.max(qz,0);return Math.hypot(ox,oy,oz)+Math.min(Math.max(qx,Math.max(qy,qz)),0)-r;}
function sdEllipsoid(p,c,r){const q=v3((p.x-c.x)/r.x,(p.y-c.y)/r.y,(p.z-c.z)/r.z);return(len(q)-1)*Math.min(r.x,r.y,r.z);}
function sdCapsule(p,a,b,r){const pa=sub(p,a),ba=sub(b,a),h=clamp(dot(pa,ba)/Math.max(dot(ba,ba),1e-8),0,1);return len(sub(pa,mul(ba,h)))-r;}
function smax(a,b,k){const h=clamp(.5+.5*(a-b)/k,0,1);return mix(b,a,h)+k*h*(1-h);}
function opSubtract(a,b){return Math.max(a,-b);}
function rotateY(p,a){const c=Math.cos(a),s=Math.sin(a);return v3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);}

function createAshlarField(seed,controls,scale=1){
  const R=new RNG(seed^0x2f6e2b1),b=v3(1.48*scale,.40*scale,.93*scale),r=mix(.035,.085,controls.edge)*scale;
  const yaw=R.range(-.018,.018)*controls.form,leanX=R.range(-.018,.018)*controls.form,leanZ=R.range(-.018,.018)*controls.form;
  const chips=[];
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let i=0;i<2+Math.round(controls.fracture*2);i++){
    const c=corners.splice(R.int(0,corners.length-1),1)[0],upper=R.next()<.70;
    chips.push({c:v3(c[0]*(b.x-R.range(.02,.07)*scale),upper?b.y*R.range(.70,1.02):-b.y*R.range(.72,1.02),c[1]*(b.z-R.range(.02,.07)*scale)),r:v3(R.range(.11,.22)*scale,R.range(.07,.15)*scale,R.range(.10,.21)*scale),seed:R.int(1,999999)});
  }
  const sdf=p0=>{
    let p=rotateY(p0,yaw);p=v3(p.x+leanX*p.y,p.y,p.z+leanZ*p.y);
    const wx=fbm3(p.y*.45,p.z*.45,p.x*.18,seed+71,3)*controls.form*.012*scale;
    const wz=fbm3(p.x*.45,p.y*.45,p.z*.18,seed+83,3)*controls.form*.010*scale;
    const q=v3(p.x+wx,p.y,p.z+wz);
    let d=sdRoundBox(q,b,r);
    const side=Math.max(smoothstep(.42,.96,Math.abs(q.x)/b.x),smoothstep(.42,.96,Math.abs(q.z)/b.z));
    const top=smoothstep(.55,.98,Math.abs(q.y)/b.y);
    const broad=fbm3(q.x*.72,q.y*.58,q.z*.72,seed+137,4);
    const chisel=ridged3(q.x*3.6,q.y*3.0,q.z*3.6,seed+199,3)-.58;
    d+=(broad*.016+chisel*.004*side*(1-top))*scale*controls.relief;
    for(const chip of chips){const irr=fbm3(q.x*5.5,q.y*5.5,q.z*5.5,chip.seed,3)*.018*scale*controls.fracture;const rr=v3(Math.max(.02,chip.r.x+irr),Math.max(.02,chip.r.y+irr*.65),Math.max(.02,chip.r.z+irr));d=opSubtract(d,sdEllipsoid(q,chip.c,rr));}
    return d;
  };
  return{family:0,sdf,bounds:v3(b.x+.32*scale,b.y+.28*scale,b.z+.32*scale),meta:{b,chips}};
}

function createRubbleField(seed,controls,scale=1){
  const R=new RNG(seed^0x9e3779b9),h=mix(.70,.88,controls.form)*scale,hx=mix(1.27,1.46,controls.form)*scale,hz=mix(.96,1.12,controls.form)*scale,center=v3(R.range(-.08,.08)*scale,0,R.range(-.07,.07)*scale);
  const planes=[];
  planes.push({n:v3(0,-1,0),d:0,kind:2});
  const topN=norm(v3(R.range(-.10,.12)*controls.form,1,R.range(-.11,.10)*controls.form));planes.push({n:topN,d:dot(topN,v3(center.x,h,center.z)),kind:1});
  const sides=9+Math.round(controls.form*2),offset=R.range(0,Math.PI*2);
  for(let i=0;i<sides;i++){
    const a=offset+i*Math.PI*2/sides+R.range(-.055,.055),ex=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),rad=ex*R.range(.91,1.075),ny=R.range(-.22,.22)*controls.form;
    const n=norm(v3(Math.cos(a),ny,Math.sin(a))),p=v3(center.x+Math.cos(a)*rad,h*R.range(.32,.64),center.z+Math.sin(a)*rad);planes.push({n,d:dot(n,p),kind:3});
  }
  const cuts=[];
  for(let i=0;i<2+Math.round(controls.fracture*3);i++){
    const a=offset+R.range(0,Math.PI*2),rad=R.range(.69,.84)/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),ny=R.range(-.65,.68),n=norm(v3(Math.cos(a),ny,Math.sin(a))),p=v3(center.x+Math.cos(a)*rad,h*R.range(.38,.80),center.z+Math.sin(a)*rad);cuts.push({n,d:dot(n,p),kind:4});
  }
  const sdf=p=>{
    const roundK=mix(.012,.038,controls.edge)*scale;let d=-1e9;for(const pl of planes){const pd=dot(pl.n,p)-pl.d;d=d<-1e8?pd:smax(d,pd,roundK);}for(const pl of cuts){const pd=dot(pl.n,p)-pl.d;d=smax(d,pd,roundK*.46);}
    const sideGate=smoothstep(.25,.95,Math.hypot(p.x-center.x,p.z-center.z)/Math.max(hx,hz));
    const topGate=smoothstep(.35,.95,p.y/Math.max(h,.001));
    const macro=fbm3(p.x*.72,p.y*.62,p.z*.72,seed+271,4);
    const rugged=ridged3(p.x*2.15,p.y*1.85,p.z*2.15,seed+337,3)-.58;
    d+=(macro*.030+rugged*.010*(.35+.65*sideGate))*scale*controls.relief*(.68+.32*topGate);
    return d;
  };
  return{family:1,sdf,bounds:v3(hx+.34*scale,h+.28*scale,hz+.34*scale),meta:{planes,cuts,h,hx,hz}};
}

function createFlagstoneField(seed,controls,scale=1){
  const R=new RNG(seed^0x85ebca6b),h=mix(.21,.30,controls.form)*scale,hx=mix(1.45,1.68,controls.form)*scale,hz=mix(.90,1.10,controls.form)*scale;
  const sides=12+Math.round(controls.form*3),offset=R.range(0,Math.PI*2),planes=[];
  for(let i=0;i<sides;i++){
    const a=offset+i*Math.PI*2/sides+R.range(-.045,.045),ex=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),rad=ex*R.range(.89,1.085),n=v3(Math.cos(a),0,Math.sin(a));planes.push({n,d:rad});
  }
  const notches=[];for(let i=0;i<2+Math.round(controls.fracture*2);i++){const a=offset+R.range(0,Math.PI*2),n=v3(Math.cos(a),0,Math.sin(a)),ex=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),rad=ex*R.range(.70,.86);notches.push({n,d:rad});}
  const slopeX=R.range(-.025,.025)*controls.form,slopeZ=R.range(-.020,.020)*controls.form;
  const shelves=[];
  for(let i=0;i<1+Math.round(controls.fracture);i++){
    const a=R.range(0,Math.PI*2),t=v3(-Math.sin(a),0,Math.cos(a)),n=v3(Math.cos(a),0,Math.sin(a)),c=v3(n.x*hx*R.range(.72,.90),h*R.range(.28,.68),n.z*hz*R.range(.72,.90));
    shelves.push({a:add(c,mul(t,-R.range(.16,.30)*scale)),b:add(c,mul(t,R.range(.16,.30)*scale)),r:R.range(.035,.060)*scale,seed:R.int(1,999999)});
  }
  const sdf=p=>{
    let side=-1e9;for(const pl of planes)side=Math.max(side,dot(pl.n,p)-pl.d);for(const pl of notches)side=Math.max(side,dot(pl.n,p)-pl.d);
    const topY=h+slopeX*p.x+slopeZ*p.z+fbm3(p.x*.55,p.z*.55,1.7,seed+421,3)*.018*scale*controls.form;
    const bottomY=fbm3(p.x*.72,p.z*.72,3.9,seed+457,2)*.004*scale;
    let d=Math.max(side,Math.max(p.y-topY,bottomY-p.y));
    const edgeGate=smoothstep(-.24,.04,side);
    const broad=fbm3(p.x*.84,p.y*1.1,p.z*.84,seed+509,4);
    const grain=ridged3(p.x*3.0,p.y*2.0,p.z*3.0,seed+571,3)-.58;
    d+=(broad*.014+grain*.004*edgeGate)*scale*controls.relief;
    for(const sh of shelves){const irr=fbm3(p.x*6,p.y*6,p.z*6,sh.seed,2)*.008*scale;d=opSubtract(d,sdCapsule(p,sh.a,sh.b,Math.max(.012,sh.r+irr)));}
    return d;
  };
  return{family:2,sdf,bounds:v3(hx+.34*scale,h+.24*scale,hz+.34*scale),meta:{planes,notches,shelves,h,hx,hz}};
}

function createCobbleField(seed,controls,scale=1){
  const R=new RNG(seed^0xc2b2ae35),r=v3(R.range(1.22,1.42)*scale,R.range(.55,.68)*scale,R.range(.86,1.04)*scale),center=v3(R.range(-.04,.04)*scale,r.y*.88,R.range(-.04,.04)*scale),yaw=R.range(-.20,.20),chips=[];
  for(let i=0;i<(controls.fracture>.25?1+Math.round(controls.fracture*1.5):0);i++){
    const n=norm(v3(R.range(-1,1),R.range(-.05,.62),R.range(-1,1))),support=Math.sqrt((n.x*r.x)**2+(n.y*r.y)**2+(n.z*r.z)**2),depth=R.range(.045,.095)*scale*(.55+controls.fracture);chips.push({n,d:dot(n,center)+support-depth,strength:R.range(.82,.98)});
  }
  const sdf=p0=>{
    let p=rotateY(sub(p0,center),yaw);p=v3(p.x+p.y*(.10+.08*controls.form)+p.z*p.z*.020/scale,p.y,p.z+p.x*p.y*.026/scale+p.y*p.y*.018/scale);
    const warp=v3(fbm3(p.y*.72,p.z*.72,p.x*.25,seed+613,3),fbm3(p.x*.72,p.z*.72,p.y*.25,seed+641,3),fbm3(p.x*.72,p.y*.72,p.z*.25,seed+673,3));
    const q=v3(p.x+warp.x*.055*scale*controls.form,p.y+warp.y*.030*scale*controls.form,p.z+warp.z*.048*scale*controls.form);
    let d=sdEllipsoid(q,v3(0,0,0),r);
    const radial=Math.max(Math.abs(q.x)/r.x,Math.abs(q.y)/r.y,Math.abs(q.z)/r.z);
    const broad=fbm3(q.x*.72,q.y*.72,q.z*.72,seed+719,4),fine=fbm3(q.x*2.9,q.y*2.9,q.z*2.9,seed+751,3);
    d+=(broad*.050+fine*.009)*scale*controls.relief*smoothstep(.20,1.10,radial);
    const bottomPlane=-p0.y;d=smax(d,bottomPlane,mix(.035,.075,controls.edge)*scale);
    for(const ch of chips){const pd=dot(ch.n,p0)-ch.d;if(pd>0)d=Math.max(d,pd*ch.strength);}
    return d;
  };
  return{family:3,sdf,bounds:v3(r.x+.30*scale,r.y*1.90+.25*scale,r.z+.30*scale),meta:{r,center,chips}};
}

function createField(family,seed,controls,scale=1){if(family===0)return createAshlarField(seed,controls,scale);if(family===1)return createRubbleField(seed,controls,scale);if(family===2)return createFlagstoneField(seed,controls,scale);return createCobbleField(seed,controls,scale);}

const cubeCorners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const tetraEdges=[[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]];
function gradientSDF(sdf,p,e){const dx=sdf(v3(p.x+e,p.y,p.z))-sdf(v3(p.x-e,p.y,p.z)),dy=sdf(v3(p.x,p.y+e,p.z))-sdf(v3(p.x,p.y-e,p.z)),dz=sdf(v3(p.x,p.y,p.z+e))-sdf(v3(p.x,p.y,p.z-e));return norm(v3(dx,dy,dz));}
function polygonizeTetra(points,values,sdf,epsilon,positions,normals,maxVertices){
  const hits=[];for(const[ia,ib]of tetraEdges){const va=values[ia],vb=values[ib];if((va<0)===(vb<0))continue;const t=clamp(va/(va-vb),0,1);hits.push(add(points[ia],mul(sub(points[ib],points[ia]),t)));}
  if(hits.length!==3&&hits.length!==4)return;
  let ordered=hits;if(hits.length===4){const center=mul(hits.reduce((a,p)=>add(a,p),v3()),.25),gn=gradientSDF(sdf,center,epsilon),axis=Math.abs(gn.y)<.85?v3(0,1,0):v3(1,0,0),u=norm(cross(axis,gn)),v=norm(cross(gn,u));ordered=hits.slice().sort((a,b)=>{const da=sub(a,center),db=sub(b,center);return Math.atan2(dot(da,v),dot(da,u))-Math.atan2(dot(db,v),dot(db,u));});}
  const tris=hits.length===3?[[ordered[0],ordered[1],ordered[2]]]:[[ordered[0],ordered[1],ordered[2]],[ordered[0],ordered[2],ordered[3]]];
  for(let tri of tris){if(positions.length/3+3>maxVertices)return;const ns=tri.map(p=>gradientSDF(sdf,p,epsilon)),face=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])),avg=norm(add(add(ns[0],ns[1]),ns[2]));if(dot(face,avg)<0){tri=[tri[0],tri[2],tri[1]];[ns[1],ns[2]]=[ns[2],ns[1]];}for(let i=0;i<3;i++){positions.push(tri[i].x,tri[i].y,tri[i].z);normals.push(ns[i].x,ns[i].y,ns[i].z);}}
}
function buildMesh(family,seed,controlsInput={},quality=1,scale=1){
  const controls={form:controlsInput.form??.55,fracture:controlsInput.fracture??.42,edge:controlsInput.edge??.35,relief:controlsInput.relief??.45,weather:controlsInput.weather??.4,rough:controlsInput.rough??.8};
  const field=createField(family,seed,controls,scale),b=field.bounds,size=v3(b.x*2,b.y*2,b.z*2),longest=Math.max(size.x,size.y,size.z),target=Math.max(24,Math.round(58*quality)),nx=Math.max(18,Math.round(target*size.x/longest)),ny=Math.max(14,Math.round(target*size.y/longest)),nz=Math.max(18,Math.round(target*size.z/longest)),min=v3(-b.x,-.18*scale,-b.z),step=v3(size.x/(nx-1),size.y/(ny-1),size.z/(nz-1)),grid=new Float32Array(nx*ny*nz),gi=(x,y,z)=>x+nx*(y+ny*z);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)grid[gi(x,y,z)]=field.sdf(v3(min.x+x*step.x,min.y+y*step.y,min.z+z*step.z));
  const positions=[],normals=[],cp=new Array(8),cv=new Array(8),epsilon=Math.min(step.x,step.y,step.z)*.34,maxVertices=450000;
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
    let allIn=true,allOut=true;for(let c=0;c<8;c++){const o=cubeCorners[c],gx=x+o[0],gy=y+o[1],gz=z+o[2];cp[c]=v3(min.x+gx*step.x,min.y+gy*step.y,min.z+gz*step.z);cv[c]=grid[gi(gx,gy,gz)];if(cv[c]<0)allOut=false;else allIn=false;}if(allIn||allOut)continue;
    for(const tet of tetrahedra){polygonizeTetra(tet.map(i=>cp[i]),tet.map(i=>cv[i]),field.sdf,epsilon,positions,normals,maxVertices);if(positions.length/3>=maxVertices)break;}
  }
  let minY=Infinity;for(let i=1;i<positions.length;i+=3)minY=Math.min(minY,positions[i]);for(let i=1;i<positions.length;i+=3)positions[i]-=minY;
  return{positions:new Float32Array(positions),normals:new Float32Array(normals),triangles:positions.length/9,vertices:positions.length/3,bounds:field.bounds,meta:field.meta,controls,seed,family};
}

if(typeof module!=='undefined')module.exports={buildMesh,createField,createAshlarField,createRubbleField,createFlagstoneField,createCobbleField};
if(typeof window!=='undefined')window.BrickMotherStoneFormGeometryV31={buildMesh,createField};

})();
