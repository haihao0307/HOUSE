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
  pick(arr){return arr[Math.floor(this.next()*arr.length)%arr.length];}
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
function sdEllipsoidY(p,c,r,a){const q=rotateY(sub(p,c),-a);return sdEllipsoid(q,v3(0,0,0),r);}
function sdCapsule(p,a,b,r){const pa=sub(p,a),ba=sub(b,a),h=clamp(dot(pa,ba)/Math.max(dot(ba,ba),1e-8),0,1);return len(sub(pa,mul(ba,h)))-r;}
function smax(a,b,k){const h=clamp(.5+.5*(a-b)/k,0,1);return mix(b,a,h)+k*h*(1-h);}
function smin(a,b,k){return -smax(-a,-b,k);}
function opSubtract(a,b){return Math.max(a,-b);}
function rotateY(p,a){const c=Math.cos(a),s=Math.sin(a);return v3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);}


function createFiredClayField(seed,controls,scale=1){
  const R=new RNG(seed^0x51ed270b),b=v3(1.50*scale,.42*scale,.79*scale),r=mix(.050,.105,controls.edge)*scale;
  const yaw=R.range(-.025,.025)*controls.form,leanX=R.range(-.020,.020)*controls.form,leanZ=R.range(-.016,.016)*controls.form;
  const chips=[],cavities=[],cracks=[];
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let i=0;i<1+Math.round(controls.fracture*2);i++){
    const c=corners.splice(R.int(0,corners.length-1),1)[0],upper=R.next()<.72;
    chips.push({c:v3(c[0]*(b.x-R.range(.015,.055)*scale),upper?b.y*R.range(.72,1.01):-b.y*R.range(.72,1.01),c[1]*(b.z-R.range(.015,.055)*scale)),r:v3(R.range(.075,.155)*scale,R.range(.050,.110)*scale,R.range(.065,.135)*scale),seed:R.int(1,999999)});
  }
  for(let i=0;i<2+Math.round(controls.fracture*2);i++){
    const side=R.pick([0,1,2,3]),u=R.range(-.78,.78),v=R.range(-.62,.72);
    let c;
    if(side===0)c=v3(b.x*.992,v*b.y,u*b.z);else if(side===1)c=v3(-b.x*.992,v*b.y,u*b.z);else if(side===2)c=v3(u*b.x,v*b.y,b.z*.992);else c=v3(u*b.x,v*b.y,-b.z*.992);
    cavities.push({c,r:v3(R.range(.035,.080)*scale,R.range(.030,.070)*scale,R.range(.035,.080)*scale),seed:R.int(1,999999)});
  }
  for(let i=0;i<1+Math.round(controls.fracture);i++){
    const z=R.pick([-1,1])*b.z*.986,y=R.range(-.18,.22)*b.y,x0=R.range(-.72,-.15)*b.x,x1=R.range(.10,.72)*b.x;
    cracks.push({a:v3(x0,y,z),b:v3(x1,y+R.range(-.08,.08)*scale,z),r:R.range(.012,.025)*scale,seed:R.int(1,999999)});
  }
  const sdf=p0=>{
    let p=rotateY(p0,yaw);p=v3(p.x+leanX*p.y,p.y,p.z+leanZ*p.y);
    const sideWarp=fbm3(p.y*.55,p.z*.48,p.x*.16,seed+47,3)*controls.form*.016*scale;
    const topWarp=fbm3(p.x*.42,p.z*.42,p.y*.18,seed+61,3)*controls.form*.014*scale;
    const q=v3(p.x+sideWarp,p.y+topWarp,p.z+fbm3(p.x*.47,p.y*.53,p.z*.17,seed+79,3)*controls.form*.012*scale);
    let d=sdRoundBox(q,b,r);
    const side=Math.max(smoothstep(.45,.96,Math.abs(q.x)/b.x),smoothstep(.45,.96,Math.abs(q.z)/b.z));
    const macro=fbm3(q.x*.72,q.y*.60,q.z*.72,seed+101,4),fired=ridged3(q.x*2.45,q.y*2.0,q.z*2.45,seed+151,3)-.62;
    d+=(macro*.014+fired*.0046*side)*scale*controls.relief;
    for(const chip of chips){const irr=fbm3(q.x*5.0,q.y*5.0,q.z*5.0,chip.seed,2)*.009*scale;d=opSubtract(d,sdEllipsoid(q,chip.c,v3(chip.r.x+irr,chip.r.y+irr*.7,chip.r.z+irr)));}
    for(const pit of cavities){const irr=fbm3(q.x*7.0,q.y*7.0,q.z*7.0,pit.seed,2)*.006*scale;d=opSubtract(d,sdEllipsoid(q,pit.c,v3(pit.r.x+irr,pit.r.y+irr,pit.r.z+irr)));}
    for(const c of cracks){const irr=fbm3(q.x*8.0,q.y*8.0,q.z*8.0,c.seed,2)*.004*scale;d=opSubtract(d,sdCapsule(q,c.a,c.b,Math.max(.008,c.r+irr)));}
    return d;
  };
  return{family:0,sdf,bounds:v3(b.x+.30*scale,b.y+.28*scale,b.z+.30*scale),meta:{b,chips,cavities,cracks}};
}

