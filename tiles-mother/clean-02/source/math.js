'use strict';
// Original, dependency-free math. Lengths are metres; matrices are column-major.
const TAU=Math.PI*2, clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t, smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const hash=n=>{n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967295};
function noise(x,y,seed=0){let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);let h=(a,b)=>hash((Math.imul(a,73856093)^Math.imul(b,19349663)^seed)>>>0);return mix(mix(h(i,j),h(i+1,j),u),mix(h(i,j+1),h(i+1,j+1),u),v)}
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a)||1;return a.map(x=>x/l)}};
const M={
 identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 mul:(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o},
 transform:(a,p)=>[a[0]*p[0]+a[4]*p[1]+a[8]*p[2]+a[12],a[1]*p[0]+a[5]*p[1]+a[9]*p[2]+a[13],a[2]*p[0]+a[6]*p[1]+a[10]*p[2]+a[14]],
 translate:(x,y,z)=>{let m=M.identity();m[12]=x;m[13]=y;m[14]=z;return m},
 scale:(x,y,z)=>new Float32Array([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]),
 rx:a=>{let c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1])},
 ry:a=>{let c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1])},
 rz:a=>{let c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1])},
 perspective:(f,a,n,far)=>{let t=1/Math.tan(f/2),nf=1/(n-far);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(far+n)*nf,-1,0,0,2*far*n*nf,0])},
 ortho:(l,r,b,t,n,f)=>new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]),
 look:(eye,target,up=[0,1,0])=>{let z=V.norm(V.sub(eye,target)),x=V.norm(V.cross(up,z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1])}
};
function model(x,y,z,rx=0,ry=0,scale=[1,1,1]){return M.mul(M.translate(x,y,z),M.mul(M.ry(ry),M.mul(M.rx(rx),M.scale(...scale))))}
const PROFILE={pan:{l:.238,w0:.242,w1:.221,h0:.05,h1:.047,t:.012},cover:{l:.222,w0:.115,w1:.09,h0:.037,h1:.035,t:.010}};

// Offline verified rigid seating for the fixed seed-23 shell templates.
// No changing view or surface parameter repeats a per-tile contact solve.
const SEATS=Object.freeze({"step":0.198,"spacing":0.242,"rafterRadius":0.023,"panY":0.005078458743291489,"panAngle":0.11500000000000007,"panRoll":0.0014608644540637082,"coverY":0.03861105347105794,"coverAngle":0.05000000000000002,"coverRoll":0.06122098204075048,"coverPhase":-0.044});
function tileModel(kind,x,y,z){return M.mul(M.translate(x,y,z),M.mul(M.rz(kind==='pan'?SEATS.panRoll:SEATS.coverRoll),M.rx(kind==='pan'?SEATS.panAngle:SEATS.coverAngle)))}
