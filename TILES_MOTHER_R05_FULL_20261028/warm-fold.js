// Prior placements are candidates only. Every reused candidate is rechecked on current triangles.
function warmFold09I(key,pa,pb,ca,cb,a,b){
 const identity=JSON.parse(key.slice(6)).slice(0,9);
 const gap=(g,m,h,n)=>contact(g,m,h,n).minGapM;
 const span=(g,m)=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<g.p.length;i+=3){let x=M.transform(m,Array.from(g.p.slice(i,i+3)))[0];lo=Math.min(lo,x);hi=Math.max(hi,x)}return[lo,hi]};
 const lap=(g,m,h,n)=>{let x=span(g,m),y=span(h,n);return Math.min(x[1],y[1])-Math.max(x[0],y[0])};
 for(const [old,v] of STITCH_SOLVE09H){
  if(!old.startsWith('fold5/')||JSON.stringify(JSON.parse(old.slice(6)).slice(0,9))!==JSON.stringify(identity))continue;
  const q=JSON.parse(JSON.stringify(v)),{ps,cs,shift}=q;
  const pm=[0,1].map(c=>{let m=M.mul(M.mul(pb.items[c*b.rows].m,M.translate(0,0,shift)),M.rx(ps.angle));m[13]+=ps.dy;return m});
  const cm=M.mul(cb.items[0].m,M.mul(M.translate(cs.lateral||0,0,cs.shift),M.mul(M.rz(cs.roll),M.rx(cs.angle))));cm[13]+=cs.dy;
  const pan=[gap(pa.mesh,pa.items[a.rows-1].m,pb.mesh,pm[0]),gap(pb.mesh,pm[0],pb.mesh,pb.items[1].m)];
  const cover=[gap(ca.mesh,ca.items[a.rows-1].m,cb.mesh,cm),gap(cb.mesh,cm,cb.mesh,cb.items[1].m)];
  const choices=[0,1].map(c=>[gap(pb.mesh,pm[c],cb.mesh,cm),gap(pa.mesh,pa.items[c*a.rows+a.rows-1].m,cb.mesh,cm),gap(pb.mesh,pb.items[c*b.rows+1].m,cb.mesh,cm)]);
  const sides=choices.map(x=>Math.min(...x)),all=[...pan,...cover,...sides];
  const overlaps=[lap(pa.mesh,pa.items[a.rows-1].m,pb.mesh,pm[0]),lap(pb.mesh,pm[0],pb.mesh,pb.items[1].m),lap(ca.mesh,ca.items[a.rows-1].m,cb.mesh,cm),lap(cb.mesh,cm,cb.mesh,cb.items[1].m)];
  if(!all.every(x=>Number.isFinite(x)&&Math.abs(x)<.001)||!overlaps.every(x=>x>.005))continue;
  ps.contactGaps=pan;cs.contactGaps=[...cover,...sides];cs.supportRows=choices.map(x=>x.indexOf(Math.min(...x)));cs.verifiedFullMesh=true;q.score=Math.max(...all.map(Math.abs));q.revalidated09I=true;STITCH_SOLVE09H.set(key,q);return q;
 }return null;
}