function createAdobeField(seed,controls,scale=1){
  const R=new RNG(seed^0x7f4a7c15),b=v3(1.52*scale,.54*scale,.83*scale),r=mix(.095,.175,controls.edge)*scale;
  const yaw=R.range(-.030,.030)*controls.form,slumpX=R.range(-.045,.045)*controls.form,slumpZ=R.range(-.035,.035)*controls.form;
  const chips=[],pullouts=[],fibers=[];
  for(let i=0;i<2+Math.round(controls.fracture*2);i++){
    const side=R.pick([0,1,2,3]),u=R.range(-.82,.82),v=R.range(-.65,.65);let c;
    if(side===0)c=v3(b.x*.985,v*b.y,u*b.z);else if(side===1)c=v3(-b.x*.985,v*b.y,u*b.z);else if(side===2)c=v3(u*b.x,v*b.y,b.z*.985);else c=v3(u*b.x,v*b.y,-b.z*.985);
    chips.push({c,r:v3(R.range(.075,.180)*scale,R.range(.055,.145)*scale,R.range(.065,.165)*scale),seed:R.int(1,999999)});
  }
  for(let i=0;i<2+Math.round(controls.fracture*2);i++){
    const z=R.pick([-1,1])*b.z*.982,x=R.range(-.70,.70)*b.x,y=R.range(-.42,.46)*b.y,dir=norm(v3(R.range(.60,1.0),R.range(-.25,.25),R.range(-.12,.12)));
    const half=R.range(.055,.16)*scale;pullouts.push({a:add(v3(x,y,z),mul(dir,-half)),b:add(v3(x,y,z),mul(dir,half)),r:R.range(.016,.034)*scale,seed:R.int(1,999999)});
  }
  for(let i=0;i<5;i++){
    const z=R.pick([-1,1])*b.z*1.003,x=R.range(-.80,.80)*b.x,y=R.range(-.48,.48)*b.y,dir=norm(v3(R.range(.45,1.0),R.range(-.35,.35),R.range(-.10,.10)));
    fibers.push({c:v3(x,y,z),dir,len:R.range(.12,.30)*scale,r:R.range(.008,.016)*scale});
  }
  const sdf=p0=>{
    let p=rotateY(p0,yaw);p=v3(p.x+slumpX*(p.y/b.y),p.y,p.z+slumpZ*(p.y/b.y));
    const q=v3(p.x+fbm3(p.y*.44,p.z*.44,p.x*.15,seed+193,3)*controls.form*.024*scale,p.y+fbm3(p.x*.34,p.z*.34,p.y*.16,seed+223,3)*controls.form*.020*scale,p.z+fbm3(p.x*.44,p.y*.44,p.z*.15,seed+251,3)*controls.form*.022*scale);
    let d=sdRoundBox(q,b,r);
    const side=Math.max(smoothstep(.38,.96,Math.abs(q.x)/b.x),smoothstep(.38,.96,Math.abs(q.z)/b.z));
    const compaction=fbm3(q.x*.54,q.y*1.10,q.z*.54,seed+293,4),crumb=ridged3(q.x*2.0,q.y*2.2,q.z*2.0,seed+317,3)-.63;
    d+=(compaction*.022+crumb*.006*side)*scale*controls.relief;
    d=smax(d,-p0.y,mix(.018,.055,controls.edge)*scale);
    for(const chip of chips){const irr=fbm3(q.x*4.8,q.y*4.8,q.z*4.8,chip.seed,2)*.012*scale;d=opSubtract(d,sdEllipsoid(q,chip.c,v3(chip.r.x+irr,chip.r.y+irr*.8,chip.r.z+irr)));}
    for(const ch of pullouts){const irr=fbm3(q.x*7.0,q.y*7.0,q.z*7.0,ch.seed,2)*.005*scale;d=opSubtract(d,sdCapsule(q,ch.a,ch.b,Math.max(.010,ch.r+irr)));}
    return d;
  };
  return{family:1,sdf,bounds:v3(b.x+.34*scale,b.y+.30*scale,b.z+.34*scale),meta:{b,chips,pullouts,fibers}};
}

