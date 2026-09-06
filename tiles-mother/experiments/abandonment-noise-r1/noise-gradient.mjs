/** Original test kernel: cubic-interpolated value noise, not Blender/Simplex code.
 * Returns value and its analytic gradient; no texture fetch, no domain warp.
 * For n(A*x+b), the external caller must apply gradient_x=A^T*gradient_p.
 */
function hash(x,y,z,seed){let h=(seed^Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791))>>>0;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return((h^(h>>>16))>>>0)/4294967295;}
export function noiseValueGradient(p,seed=1){
  if(!Array.isArray(p)||p.length!==3||!p.every(x=>Number.isFinite(x)&&Math.abs(x)<1e6))throw new RangeError('bounded finite 3D coordinate required');
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new RangeError('uint32 seed required');
  const i=p.map(Math.floor),f=p.map((v,k)=>v-i[k]);
  const s=f.map(t=>t*t*(3-2*t)),d=f.map(t=>6*t*(1-t)),out=[0,0,0,0];
  for(let z=0;z<=1;z++)for(let y=0;y<=1;y++)for(let x=0;x<=1;x++){
    const v=hash(i[0]+x,i[1]+y,i[2]+z,seed),bits=[x,y,z],w=bits.map((b,k)=>b?s[k]:1-s[k]),g=bits.map((b,k)=>(b?1:-1)*d[k]);
    out[0]+=v*w[0]*w[1]*w[2];out[1]+=v*g[0]*w[1]*w[2];out[2]+=v*w[0]*g[1]*w[2];out[3]+=v*w[0]*w[1]*g[2];
  }return out;
}
