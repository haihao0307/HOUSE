import assert from 'node:assert/strict';
import {SCALES,coordinates,layer,evaluateXi,evaluate,bindPBR} from './microscope-core.mjs';
import fs from 'node:fs';
const checks=[];
function test(name,fn){fn();checks.push({name,passed:true});}
const almost=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b} (tol ${e})`);
const points=[[.3,1.1,.2],[-1.2,.7,-.4],[1.2,-.8,.1],[.1,.3,1.7]];
test('exact 17 scales 1 to 65536',()=>assert.deepEqual(SCALES,Array.from({length:17},(_,i)=>2**i)));
test('user coordinate convention no extra y shift',()=>{const p=[3,4,5],x=coordinates(p);almost(x[0],Math.log2(Math.sqrt(50))-2);almost(x[1],-5/Math.sqrt(50));almost(x[2],Math.atan2(3,4));});
test('prefix increment is original C_s/s, not renormalized',()=>{for(const p of points){const x=coordinates(p);for(let n=0;n<17;n++)almost(evaluateXi(x,n+1).value-evaluateXi(x,n).value,layer(x,2**n));}});
test('expanded and original swizzle-dot formulas agree',()=>{for(const p of points){let x=coordinates(p),sum=0;for(const s of SCALES){const c=x.map(v=>Math.cos(v*s));sum+=Math.cos([c[2],c[1],c[1]].reduce((a,v,i)=>a+v*[c[0],c[1],c[0]][i],0))/s;}almost(evaluateXi(x).value,sum);}});
test('all Xi derivatives agree with finite difference (levels 1..10)',()=>{for(const p of points){const x=coordinates(p);for(const n of [1,3,6,10]){const a=evaluateXi(x,n);for(let k=0;k<3;k++){const h=1e-7,x1=[...x],x0=[...x];x1[k]+=h;x0[k]-=h;almost(a.gradientXi[k],(evaluateXi(x1,n).value-evaluateXi(x0,n).value)/(2*h),2e-6);}}}});
test('position derivative includes exact domain Jacobian',()=>{for(const p of points){const a=evaluate(p,{levels:8});for(let k=0;k<3;k++){const h=1e-7,p1=[...p],p0=[...p];p1[k]+=h;p0[k]-=h;almost(a.gradient[k],(evaluate(p1,{levels:8}).value-evaluate(p0,{levels:8}).value)/(2*h),2e-5);}}});
test('angular +/-pi seam agrees through all 17 integer scales',()=>{const x=[1.2,.45,Math.PI],y=[1.2,.45,-Math.PI];almost(evaluateXi(x).value,evaluateXi(y).value,1e-10);});
test('determinism and input immutability',()=>{const p=[.3,1.1,.2],copy=[...p],a=evaluate(p);for(let i=0;i<10;i++)assert.deepEqual(evaluate(p),a);assert.deepEqual(p,copy);});
test('no camera or frame argument in material identity',()=>{const src=fs.readFileSync(new URL('./microscope-core.mjs',import.meta.url),'utf8');assert.ok(!/iTime|iFrame|uEye|gl_FragCoord|cameraPosition/.test(src));});
test('exact A=0 PBR bypass',()=>{const m={baseColor:[.14,.15,.15],roughness:.83,normal:[0,1,0],metallic:0};const result=bindPBR(m,evaluate(points[0]),{strength:0,heightScale:.001});assert.deepEqual(result,{...m,height:0});});
test('zero height gain leaves normal unchanged, color is independent',()=>{const m={baseColor:[.14,.15,.15],roughness:.83,normal:[0,1,0]};const r=bindPBR(m,evaluate(points[0]),{strength:1,heightScale:0,colorAmount:.03});assert.deepEqual(r.normal,m.normal);assert.notDeepEqual(r.baseColor,m.baseColor);});
test('PBR outputs finite, bounded and slope-capped',()=>{const m={baseColor:[.14,.15,.15],roughness:.83,normal:[0,1,0]};for(const p of points)for(const strength of [0,1,4,10]){const r=bindPBR(m,evaluate(p),{strength,heightScale:.003,colorAmount:.03,roughnessAmount:.1,maxSlope:.7});assert.ok(r.baseColor.every(x=>x>=0&&x<=1));assert.ok(r.roughness>=.04&&r.roughness<=1);almost(Math.hypot(...r.normal),1);assert.ok(r.normal[1]>=1/Math.sqrt(1+.7*.7)-1e-12);}});
test('singularities rejected rather than filled with random values',()=>{assert.throws(()=>coordinates([0,0,0]));assert.throws(()=>coordinates([0,0,1]));});
test('invalid controls rejected',()=>{assert.throws(()=>evaluateXi([1,2,3],18));assert.throws(()=>evaluateXi([1,2,3],3,[1]));assert.throws(()=>layer([1,2,3],0));assert.throws(()=>coordinates([NaN,0,1]));});
const result={status:'passed',checks,passed:checks.length,failed:0,
 scope:'CPU core and PBR adapter only; no complete page/browser/visual verification',
 maxLevels:17,rotationNodeNumericsVerified:false,publicBrowserVerified:false,visualApproved:false,productionApproved:false};
fs.writeFileSync(new URL('./CPU_TEST_RESULTS.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