function createAshlarField(seed,controls,scale=1){
  const R=new RNG(seed^0x2f6e2b1),b=v3(1.48*scale,.41*scale,.93*scale),r=mix(.018,.052,controls.edge)*scale;
  const yaw=R.range(-.016,.016)*controls.form,leanX=R.range(-.014,.014)*controls.form,leanZ=R.range(-.014,.014)*controls.form;
  const chips=[],corners=[[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let i=0;i<2+Math.round(controls.fracture*2);i++){
    const c=corners.splice(R.int(0,corners.length-1),1)[0],upper=R.next()<.72;
    chips.push({c:v3(c[0]*(b.x-R.range(.018,.060)*scale),upper?b.y*R.range(.72,1.02):-b.y*R.range(.74,1.02),c[1]*(b.z-R.range(.018,.060)*scale)),r:v3(R.range(.085,.175)*scale,R.range(.055,.120)*scale,R.range(.080,.165)*scale),seed:R.int(1,999999)});
  }
  const sdf=p0=>{
    let p=rotateY(p0,yaw);p=v3(p.x+leanX*p.y,p.y,p.z+leanZ*p.y);
    const wx=fbm3(p.y*.44,p.z*.44,p.x*.16,seed+71,3)*controls.form*.010*scale;
    const wz=fbm3(p.x*.44,p.y*.44,p.z*.16,seed+83,3)*controls.form*.009*scale;
    const q=v3(p.x+wx,p.y,p.z+wz);
    let d=sdRoundBox(q,b,r);
    const side=Math.max(smoothstep(.42,.96,Math.abs(q.x)/b.x),smoothstep(.42,.96,Math.abs(q.z)/b.z));
    const top=smoothstep(.56,.98,Math.abs(q.y)/b.y);
    const broad=fbm3(q.x*.66,q.y*.52,q.z*.66,seed+137,4);
    const chisel=ridged3(q.x*3.2,q.y*2.7,q.z*3.2,seed+199,3)-.59;
    d+=(broad*.014+chisel*.0038*side*(1-top))*scale*controls.relief;
    for(const chip of chips){const irr=fbm3(q.x*5.2,q.y*5.2,q.z*5.2,chip.seed,3)*.014*scale*controls.fracture;const rr=v3(Math.max(.018,chip.r.x+irr),Math.max(.018,chip.r.y+irr*.65),Math.max(.018,chip.r.z+irr));d=opSubtract(d,sdEllipsoid(q,chip.c,rr));}
    return d;
  };
  return{family:2,sdf,bounds:v3(b.x+.30*scale,b.y+.26*scale,b.z+.30*scale),meta:{b,chips}};
}

function createRubbleField(seed,controls,scale=1){
  const R=new RNG(seed^0x9e3779b9),h=mix(.72,.90,controls.form)*scale,hx=mix(1.26,1.47,controls.form)*scale,hz=mix(.94,1.14,controls.form)*scale,center=v3(R.range(-.10,.10)*scale,0,R.range(-.08,.08)*scale);
  const planes=[{n:v3(0,-1,0),d:0,kind:2}];
  const topN=norm(v3(R.range(-.08,.10)*controls.form,1,R.range(-.09,.09)*controls.form));planes.push({n:topN,d:dot(topN,v3(center.x,h,center.z)),kind:1});
  const sides=9+Math.round(controls.form*2),offset=R.range(0,Math.PI*2);
  for(let i=0;i<sides;i++){
    const a=offset+i*Math.PI*2/sides+R.range(-.065,.065),ex=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),rad=ex*R.range(.90,1.075),ny=R.range(-.16,.18)*controls.form;
    const n=norm(v3(Math.cos(a),ny,Math.sin(a))),p=v3(center.x+Math.cos(a)*rad,h*R.range(.35,.62),center.z+Math.sin(a)*rad);planes.push({n,d:dot(n,p),kind:3});
  }
  const cuts=[];
  for(let i=0;i<Math.round(controls.fracture*1.8);i++){
    const a=offset+R.range(0,Math.PI*2),rad=R.range(.80,.91)/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),ny=R.range(-.24,.34),n=norm(v3(Math.cos(a),ny,Math.sin(a))),p=v3(center.x+Math.cos(a)*rad,h*R.range(.42,.76),center.z+Math.sin(a)*rad);cuts.push({n,d:dot(n,p),kind:4});
  }
  const spalls=[];
  for(let i=0;i<1+Math.round(controls.fracture*1.5);i++){
    const a=offset+R.range(0,Math.PI*2),support=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz));
    spalls.push({a,c:v3(center.x+Math.cos(a)*support*R.range(.985,1.025),h*R.range(.20,.78),center.z+Math.sin(a)*support*R.range(.985,1.025)),r:v3(R.range(.055,.095)*scale,R.range(.10,.18)*scale,R.range(.16,.28)*scale),seed:R.int(1,999999)});
  }
  const sdf=p=>{
    const roundK=mix(.009,.025,controls.edge)*scale;let d=-1e9;
    for(const pl of planes){const pd=dot(pl.n,p)-pl.d;d=d<-1e8?pd:smax(d,pd,roundK);}
    for(const pl of cuts){const pd=dot(pl.n,p)-pl.d;d=smax(d,pd,roundK*.38);}
    const sideGate=smoothstep(.28,.96,Math.hypot(p.x-center.x,p.z-center.z)/Math.max(hx,hz)),topGate=smoothstep(.38,.94,p.y/Math.max(h,.001));
    const macro=fbm3(p.x*.64,p.y*.57,p.z*.64,seed+271,4),rugged=ridged3(p.x*1.95,p.y*1.72,p.z*1.95,seed+337,3)-.60;
    d+=(macro*.026+rugged*.007*(.28+.72*sideGate))*scale*controls.relief*(.72+.28*topGate);
    for(const sp of spalls){const irr=fbm3(p.x*5.2,p.y*5.2,p.z*5.2,sp.seed,2)*.010*scale*controls.fracture;const rr=v3(Math.max(.022,sp.r.x+irr*.45),Math.max(.030,sp.r.y+irr*.75),Math.max(.040,sp.r.z+irr));d=opSubtract(d,sdEllipsoidY(p,sp.c,rr,sp.a));}
    return d;
  };
  return{family:3,sdf,bounds:v3(hx+.36*scale,h+.30*scale,hz+.36*scale),meta:{planes,cuts,spalls,h,hx,hz}};
}

