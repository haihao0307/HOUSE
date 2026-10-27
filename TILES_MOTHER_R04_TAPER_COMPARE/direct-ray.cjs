'use strict';
const {createSection}=require('./section.cjs');
// Direct parameter-surface ray queries. No persistent vertices, sampled surface or object mesh.
function createRay(e){
 const def=e.definition(),S=def.sheet,P=def.press,N=P.shoulder,section=createSection(S,P),T=Math.max(S.thickness,P.endThickness,N?N.thickness:0),W=Math.max(S.width,P.endWidth,N?N.width:0);
 const Y=Math.max(...P.rise.map(Math.abs),...P.lift.map(Math.abs),N?Math.abs(N.rise):0,N?Math.abs(N.lift):0)*2+T+.02;
 const limits=[[-W/2-T-.02,W/2+T+.02],[-Y,Y],[-S.length/2-T-.02,S.length/2+T+.02]];
 const clamp=x=>Math.max(0,Math.min(1,x)),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2],cross=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],sub=(x,y)=>x.map((v,i)=>v-y[i]),scale=(x,v)=>x.map(y=>y*v);
 const point=(face,a,b)=>{let u,t,q;if(face<2){u=2*a-1;t=b;q=face===0?0:1}else if(face<4){u=face===2?-1:1;t=a;q=b}else{u=2*a-1;t=face===4?0:1;q=b}return {u,t,q,p:e.position(u,t,q)}};
 function proxy(p){
  const t=clamp(p[2]/S.length+.5),sec=section(t),a=P.amount,w=S.width+(sec[0]-S.width)*a,h=sec[1]*a,th=S.thickness+(sec[3]-S.thickness)*a,k=2*h/(w*w/4+h*h),x=Math.max(-w/2,Math.min(w/2,p[0])),c=Math.sqrt(Math.max(1e-10,1-k*k*x*x)),top=a*sec[2]+k*x*x/(1+c),bottom=top-th/c;
  const d=[p[1]-top,bottom-p[1],-w/2-p[0],p[0]-w/2,-S.length/2-p[2],p[2]-S.length/2],v=Math.max(...d);return {d,v};
 }
 function hit(ro,rd){
  let lo=0,hi=Infinity;for(let k=0;k<3;k++){if(Math.abs(rd[k])<1e-12){if(ro[k]<limits[k][0]||ro[k]>limits[k][1])return null;continue}let a=(limits[k][0]-ro[k])/rd[k],b=(limits[k][1]-ro[k])/rd[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return null}
  const pos=s=>ro.map((v,i)=>v+s*rd[i]);let bestNear=Infinity,seed=lo,prev=lo,entry=null;
  for(let j=0;j<=96;j++){const s=lo+(hi-lo)*j/96,p=proxy(pos(s));if(p.v<bestNear){bestNear=p.v;seed=s}if(p.v<=0){let l=prev,h=s;for(let z=0;z<9;z++){let m=(l+h)/2;if(proxy(pos(m)).v<=0)h=m;else l=m}seed=h;entry=proxy(pos(h));break}prev=s}
  if(!entry){if(bestNear>.02)return null;entry=proxy(pos(seed))}
  // Try the closest approximate boundary and its immediate neighbours; refinement uses the full actual function.
  const faces=[0,1,2,3,4,5].sort((a,b)=>entry.d[b]-entry.d[a]);let best=null;
  function solve(face,initial,initA,initB){let s=initial,p=pos(s),a=initA===undefined?clamp(face<2?p[0]/W+.5:face<4?p[2]/S.length+.5:p[0]/W+.5):initA,b=initB===undefined?clamp(face<2?p[2]/S.length+.5:.5):initB,cur,da,db,residual=Infinity;
   for(let n=0;n<9;n++){
    try{cur=point(face,a,b)}catch(_){break}
    let r=sub(cur.p,pos(s));residual=Math.hypot(...r);if(residual<2e-7)break;
    const step=1e-4,aa=a<.9999?a+step:a-step,bb=b<.9999?b+step:b-step;
    try{da=scale(sub(point(face,aa,b).p,cur.p),1/(aa-a));db=scale(sub(point(face,a,bb).p,cur.p),1/(bb-b))}catch(_){break}
    const j3=scale(rd,-1),det=dot(da,cross(db,j3));if(Math.abs(det)<1e-12)break;
    const rhs=scale(r,-1),x=dot(rhs,cross(db,j3))/det,y=dot(da,cross(rhs,j3))/det,z=dot(da,cross(db,rhs))/det;
    a=clamp(a+Math.max(-.4,Math.min(.4,x)));b=clamp(b+Math.max(-.4,Math.min(.4,y)));s+=Math.max(-S.length,Math.min(S.length,z));if(s<lo-.05||s>hi+.05)break;
   }
   if(!cur||residual>=2e-7||s<=0||s>hi+.01||(best&&s>=best.distance))return;
   const step=1e-4,aa=a<.9999?a+step:a-step,bb=b<.9999?b+step:b-step;
   try{da=scale(sub(point(face,aa,b).p,cur.p),1/(aa-a));db=scale(sub(point(face,a,bb).p,cur.p),1/(bb-b))}catch(_){return}
   let n=cross(da,db),nl=Math.hypot(...n);if(nl<1e-15)return;n=scale(n,1/nl);
   const approx=[[0,1,0],[0,-1,0],[-1,0,0],[1,0,0],[0,0,-1],[0,0,1]][face];if(dot(n,approx)<0)n=scale(n,-1);
   best={distance:s,normal:n,face,u:cur.u,t:cur.t,q:cur.q,residual};
  }
  for(const face of faces){if(entry.d[face]<entry.v-.006&&best)break;solve(face,seed)}
  // A curved surface can meet one ray twice; test several seeds on both broad faces.
  for(const f of [0,1])for(const x of [.1,.35,.65,.9])solve(f,lo+(hi-lo)*x);
  if(!best||best.distance>seed+.006)for(const f of faces)for(const x of [.1,.35,.65,.9])solve(f,lo+(hi-lo)*x);
  if(!best)for(const f of [0,1])for(const a of [.1,.3,.5,.7,.9])for(const b of [.1,.3,.5,.7,.9]){
   let v;try{v=point(f,a,b).p}catch(_){continue}const initial=dot(sub(v,ro),rd);if(initial>=lo&&initial<=hi)solve(f,initial,a,b);
  }
  return best;
 }
 return {hit,limits};
}
if(typeof module!=='undefined')module.exports={createRay};
