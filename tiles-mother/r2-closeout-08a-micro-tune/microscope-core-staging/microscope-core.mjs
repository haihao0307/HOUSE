/* Tiles Mother: user-taught Macroscopic microscope core 01/02.
 * Provenance and integration boundary: SOURCE_AND_SCOPE.json.
 * This file is NOT a replacement workbench. Units/offsets are caller-owned.
 * No noise, strokes, pores, cell grids, or guessed rotation schedule are added.
 */
export const SCALES = Object.freeze(Array.from({length:17}, (_,j)=>2**j));
const finite3 = (p,name) => {
  if (!Array.isArray(p) || p.length !== 3 || p.some(x=>!Number.isFinite(x)))
    throw new TypeError(name+' must contain three finite numbers');
};
export function coordinates(p,time=0) {
  finite3(p,'position');
  if (!Number.isFinite(time)) throw new TypeError('time must be finite');
  const radius=Math.hypot(...p);
  if (!(radius>0) || p[0]*p[0]+p[1]*p[1]===0)
    throw new RangeError('Microscope angular/radial pole: choose a verified material domain');
  // User convention: xi1 has NO additional -1; atan arguments are (x,y).
  return [Math.log2(radius)-2-.3*time,-p[2]/radius,Math.atan2(p[0],p[1])];
}
export function layer(xi,scale) {
  finite3(xi,'xi');
  if (!(scale>0) || !Number.isFinite(scale)) throw new RangeError('scale must be positive');
  const [x,y,z]=xi.map(v=>Math.cos(v*scale));
  return Math.cos(z*x+y*y+y*x)/scale;
}
export function evaluateXi(xi,levels=17,weights=null) {
  finite3(xi,'xi');
  if (!Number.isInteger(levels)||levels<0||levels>17) throw new RangeError('levels must be 0..17');
  if (weights!==null && (weights.length!==17 || weights.some(w=>!Number.isFinite(w)||w<0||w>1)))
    throw new RangeError('display weights must have 17 entries in [0,1]');
  let value=0;const gradientXi=[0,0,0];
  for(let j=0;j<levels;j++) {
    const s=SCALES[j],w=weights===null?1:weights[j];
    const a=xi.map(v=>v*s), c=a.map(Math.cos), sn=a.map(Math.sin);
    const phase=c[2]*c[0]+c[1]*c[1]+c[1]*c[0], sinPhase=Math.sin(phase);
    value+=w*Math.cos(phase)/s;
    // The phase derivative contributes s, exactly cancelling amplitude 1/s.
    gradientXi[0]+=w*sinPhase*sn[0]*(c[2]+c[1]);
    gradientXi[1]+=w*sinPhase*sn[1]*(2*c[1]+c[0]);
    gradientXi[2]+=w*sinPhase*sn[2]*c[0];
  }
  return {value,gradientXi};
}
export function evaluate(position,{time=0,levels=17,weights=null}={}) {
  const xi=coordinates(position,time),f=evaluateXi(xi,levels,weights);
  const [x,y,z]=position,r=Math.hypot(x,y,z),r2=r*r,r3=r2*r,xy2=x*x+y*y;
  const J0=position.map(v=>v/(r2*Math.LN2));
  const J1=[z*x/r3,z*y/r3,z*z/r3-1/r];
  const J2=[y/xy2,-x/xy2,0];
  const gradient=position.map((_,k)=>f.gradientXi[0]*J0[k]+f.gradientXi[1]*J1[k]+f.gradientXi[2]*J2[k]);
  return {...f,xi,gradient};
}
export function bindPBR(material,field,controls={}) {
  finite3(material.baseColor,'baseColor');finite3(material.normal,'normal');
  finite3(field.gradient,'gradient');
  const {strength=0,heightScale=0,colorAmount=0,roughnessAmount=0,referenceValue=0,maxSlope=1}=controls;
  for (const [name,v] of Object.entries({strength,heightScale,colorAmount,roughnessAmount,referenceValue,maxSlope}))
    if(!Number.isFinite(v)) throw new TypeError(name+' must be finite');
  if(strength<0||heightScale<0||colorAmount<0||roughnessAmount<0||maxSlope<=0) throw new RangeError('negative gain or nonpositive slope limit');
  if(!Number.isFinite(material.roughness)||!Number.isFinite(field.value)) throw new TypeError('invalid material or field value');
  // A=0 is an exact bypass. It does not resurrect any legacy incision layer.
  if(strength===0)return {...material,baseColor:[...material.baseColor],normal:[...material.normal],height:0};
  const nlen=Math.hypot(...material.normal);if(nlen===0)throw new RangeError('zero normal');
  const N=material.normal.map(v=>v/nlen),ndg=N.reduce((s,v,k)=>s+v*field.gradient[k],0);
  let g=field.gradient.map((v,k)=>(v-ndg*N[k])*strength*heightScale);
  const limit=Math.min(1,maxSlope/Math.max(1e-30,Math.hypot(...g)));g=g.map(v=>v*limit);
  let normal=N.map((v,k)=>v-g[k]),nl=Math.hypot(...normal);normal=normal.map(v=>v/nl);
  const centered=field.value-referenceValue;
  // PBR channel gains are adapter settings, NOT claimed measurements or author constants.
  const tint=Math.max(-.1,Math.min(.1,strength*colorAmount*centered));
  return {...material,normal,height:strength*heightScale*centered,
    baseColor:material.baseColor.map(v=>Math.max(0,Math.min(1,v*(1+tint)))),
    roughness:Math.max(.04,Math.min(1,material.roughness+strength*roughnessAmount*centered))};
}