function createFlagstoneField(seed,controls,scale=1){
  const R=new RNG(seed^0x85ebca6b),h=mix(.23,.34,controls.form)*scale,hx=mix(1.43,1.72,controls.form)*scale,hz=mix(.88,1.12,controls.form)*scale;
  const sides=9+Math.round(controls.form*3),offset=R.range(0,Math.PI*2),planes=[];
  for(let i=0;i<sides;i++){
    const a=offset+i*Math.PI*2/sides+R.range(-.075,.075),ex=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),rad=ex*R.range(.84,1.12),n=v3(Math.cos(a),0,Math.sin(a));planes.push({n,d:rad});
  }
  const notches=[];for(let i=0;i<1+Math.round(controls.fracture*1.4);i++){const a=offset+R.range(0,Math.PI*2),n=v3(Math.cos(a),0,Math.sin(a)),ex=1/Math.sqrt((Math.cos(a)**2)/(hx*hx)+(Math.sin(a)**2)/(hz*hz)),rad=ex*R.range(.72,.88);notches.push({n,d:rad});}
  const slopeX=R.range(-.040,.040)*controls.form,slopeZ=R.range(-.034,.034)*controls.form;
  const delams=[];
  for(let i=0;i<1+Math.round(controls.fracture*.8);i++){
    const a=R.range(0,Math.PI*2),t=v3(-Math.sin(a),0,Math.cos(a)),n=v3(Math.cos(a),0,Math.sin(a)),c=v3(n.x*hx*R.range(.72,.90),h*R.range(.22,.58),n.z*hz*R.range(.72,.90));
    delams.push({a:add(c,mul(t,-R.range(.16,.32)*scale)),b:add(c,mul(t,R.range(.16,.32)*scale)),r:R.range(.030,.052)*scale,seed:R.int(1,999999)});
  }
  const sdf=p=>{
    let side=-1e9;for(const pl of planes)side=Math.max(side,dot(pl.n,p)-pl.d);for(const pl of notches)side=Math.max(side,dot(pl.n,p)-pl.d);
    const topY=h+slopeX*p.x+slopeZ*p.z+fbm3(p.x*.48,p.z*.48,1.7,seed+421,3)*.020*scale*controls.form;
    const bottomY=fbm3(p.x*.66,p.z*.66,3.9,seed+457,2)*.004*scale;
    let d=Math.max(side,Math.max(p.y-topY,bottomY-p.y));
    const edgeGate=smoothstep(-.24,.035,side),broad=fbm3(p.x*.70,p.y*.90,p.z*.70,seed+509,4),grain=ridged3(p.x*2.35,p.y*1.6,p.z*2.35,seed+571,3)-.61;
    d+=(broad*.008+grain*.0012*edgeGate)*scale*controls.relief;
    for(const sh of delams){const irr=fbm3(p.x*5.4,p.y*5.4,p.z*5.4,sh.seed,2)*.006*scale;d=opSubtract(d,sdCapsule(p,sh.a,sh.b,Math.max(.010,sh.r+irr)));}
    return d;
  };
  return{family:4,sdf,bounds:v3(hx+.36*scale,h+.28*scale,hz+.36*scale),meta:{planes,notches,delams,h,hx,hz}};
}

