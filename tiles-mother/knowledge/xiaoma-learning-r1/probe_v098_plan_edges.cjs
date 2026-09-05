'use strict';
/**
 * Numeric probe of ONLY the intact plan-boundary x/z expressions in V0.9.8.
 * Source: HOUSE@c715ad31948d71b662c60eefa02126973d794fb6
 * tiles-mother/v098/source/app.js, surfacePoint(), damageClass=0.
 * Algebraic reduction, not execution of the full app, THREE, or Blender.
 * y, pores and shading are excluded because they do not affect these x/z
 * expressions for damageClass=0. This does not assess visual quality.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth01=t=>{t=clamp(t);return t*t*(3-2*t);};
const smooth=(a,b,x)=>smooth01((x-a)/Math.max(1e-9,b-a));
const hash32=n=>{n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;};
const hash01=(...v)=>{let h=2166136261;for(const n of v){h^=(Number(n)>>>0);h=Math.imul(h,16777619);}return hash32(h)/4294967295;};
function noise2(x,y,seed=0){const xi=Math.floor(x),yi=Math.floor(y),tx=smooth01(x-xi),ty=smooth01(y-yi);const h=(a,b)=>hash01(a,b,seed);return lerp(lerp(h(xi,yi),h(xi+1,yi),tx),lerp(h(xi,yi+1),h(xi+1,yi+1),tx),ty);}
const profiles={pan:{length:.238,widthEave:.242,widthRidge:.221},cover:{length:.222,widthEave:.115,widthRidge:.090}};
function boundary(kind,s,t,seed){
  assert.ok(kind in profiles); assert.ok(Number.isFinite(s)&&s>=-1&&s<=1);assert.ok(Number.isFinite(t)&&t>=0&&t<=1);
  const p=profiles[kind],w=lerp(p.widthEave,p.widthRidge,t);let x=s*w*.5;const z=(t-.5)*p.length;
  const edge=smooth(.80,1,Math.abs(s)),wear=.22;
  const scallop=(kind==='pan'?(.0004+.0029*wear):(.00025+.0009*wear))*(.22+.78*smooth(.30,.82,noise2(t*34,2,seed+344)));
  x-=Math.sign(s)*edge*scallop;
  return {x,z};
}
const rows=[];
for(const kind of Object.keys(profiles))for(const seed of [1,7,314159,271828,4294967295]){
  let maxMirrorError=0;const endRanges=[];
  for(let j=0;j<=100;j++){const t=j/100;maxMirrorError=Math.max(maxMirrorError,Math.abs(boundary(kind,-1,t,seed).x+boundary(kind,1,t,seed).x));}
  for(const t of [0,1]){const zs=Array.from({length:101},(_,i)=>boundary(kind,i/50-1,t,seed).z);endRanges.push(Math.max(...zs)-Math.min(...zs));}
  assert.equal(maxMirrorError,0);assert.deepEqual(endRanges,[0,0]);
  rows.push({kind,seed,damageClass:0,samplesPerEdge:101,maxPlanMirrorErrorMm:maxMirrorError*1000,eaveZRangeMm:endRanges[0]*1000,ridgeZRangeMm:endRanges[1]*1000});
}
const report={schema:'tiles-edge-source-probe-v1',sourceCommit:'c715ad31948d71b662c60eefa02126973d794fb6',sourcePath:'tiles-mother/v098/source/app.js',runtime:process.version,method:'algebraic reduction of intact x/z expressions; not full-app execution',cases:rows,conclusions:{intactLeftRightPlanInsetExactlyShared:true,frontBackPlanEdgesFixedZ:true},excluded:['y curvature and three-dimensional edge symmetry','damageClass 1/2 corner chips','mesh UV normals and contacts','browser visual review','Blender execution','reference image reconstruction'],productionChanged:false,visualApproved:false,productionApproved:false};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:rows.length,assertionsPassed:30,scope:report.method},null,2));
