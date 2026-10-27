'use strict';
// Display-only 09J analytic shell, extended to two unequal material-domain side limits.
function createIntersector(size,bend,edges=[1,1]){
 const[L,W,T]=size,H=.45*W*bend,K=2*H/(W*W/4+H*H),CAP=2*T+K*T*T;
 const norm=a=>{const n=Math.hypot(...a);return a.map(x=>x/n)},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const sides=edges.map((e,i)=>{const s=i?1:-1,x=e*W/2,c=Math.sqrt(Math.max(0,1-K*K*x*x)),y=T/2+K*x*x/(1+c),n=[s*c,K*x,0];return{n,d:c*x+K*x*y}});
 const domain=(p,eps=2e-7)=>{const y=p[1]-T/2,f=K*(p[0]*p[0]+y*y)-2*y;return f>=-eps&&f<=CAP+eps&&sides.every(s=>dot(s.n,p)<=s.d+eps)&&Math.abs(p[2])<=L/2+eps};
 function hit(ro,rd){let best=Infinity,normal=null;
  function take(t,n){if(t>1e-7&&t<best){const p=ro.map((v,i)=>v+rd[i]*t);if(domain(p)){best=t;normal=norm(n)}}}
  for(const q of[0,1]){const oy=ro[1]-T/2,A=K*(rd[0]*rd[0]+rd[1]*rd[1]),B=2*K*(ro[0]*rd[0]+oy*rd[1])-2*rd[1],C=K*(ro[0]*ro[0]+oy*oy)-2*oy-q*CAP;let roots=[];
   if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots=[-C/B]}else{const D=B*B-4*A*C,tol=(B*B+Math.abs(4*A*C))*1e-14;if(D>=-tol){const v=-.5*(B+(B>=0?1:-1)*Math.sqrt(Math.max(0,D)));roots=[v/A,Math.abs(v)>1e-30?C/v:-B/(2*A)]}}
   for(const t of roots){const p=ro.map((v,i)=>v+t*rd[i]),n=[K*p[0],K*(p[1]-T/2)-1,0];take(t,q?n:n.map(v=>-v))}
  }
  for(const s of sides){const den=dot(s.n,rd);if(Math.abs(den)>1e-12)take((s.d-dot(s.n,ro))/den,s.n)}
  if(Math.abs(rd[2])>1e-12)for(const s of[-1,1])take((s*L/2-ro[2])/rd[2],[0,0,s]);
  return{t:best,normal};
 }
 function materialAddress(p){const y=p[1]-T/2,f=K*(p[0]*p[0]+y*y)-2*y,r=Math.hypot(K*p[0],K*y-1),q=Math.max(0,Math.min(1,f/(T*(1+r)))),x=p[0]/(1+q*T*K);return{u:2*x/W,t:p[2]/L+.5,q,point:[x,(.5-q)*T,p[2]]}}
 return{hit,domain,materialAddress};
}
if(typeof module!=='undefined')module.exports={createIntersector};