function createCobbleField(seed,controls,scale=1){
  const R=new RNG(seed^0xc2b2ae35),r=v3(R.range(1.18,1.42)*scale,R.range(.57,.76)*scale,R.range(.86,1.08)*scale),center=v3(R.range(-.05,.05)*scale,r.y*.88,R.range(-.05,.05)*scale),yaw=R.range(-.24,.24);
  const sideSign=R.next()<.5?-1:1,lobeCenter=v3(sideSign*r.x*R.range(.24,.34),r.y*R.range(-.06,.14),r.z*R.range(-.18,.20)),lobeRadius=v3(r.x*R.range(.62,.78),r.y*R.range(.70,.90),r.z*R.range(.64,.82));
  const shoulderCenter=v3(-sideSign*r.x*R.range(.20,.30),r.y*R.range(.24,.42),-r.z*R.range(.14,.28)),shoulderRadius=v3(r.x*R.range(.48,.66),r.y*R.range(.46,.66),r.z*R.range(.50,.68));
  const flatA=R.range(0,Math.PI*2),flatN=norm(v3(Math.cos(flatA),R.range(-.06,.12),Math.sin(flatA))),flatSupport=Math.sqrt((flatN.x*r.x)**2+(flatN.y*r.y)**2+(flatN.z*r.z)**2)*R.range(.91,.97);
  const chips=[];for(let i=0;i<(controls.fracture>.25?1+Math.round(controls.fracture):0);i++){const n=norm(v3(R.range(-1,1),R.range(.12,.74),R.range(-1,1))),support=Math.sqrt((n.x*r.x)**2+(n.y*r.y)**2+(n.z*r.z)**2),c=add(center,mul(n,support*R.range(.90,.98)));chips.push({c,r:v3(R.range(.07,.14)*scale,R.range(.045,.10)*scale,R.range(.07,.14)*scale),seed:R.int(1,999999)});}
  const sdf=p0=>{
    let p=rotateY(sub(p0,center),yaw);p=v3(p.x+p.y*(.10+.10*controls.form)+p.z*p.z*.018/scale,p.y,p.z+p.x*p.y*.030/scale+p.y*p.y*.020/scale);
    const warp=v3(fbm3(p.y*.62,p.z*.62,p.x*.22,seed+613,3),fbm3(p.x*.62,p.z*.62,p.y*.22,seed+641,3),fbm3(p.x*.62,p.y*.62,p.z*.22,seed+673,3));
    const q=v3(p.x+warp.x*.070*scale*controls.form,p.y+warp.y*.040*scale*controls.form,p.z+warp.z*.060*scale*controls.form);
    let d=sdEllipsoid(q,v3(0,0,0),r);
    d=smin(d,sdEllipsoid(q,lobeCenter,lobeRadius),mix(.10,.19,controls.edge)*scale);
    d=smin(d,sdEllipsoid(q,shoulderCenter,shoulderRadius),mix(.07,.14,controls.edge)*scale);
    const radial=Math.max(Math.abs(q.x)/r.x,Math.abs(q.y)/r.y,Math.abs(q.z)/r.z),broad=fbm3(q.x*.60,q.y*.60,q.z*.60,seed+719,4),fine=fbm3(q.x*2.45,q.y*2.45,q.z*2.45,seed+751,3);
    d+=(broad*.052+fine*.007)*scale*controls.relief*smoothstep(.15,1.08,radial);
    d=smax(d,-p0.y,mix(.030,.070,controls.edge)*scale);
    d=smax(d,dot(flatN,sub(p0,center))-flatSupport,mix(.055,.11,controls.edge)*scale);
    for(const ch of chips){const irr=fbm3(p0.x*5.5,p0.y*5.5,p0.z*5.5,ch.seed,2)*.008*scale;d=opSubtract(d,sdEllipsoid(p0,ch.c,v3(ch.r.x+irr,ch.r.y+irr*.8,ch.r.z+irr)));}
    return d;
  };
  return{family:5,sdf,bounds:v3(r.x+.38*scale,r.y*2.0+.30*scale,r.z+.38*scale),meta:{r,center,lobeCenter,lobeRadius,shoulderCenter,shoulderRadius,chips}};
}

