'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createRay}=require('./direct-ray.cjs'),A=require('./route-a.cjs'),B=require('./route-b.cjs'),lib=require('./library.json');
const eyes=[[-.52,.55,.72],[.6,.3,.55],[0,.8,.2],[-.8,.15,.3]];let tested=0,misses=[],maxResidual=0,maxDistanceDifference=0;
for(const name of ['cover-L9','pan-L9','cover-D7','pan-D7'])for(const eye of eyes){
 const a=A.instantiate(lib,name),b=B.instantiate(lib,name),ra=createRay(a),rb=createRay(b);
 for(let i=0;i<100;i++){
  let u=-.9+1.8*(i%10)/9,t=.05+.9*Math.floor(i/10)/9,p=a.position(u,t,0),target=Math.hypot(...p.map((v,j)=>v-eye[j])),dir=p.map((v,j)=>(v-eye[j])/target),x=ra.hit(eye,dir),y=rb.hit(eye,dir);tested++;
  if(!x||!y||x.distance>target+1e-5||y.distance>target+1e-5){misses.push({name,eye,u,t,a:x?.distance??null,b:y?.distance??null,target});continue}
  maxResidual=Math.max(maxResidual,x.residual,y.residual);maxDistanceDifference=Math.max(maxDistanceDifference,Math.abs(x.distance-y.distance));
 }
}
const away=createRay(A.instantiate(lib,'cover-L9')).hit([10,10,10],[1,0,0]);assert.equal(away,null);
const source=fs.readFileSync(__dirname+'/direct-ray.cjs'),hash=crypto.createHash('sha256').update(source).digest('hex');
const report={pass:misses.length===0,testedRays:tested,routes:2,target:'upper surface material points; nearest returned hit must be no farther than the target',maxResidual_m:maxResidual,maxABRayDistanceDifference_m:maxDistanceDifference,misses,sourceSha256:hash,limits:['Finite targets and four camera positions; not proof for all rays, side views, materials or all input parameters','Uses numeric iterative function queries, not saved point data or triangle geometry','CPU direct-ray preview has limited pixel resolution and is not 09H visual acceptance']};fs.writeFileSync(__dirname+'/DIRECT_RAY_VALIDATION.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
