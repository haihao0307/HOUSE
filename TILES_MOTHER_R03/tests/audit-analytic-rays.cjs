'use strict';
// Independent numerical audit of the published renderer equations. This does not claim GPU execution.
const fs=require('fs'),assert=require('assert'),crypto=require('crypto');
const shape=require('../shape.cjs');
const actual=require('../ray.cjs');
const source=fs.readFileSync(__dirname+'/../renderer.js','utf8');
const EPS=2e-6,HIT_EPS=1e-6;
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>mul(a,1/Math.hypot(...a));
let state=714273;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
function renderer(size,bend){
 const [L,W,T]=size,H=.45*W*bend,K=2*H/(W*W*.25+H*H),CE=Math.sqrt(Math.max(0,1-K*K*W*W*.25)),CAP=2*T+K*T*T;
 function domain(p,eps=EPS){const y=p[1]-T*.5,f=K*(p[0]*p[0]+y*y)-2*y;return f>=-eps&&f<=CAP+eps&&CE*Math.abs(p[0])+K*W*.5*(y-H)<=W*.5*CE+eps&&Math.abs(p[2])<=L*.5+eps;}
 function hit(ro,rd){let best=1e10,normal=[0,0,0],face=null;
  function candidate(t,n,id){if(t>HIT_EPS&&t<best&&domain(add(ro,mul(rd,t)))){best=t;normal=norm(n);face=id;}}
  function cylinder(q){const oy=ro[1]-T*.5,A=K*(rd[0]*rd[0]+rd[1]*rd[1]),B=2*K*(ro[0]*rd[0]+oy*rd[1])-2*rd[1],C=K*(ro[0]*ro[0]+oy*oy)-2*oy-q*CAP;
   function test(t){const p=add(ro,mul(rd,t));candidate(t,mul([K*p[0],K*(p[1]-T*.5)-1,0],q<.5?-1:1),'q'+q);}
   if(Math.abs(A)<1e-10){if(Math.abs(B)>1e-10)test(-C/B);return;}
   const D=B*B-4*A*C;if(D<0)return;const root=Math.sqrt(Math.max(0,D)),v=-.5*(B+(B>=0?root:-root));test(v/A);test(Math.abs(v)>1e-20?C/v:-B/(2*A));
  }
  cylinder(0);cylinder(1);
  for(const s of [-1,1]){const n=[s*CE,K*W*.5,0],den=dot(n,rd),d=W*.5*CE+K*W*.5*(H+T*.5);if(Math.abs(den)>1e-10)candidate((d-dot(n,ro))/den,n,'u'+s);if(Math.abs(rd[2])>1e-10)candidate((s*L*.5-ro[2])/rd[2],[0,0,s],'t'+s);}
  return{distance:best,normal,face,point:add(ro,mul(rd,best))};
 }
 return{hit,domain,K,CE,CAP};
}
let tests=0;const failures=[];let maxDistanceError=0,maxNormalError=0;
function check(ok,label,data){tests++;if(!ok&&failures.length<100)failures.push({label,...data});}
for(const size of [[.24,.21,.014],[.001,.002,.0001],[1,1,.05],[10,8,.4]])for(const bend of [0,1e-16,-1e-16,1e-10,-1e-10,1e-6,-1e-6,.1,-.1,.5,-.5,1,-1]){
 const m=shape.create(size,bend),r=renderer(size,bend),ac=actual.createIntersector(size,bend),[L,W,T]=size,offset=Math.min(...size)*.08;r.domain=ac.domain;r.hit=(ro,rd)=>{const h=ac.hit(ro,rd);return{distance:h.t,normal:h.normal||[0,0,0],point:add(ro,mul(rd,h.t))}};
 for(let i=0;i<180;i++){
  const u=(rng()*2-1)*.94,t=.03+rng()*.94,q=.03+rng()*.94;
  const cases=[];
  for(const q0 of [0,1]){const p=m.position(u,t,q0),n=norm([r.K*p[0],r.K*(p[1]-T*.5)-1,0]);cases.push([p,mul(n,q0===0?-1:1),'shell'+q0]);}
  for(const s of [-1,1])cases.push([m.position(s,t,q),[s*r.CE,r.K*W*.5,0],'side'+s]);
  for(const s of [-1,1])cases.push([m.position(u,(s+1)/2,q),[0,0,s],'end'+s]);
  for(const[p,n,label]of cases){const h=r.hit(add(p,mul(n,offset)),mul(n,-1)),err=Math.abs(h.distance-offset),ne=Math.hypot(...h.normal.map((v,j)=>v-n[j]));maxDistanceError=Math.max(maxDistanceError,err);maxNormalError=Math.max(maxNormalError,ne);check(err<Math.max(1e-8,offset*1e-6),'boundary distance',{size,bend,label,err,h});check(ne<1e-6,'normal',{size,bend,label,ne,h});}
  const p=m.position(u,t,q),d=norm([rng()-.5,rng()-.5,rng()-.5]),h=r.hit(p,d);check(h.distance<1e9&&r.domain(h.point)&&dot(h.normal,d)>-1e-6,'inside exit',{size,bend,h});
  check(r.domain(p),'parametric point in implicit solid',{size,bend,p});
 }
 // End-parallel and grazing: along the z axis just outside then just inside the sheet top.
 {const p=m.position(.1,.5,.5);p[2]=-L;const h=r.hit(p,[0,0,1]);check(Math.abs(h.distance-L/2)<1e-8,'axis parallel ray',{size,bend,h});}
}
// Tangent and near-grazing boundary coverage on the convex cylinder surface.
for(const size of [[.24,.21,.014],[1,1,.05],[10,8,.4]])for(const bend of [-1,-.5,-.1,.1,.5,1]){
 const s=shape.create(size,bend),r=actual.createIntersector(size,bend),k=s.curvature;
 for(let i=0;i<100;i++){
  const u=-.9+1.8*i/99,q=bend>0?1:0,p=s.position(u,.4,q),raw=norm([k*p[0],k*(p[1]-size[2]/2)-1,0]),n=mul(raw,q?1:-1),d=[raw[1],-raw[0],0],dist=size[1]*.2,ro=add(p,mul(d,-dist));
  const tangent=r.hit(ro,d);check(Number.isFinite(tangent.t)&&Math.abs(tangent.t-dist)<size[1]*1e-6,'exact tangent',{size,bend,u,t:tangent.t,dist});
  const eps=size[1]*1e-7,inside=r.hit(add(ro,mul(n,-eps)),d),outside=r.hit(add(ro,mul(n,eps)),d);
  check(Number.isFinite(inside.t),'near grazing inside',{size,bend,u});
  check(!Number.isFinite(outside.t),'near grazing outside',{size,bend,u,t:outside.t});
 }
}
const malformed=[];for(const size of [[1,1e-200,.01],[1e100,1e100,1e99],[1e-10,1e-10,1e-12]]){try{const s=shape.create(size,0),p=s.position(.1,.5,.5);malformed.push({size,accepted:true,curvature:s.curvature,p,finite:p.every(Number.isFinite)});}catch(e){malformed.push({size,accepted:false,error:e.message});}}
for(const item of malformed)check(!item.accepted,'unsupported scale rejected',item);
const report={raySHA256:crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/../ray.cjs')).digest('hex'),shaderSHA256:crypto.createHash('sha256').update(source).digest('hex'),tests,failures,maxDistanceError,maxNormalError,malformed,note:'Actual shipped ray.cjs CPU intersection function versus independent shape boundary/normal expectations; GPU separate.'};
fs.writeFileSync(__dirname+'/ANALYTIC_RAYS.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