function createField(family,seed,controls,scale=1){if(family===0)return createFiredClayField(seed,controls,scale);if(family===1)return createAdobeField(seed,controls,scale);if(family===2)return createAshlarField(seed,controls,scale);if(family===3)return createRubbleField(seed,controls,scale);if(family===4)return createFlagstoneField(seed,controls,scale);return createCobbleField(seed,controls,scale);}

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
function makeSurfaceAttribute(positions,normals,family,scale){
  const count=positions.length/3,surface=new Float32Array(count*4),inv=Math.max(scale,.001);
  for(let i=0;i<count;i++){
    const px=positions[i*3]/inv,py=positions[i*3+1]/inv,pz=positions[i*3+2]/inv,nx=normals[i*3],ny=normals[i*3+1],nz=normals[i*3+2];
    const up=smoothstep(.48,.90,ny),down=smoothstep(.48,.90,-ny),side=clamp(1-Math.abs(ny),0,1);
    const topBottom=Math.max(up,down),edgeProxy=clamp(side*(.36+.64*ridged3(px*1.2,py*1.2,pz*1.2,719+family*83,2)),0,1);
    surface[i*4]=up>.56?1:(down>.56?0:2);
    surface[i*4+1]=Math.atan2(pz,px)/(Math.PI*2)+.5;
    surface[i*4+2]=clamp(edgeProxy*(1-topBottom*.42),0,1);
    surface[i*4+3]=0;
  }
  return surface;
}
function buildMesh(family,seed,controlsInput={},quality=1,scale=1){
  const controls={form:controlsInput.form??.55,fracture:controlsInput.fracture??.42,edge:controlsInput.edge??.35,relief:controlsInput.relief??.45,weather:controlsInput.weather??.4,rough:controlsInput.rough??.8};
  if(family>=2){
    const stoneApi=(typeof window!=='undefined'&&window.BrickMotherStoneFormGeometryV35)||null;
    if(!stoneApi)throw new Error('高精度石材形面模块没有载入');
    const data=stoneApi.buildMesh(family-2,seed,controls,quality,scale);
    data.family=family;
    data.sourceGrammar='BrickMotherStoneFormGeometryV35';
    return data;
  }
  const field=createField(family,seed,controls,scale),b=field.bounds,size=v3(b.x*2,b.y*2,b.z*2),longest=Math.max(size.x,size.y,size.z),target=Math.max(24,Math.round(66*quality)),nx=Math.max(18,Math.round(target*size.x/longest)),ny=Math.max(14,Math.round(target*size.y/longest)),nz=Math.max(18,Math.round(target*size.z/longest)),min=v3(-b.x,-.18*scale,-b.z),step=v3(size.x/(nx-1),size.y/(ny-1),size.z/(nz-1)),grid=new Float32Array(nx*ny*nz),gi=(x,y,z)=>x+nx*(y+ny*z);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)grid[gi(x,y,z)]=field.sdf(v3(min.x+x*step.x,min.y+y*step.y,min.z+z*step.z));
  const positions=[],normals=[],cp=new Array(8),cv=new Array(8),epsilon=Math.min(step.x,step.y,step.z)*.34,maxVertices=450000;
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
    let allIn=true,allOut=true;for(let c=0;c<8;c++){const o=cubeCorners[c],gx=x+o[0],gy=y+o[1],gz=z+o[2];cp[c]=v3(min.x+gx*step.x,min.y+gy*step.y,min.z+gz*step.z);cv[c]=grid[gi(gx,gy,gz)];if(cv[c]<0)allOut=false;else allIn=false;}if(allIn||allOut)continue;
    for(const tet of tetrahedra){polygonizeTetra(tet.map(i=>cp[i]),tet.map(i=>cv[i]),field.sdf,epsilon,positions,normals,maxVertices);if(positions.length/3>=maxVertices)break;}
  }
  let minY=Infinity;for(let i=1;i<positions.length;i+=3)minY=Math.min(minY,positions[i]);for(let i=1;i<positions.length;i+=3)positions[i]-=minY;
  const posArray=new Float32Array(positions),normalArray=new Float32Array(normals);
  return{positions:posArray,normals:normalArray,surface:makeSurfaceAttribute(posArray,normalArray,family,scale),triangles:positions.length/9,vertices:positions.length/3,bounds:field.bounds,meta:field.meta,controls,seed,family,sourceGrammar:family===0?'FiredClaySDFV11':'AdobeSDFV11'};
}

if(typeof module!=='undefined')module.exports={version:'1.1.0-alpha.3',buildMesh,createField,createFiredClayField,createAdobeField,createAshlarField,createRubbleField,createFlagstoneField,createCobbleField};
if(typeof window!=='undefined')window.BrickMotherWeatheringGeometryV11={version:'1.1.0-alpha.3',buildMesh,createField};

})();
