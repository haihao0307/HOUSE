// Pure continuous pan-tile definition. No mesh, sampling resolution, DOM or display cache.
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

function tileBand(p,seed,density,footprint){let q=[p[0]+(fract(Math.sin(seed*12.9898+78.233)*43758.5453)-.5)*.11,p[2]+.4,p[1]+.27],r=Math.hypot(...q),xi=[Math.log2(r)-2,-q[2]/r,Math.atan2(q[0],q[1])].map(x=>x*density),span=footprint*density/Math.max(Math.hypot(q[0],q[1]),.2),value=0;for(let j=0,s=1;j<17;j++,s*=2){if(span*s>=2.4)break;let c=xi.map(x=>Math.cos(x*s));value+=(1-smooth(.8,2.4,span*s))*(Math.cos(c[2]*c[0]+c[1]*c[1]+c[1]*c[0])-.6556965)/s;}return value}
const surfaces=Object.freeze({top:'q=0',bottom:'q=1',left:'u=-1',right:'u=1',front:'t=0',back:'t=1'});
function createEvaluator(object) {
  if(object.function!=='kaopu.pan/1')throw Error('Unsupported function version');
  const v=object.variables, P={l:v.length,w0:v.width0,w1:v.width1,h0:v.height0,h1:v.height1,t:v.thickness,seed:v.shapeSeed};
  const wave=Object.freeze({...object.wave});
  for(const k of ['l','w0','w1','h0','h1','t'])if(!(Number.isFinite(P[k])&&P[k]>0))throw Error('Invalid dimension '+k);
  if(!Number.isInteger(P.seed)||!Number.isInteger(wave.seed)||!Number.isInteger(v.handSeed)||!Number.isFinite(wave.strength)||wave.strength<0||!Number.isFinite(wave.scale)||wave.scale<=0||!Number.isFinite(v.handGain)||!(v.handReferenceHalfWidth>0&&v.handReferenceLength>0))throw Error('Invalid variation parameters');
  const handSeed=v.handSeed,handGain=v.handGain,handHalfWidth=v.handReferenceHalfWidth,handLength=v.handReferenceLength;
  function domain(u,t,q){if(![u,t,q].every(Number.isFinite)||u < -1||u > 1||t < 0||t > 1||q < 0||q > 1)throw Error('Outside parameter domain');}
function base(u,t,seed=P.seed){
 const w=mix(P.w0,P.w1,t),h=mix(P.h0,P.h1,t),R=(w*w*.25+h*h)/(2*h),x0=u*w*.5;
 const side=(noise(t*1.35,1,seed+7)-.5)*(1-u)*.00082+(noise(t*1.55,1,seed+97)-.5)*(1+u)*.00082;
 let x=x0+side;
 const endGate=Math.pow(Math.abs(2*t-1),8),endWave=(noise(u*1.55,5,seed+211)-.5)*.00110*endGate;
 const z=(t-.5)*P.l+mix((noise(u*1.45,2,seed+113)-.5)*.00135,(noise(u*1.72,2,seed+311)-.5)*.00135,t)+endWave;
 let y=R-Math.sqrt(Math.max(1e-8,R*R-x0*x0));
 const seatGate=Math.pow(Math.max(0,1-u*u),1.45),endKeep=Math.sin(Math.PI*t);
 const broad=(noise(u*1.15+2.3,t*1.35+1.7,seed)-.5)*.00220;
 const palm=(noise(u*2.10+.7,t*2.35+4.1,seed+11)-.5)*.00100;
 const skew=(hash(seed+331)-.5)*.00120*u*endKeep;
 y+=seatGate*(broad+palm+skew)*endKeep*endKeep;
 return [x,y,z];
}
function normal(u,t){const a=V.sub(base(u+.0001,t),base(u-.0001,t)),b=V.sub(base(u,t+.0001),base(u,t-.0001));return V.norm(V.cross(b,a));}
 function skin(u,t,q){const seed=P.seed;let p=base(u,t),n=normal(u,t);
  let th=P.t*(1+.070*(noise(t*1.55,u*1.35,seed+37)-.5)+.035*(noise(t*4.1,u*3.1,seed+137)-.5));
  let inset=q<.14?1-Math.sqrt(Math.max(0,1-(1-q/.14)**2)):q>.86?1-Math.sqrt(Math.max(0,1-(1-(1-q)/.14)**2)):0;
  let edge=[Math.sign(u)*Math.pow(Math.abs(u),18),0,Math.sign(t-.5)*Math.pow(Math.abs(2*t-1),18)];
  edge=V.sub(edge,V.scale(n,V.dot(edge,n)));
  let handLip=.00050+.00030*noise(u*1.8,t*2.2,seed+1901);
  return V.sub(V.sub(p,V.scale(n,q*th)),V.scale(edge,handLip*inset));
 }

function hand(p){
  const u=clamp(p[0]/handHalfWidth,-1,1),t=clamp(p[2]/handLength+.5),side=(1-u*u)**2,end=Math.sin(Math.PI*t)**2;
  const a=handHash(handSeed*1.113)-.5,b=handHash(handSeed*2.173+3.1)-.5,c=handHash(handSeed*4.317+1.7)-.5,d=handHash(handSeed*7.919+5.2)-.5;
  return [Math.abs(u)**12*(a*.00034+b*.00018*Math.sin(t*7.1+d*3))*Math.sign(u),side*end*(a*.0028+b*.0014*Math.sin(2.3*u+1.7*t+c*4)+c*.0009*(2*t-1)+d*.0007*u),Math.abs(2*t-1)**12*(c*.00055+d*.00028*Math.sin(u*5.3+a*4))];
}
function offset(p,u,q){
  const t=clamp(p[2]/P.l+.5),n=normal(u,t),strength=wave.strength;
  const broad=clamp(tileBand(p,wave.seed,6*wave.scale,.0012),-1,1),mid=clamp(tileBand(p,wave.seed,26*wave.scale,.0012),-1,1),pore=smooth(.56,.67,tileBand(p,wave.seed,80*wave.scale,.0012));
  const edge=smooth(.85,1,Math.abs(u)),end=Math.pow(Math.abs(2*t-1),8),amplitude=mix(1,.52,Math.max(q,edge,end,0));
  const h=strength*amplitude*(.00135*broad+.00045*mid-.00075*pore),side=.00018*strength*mid;
  return [n[0]*h+Math.sign(u)*edge*side,n[1]*h,Math.sign(t-.5)*end*side];
}
function shape(u,t,q=0){domain(u,t,q);const p=skin(u,t,q),h=hand(p);return p.map((x,k)=>x+h[k]*handGain);}
function displacement(u,t,q=0){domain(u,t,q);return offset(skin(u,t,q),u,q);}
function position(u,t,q=0){domain(u,t,q);const p=skin(u,t,q),w=offset(p,u,q),h=hand(p);return p.map((x,k)=>x+w[k]+h[k]*handGain);}
// The following two point queries let a separate legacy display adapter match float32 staging.
function referencePoint(u,t,q){domain(u,t,q);return skin(u,t,q);}
function evaluateAtReference(p,u,q){const w=offset(p,u,q),h=hand(p);return p.map((x,k)=>x+w[k]+h[k]*handGain);}
return Object.freeze({shape,displacement,position,referencePoint,evaluateAtReference,surfaces});
}
module.exports={createEvaluator};
