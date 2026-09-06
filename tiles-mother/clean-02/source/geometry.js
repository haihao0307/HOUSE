// Thin, closed ceramic shells. Material reference coordinates survive splitting.
function tilePoint(kind,u,t,seed=23){
 const P=PROFILE[kind],w=mix(P.w0,P.w1,t),h=mix(P.h0,P.h1,t),R=(w*w*.25+h*h)/(2*h),x=u*w*.5;
 const side=(noise(t*3.1,1,seed+7)-.5)*(1-u)*.00065+(noise(t*3.7,1,seed+97)-.5)*(1+u)*.00065;
 const z=(t-.5)*P.l+mix((noise(u*3,2,seed+113)-.5)*.0012,(noise(u*3.3,2,seed+211)-.5)*.0012,t);
 const y=(kind==='pan'?R-Math.sqrt(Math.max(1e-8,R*R-x*x)):Math.sqrt(Math.max(1e-8,R*R-x*x))-(R-h));
 const pressed=(noise(u*2.9,t*4.2,seed)-.5)*.0015+(noise(u*6.7,t*8.1,seed+11)-.5)*.0005;
 return [x+side,y+pressed,z];
}
function tileN(kind,u,t,seed){let a=V.sub(tilePoint(kind,u+.0001,t,seed),tilePoint(kind,u-.0001,t,seed)),b=V.sub(tilePoint(kind,u,t+.0001,seed),tilePoint(kind,u,t-.0001,seed));return V.norm(V.cross(b,a))}
function fractureT(u,seed){return .43+.043*u+.021*Math.sin(u*8.7+seed)+.008*Math.sin(u*24.3+seed*.3)}
class Mesh{
 constructor(){this.p=[];this.n=[];this.meta=[];this.idx=[]}
 vertex(p,skin=1){let i=this.p.length/3;this.p.push(...p);this.meta.push(skin,0);return i}
 tri(a,b,c){this.idx.push(a,b,c)}
 quad(a,b,c,d,flip=false){if(flip){this.tri(a,c,b);this.tri(b,c,d)}else{this.tri(a,b,c);this.tri(b,d,c)}}
 finish(weld=true){
  const sums=new Map(),keys=[];this.n=new Float32Array(this.p.length);
  for(let i=0;i<this.p.length;i+=3){let key=weld?this.p.slice(i,i+3).map(x=>Math.round(x*1e7)).join(','):String(i);keys.push(key);if(!sums.has(key))sums.set(key,[0,0,0])}
  for(let j=0;j<this.idx.length;j+=3){let a=this.idx[j],b=this.idx[j+1],c=this.idx[j+2],p=i=>this.p.slice(i*3,i*3+3),N=V.cross(V.sub(p(b),p(a)),V.sub(p(c),p(a)));for(let i of [a,b,c]){let s=sums.get(keys[i]);for(let k=0;k<3;k++)s[k]+=N[k]}}
  for(let i=0;i<keys.length;i++){let N=V.norm(sums.get(keys[i]));this.n.set(N,i*3)}
  this.p=new Float32Array(this.p);this.meta=new Float32Array(this.meta);this.idx=new Uint32Array(this.idx);return this;
 }
}
function ceramic(kind,seed=23,piece=0){
 const P=PROFILE[kind],nu=28,nv=14,G=new Mesh(),surfs=[],bands=[0,.14,.5,.86,1];
 const getT=(u,v)=>piece===1?v*fractureT(u,seed):piece===2?mix(fractureT(u,seed),1,v):v;
 function point(u,v,q){let t=getT(u,v),p=tilePoint(kind,u,t,seed),n=tileN(kind,u,t,seed),th=P.t*(1+.022*(noise(t*3,u+2,seed+37)-.5));
  let inset=q<.14?1-Math.sqrt(Math.max(0,1-(1-q/.14)**2)):q>.86?1-Math.sqrt(Math.max(0,1-(1-(1-q)/.14)**2)):0;
  let edge=[Math.sign(u)*Math.pow(Math.abs(u),18),0,Math.sign(v-.5)*Math.pow(Math.abs(2*v-1),18)];
  edge=V.sub(edge,V.scale(n,V.dot(edge,n)));
  return V.sub(V.sub(p,V.scale(n,q*th)),V.scale(edge,.00065*inset));
 }
 for(let q of [0,1]){let base=G.p.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)G.vertex(point(2*i/nu-1,j/nv,q),1);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let a=base+j*(nu+1)+i;G.quad(a,a+1,a+nu+1,a+nu+2,q===0)}
 }
 function edge(n,fn,flip,cut){let base=G.p.length/3;for(let i=0;i<=n;i++){let [u,v]=fn(i/n);for(let q of bands)G.vertex(point(u,v,q),cut?0:.78)}
 for(let i=0;i<n;i++)for(let k=0;k<bands.length-1;k++){let a=base+i*bands.length+k;G.quad(a,a+bands.length,a+1,a+bands.length+1,flip)}}
 edge(nv,v=>[-1,v],true,false);edge(nv,v=>[1,v],false,false);
 edge(nu,u=>[2*u-1,0],false,piece===2);edge(nu,u=>[2*u-1,1],true,piece===1);
 G.kind=kind;G.seed=seed;G.piece=piece;return G.finish();
}
// Wood reference cylinder, z is always fibre direction. Nonuniform instance scale
// sets the real dimensions; fibre evaluation takes that scale into account.
function timber(broken=false,seed=81,damage=[0],bearings=[]){
 let G=new Mesh(),nr=56,nz=damage.some(x=>x>0)?24:broken?18:1;
 const endZ=(x,y)=>.477+.028*(noise(x*3.7,y*3.7,seed)-.5)+.017*(noise(x*9.7,y*9.7,seed+123)-.5)+.006*(noise(x*21,y*21,seed+71)-.5);
 const rim=(a,end)=>end?(broken?endZ(Math.cos(a),Math.sin(a)):.5):-.5;
 function lossAt(t){let f=clamp(t)*(damage.length-1),i=Math.floor(f);return mix(damage[i],damage[Math.min(i+1,damage.length-1)],f-i)}
 function p(a,t){let hold=0;for(let b of bearings)hold=Math.max(hold,1-smooth(b[1],b[1]*1.6,Math.abs(t-b[0])));let d=lossAt(t)*(1-hold)*(1-smooth(.20,.63,Math.sin(a))),grain=.55+.23*Math.sin(t*13.3+seed)+.16*Math.sin(a*5.0+t*5.1+seed*.4);
  let r=1-.64*d*clamp(grain,.12,1),z=mix(-.5,rim(a,1),t);
  return[Math.cos(a)*r,1+(Math.sin(a)-1)*r,z]}

 for(let j=0;j<=nz;j++)for(let i=0;i<=nr;i++)G.vertex(p(i/nr*TAU,j/nz),1);
 for(let j=0;j<nz;j++)for(let i=0;i<nr;i++){let a=j*(nr+1)+i;G.quad(a,a+1,a+nr+1,a+nr+2,false)}
 for(let end of [0,1]){let eTop=p(Math.PI/2,end),eBottom=p(-Math.PI/2,end),cy=(eTop[1]+eBottom[1])*.5;let center=G.vertex([0,cy,end? (broken?endZ(0,0):.5):-.5],0),prev=null;
  for(let k=1;k<=(broken?12:1);k++){let row=[];for(let i=0;i<=nr;i++){let a=i/nr*TAU,r=k/(broken?12:1),pp=p(a,end);pp[0]*=r;pp[1]=cy+(pp[1]-cy)*r;pp[2]=end?(broken?endZ(Math.cos(a)*r,Math.sin(a)*r):.5):-.5;row.push(G.vertex(pp,0))}
   if(!prev){for(let i=0;i<nr;i++){if(end)G.tri(center,row[i],row[i+1]);else G.tri(center,row[i+1],row[i])}}
   else for(let i=0;i<nr;i++){if(end)G.quad(prev[i],row[i],prev[i+1],row[i+1],false);else G.quad(prev[i],row[i],prev[i+1],row[i+1],true)}prev=row;
  }
 }
 return G.finish(false);
}
function floorMesh(){let G=new Mesh();for(let p of [[-1,0,-1],[1,0,-1],[-1,0,1],[1,0,1]])G.vertex(p);G.quad(0,2,1,3);return G.finish()}
// Sparse linked lobes follow the actual carrier surface. No rectangular cutout.
function mossPatch(kind,seed,center=[.6,.64],radius=.013,heightScale=1){
 const G=new Mesh(),P=PROFILE[kind];
 function carrier(x,z){let u=clamp(center[0]+x/(P.w0*.5),-.975,.975),t=clamp(center[1]+z/P.l,.025,.975);return {p:tilePoint(kind,u,t,23),n:tileN(kind,u,t,23)}}
 // Low connected bases carry many submillimetre fronds; the green volume does
 // not consist of enlarged polygonal leaves or identical spherical beads.
 for(let b=0;b<7;b++){
  let a=hash(seed+b*271)*TAU,d=radius*.48*Math.sqrt(hash(seed+b*371)),cx=Math.cos(a)*d,cz=Math.sin(a)*d,rad=radius*(.27+.15*hash(seed+b*37)),h=rad*.13*heightScale,n=24;
  let c0=carrier(cx,cz),top=G.vertex(V.add(c0.p,V.scale(c0.n,h+.00012)),.5),bottom=G.vertex(V.add(c0.p,V.scale(c0.n,.0001)),0),ring=[];
  for(let j=0;j<n;j++){let aa=j/n*TAU,rr=rad*(1+.13*Math.sin(aa*3+b)+.11*Math.sin(aa*7+seed));let c=carrier(cx+rr*Math.cos(aa),cz+rr*Math.sin(aa));ring.push(G.vertex(V.add(c.p,V.scale(c.n,.00011)),0))}
  for(let j=0;j<n;j++){G.tri(top,ring[(j+1)%n],ring[j]);G.tri(bottom,ring[j],ring[(j+1)%n])}
 }
 for(let b=0;b<290;b++){
  let a=hash(seed+b*41)*TAU,d=radius*Math.sqrt(hash(seed+b*67));d*=.69+.20*Math.sin(a*3+seed)*Math.sin(a*5+1.7);
  let c=carrier(Math.cos(a)*d,Math.sin(a)*d),n=c.n,base=V.add(c.p,V.scale(n,.00012)),height=radius*(.044+.074*hash(seed+b*101))*heightScale,width=height*(.14+.15*hash(seed+b*111));
  let direction=hash(seed+b*171)*TAU,X=V.norm(V.sub([Math.cos(direction),0,Math.sin(direction)],V.scale(n,V.dot([Math.cos(direction),0,Math.sin(direction)],n)))),Y=V.cross(n,X);
  let tip=V.add(V.add(base,V.scale(n,height)),V.scale(X,height*.28));
  let l=G.vertex(V.add(base,V.scale(X,width)),.15),r=G.vertex(V.sub(base,V.scale(X,width)),.15),front=G.vertex(V.add(V.add(base,V.scale(n,height*.42)),V.scale(Y,width*.72)),.55),back=G.vertex(V.sub(V.add(base,V.scale(n,height*.42)),V.scale(Y,width*.72)),.55),t=G.vertex(tip,1);
  // Closed narrow leaf prism, two curved faces and a buried basal seam.
  G.tri(l,front,t);G.tri(front,r,t);G.tri(r,back,t);G.tri(back,l,t);G.tri(l,back,front);G.tri(back,r,front);
 }
 return G.finish();
}
