// Optional display adapter; never part of the object definition.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const hash=n=>{n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967295};
const noise=function noise(x,y,seed=0){let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);let h=(a,b)=>hash((Math.imul(a,73856093)^Math.imul(b,19349663)^seed)>>>0);return mix(mix(h(i,j),h(i+1,j),u),mix(h(i,j+1),h(i+1,j+1),u),v)};
const fract=x=>x-Math.floor(x);
const handHash=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453123);
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),
sub:(a,b)=>a.map((v,i)=>v-b[i]),
scale:(a,s)=>a.map(v=>v*s),
dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),
cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
norm:a=>{let l=Math.hypot(...a)||1;return a.map(x=>x/l)}};
class Mesh{
 constructor(){this.p=[];this.n=[];this.meta=[];this.idx=[]}
 vertex(p,skin=1,tag=0,q=0,u=0){let i=this.p.length/3;this.p.push(...p);this.meta.push(skin,tag,q,u);return i}
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
function sample(evaluator,detail=80){
 if(!Number.isInteger(detail)||detail<2)throw Error('Invalid display resolution');
 const G=new Mesh(),reference=[],params=[],bands=detail>40?[0,.05,.10,.14,.22,.32,.42,.5,.58,.68,.78,.86,.90,.95,1]:[0,.14,.5,.86,1];
 function vertex(u,t,q,skin){let p=evaluator.referencePoint(u,t,q).map(Math.fround);reference.push(...p);params.push([u,t,q]);G.vertex(evaluator.evaluateAtReference(p,Math.fround(u),Math.fround(q)),skin,1,q,u);}
 for(let q of [0,1]){let base=G.p.length/3;for(let j=0;j<=detail;j++)for(let i=0;i<=detail;i++)vertex(2*i/detail-1,j/detail,q,1);for(let j=0;j<detail;j++)for(let i=0;i<detail;i++){let a=base+j*(detail+1)+i;G.quad(a,a+1,a+detail+1,a+detail+2,q===0);}}
 function edge(fn,flip){let base=G.p.length/3;for(let i=0;i<=detail;i++){let[u,t]=fn(i/detail);for(let q of bands)vertex(u,t,q,.78);}for(let i=0;i<detail;i++)for(let k=0;k<bands.length-1;k++){let a=base+i*bands.length+k;G.quad(a,a+bands.length,a+1,a+bands.length+1,flip);}}
 edge(t=>[-1,t],true);edge(t=>[1,t],false);edge(u=>[2*u-1,0],false);edge(u=>[2*u-1,1],true);
 G.finish();G.reference=new Float32Array(reference);return G;
}
module.exports={sample};
