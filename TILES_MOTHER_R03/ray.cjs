'use strict';
// Display-only analytic intersections; coordinates come from the shared shape rule.
function createIntersector(size,bend){
 const [L,W,T]=size,H=.45*W*bend,K=2*H/(W*W/4+H*H),CE=Math.sqrt(Math.max(0,1-K*K*W*W/4)),CAP=2*T+K*T*T;
 const norm=a=>{let n=Math.hypot(...a);return a.map(x=>x/n)},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const domain=(p,eps=2e-7)=>{const y=p[1]-T/2,f=K*(p[0]*p[0]+y*y)-2*y;return f>=-eps&&f<=CAP+eps&&CE*Math.abs(p[0])+K*W/2*(y-H)<=W/2*CE+eps&&Math.abs(p[2])<=L/2+eps};
 function hit(ro,rd){let best=Infinity,normal=null;
  function take(t,n){if(t>1e-7&&t<best){const p=ro.map((v,i)=>v+rd[i]*t);if(domain(p)){best=t;normal=norm(n);}}}
  for(const q of [0,1]){const oy=ro[1]-T/2,A=K*(rd[0]*rd[0]+rd[1]*rd[1]),B=2*K*(ro[0]*rd[0]+oy*rd[1])-2*rd[1],C=K*(ro[0]*ro[0]+oy*oy)-2*oy-q*CAP;let roots=[];
   if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots=[-C/B];}else{const D=B*B-4*A*C,tol=(B*B+Math.abs(4*A*C))*1e-14;if(D>=-tol){const sq=Math.sqrt(Math.max(0,D)),v=-.5*(B+(B>=0?sq:-sq));roots=[v/A,Math.abs(v)>1e-30?C/v:-B/(2*A)];}}
   for(const t of roots){const p=ro.map((v,i)=>v+t*rd[i]),n=[K*p[0],K*(p[1]-T/2)-1,0];take(t,q?n:n.map(v=>-v));}
  }
  for(const s of [-1,1]){const n=[s*CE,K*W/2,0],den=dot(n,rd),d=W/2*CE+K*W/2*(H+T/2);if(Math.abs(den)>1e-12)take((d-dot(n,ro))/den,n);if(Math.abs(rd[2])>1e-12)take((s*L/2-ro[2])/rd[2],[0,0,s]);}
  return {t:best,normal};
 }
 return {hit,domain};
}
if(typeof module!=='undefined')module.exports={createIntersector};
