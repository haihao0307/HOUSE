'use strict';const C=require('./operators.js'),crypto=require('crypto'),fs=require('fs');const tests=[];
const check=(name,result,detail)=>{tests.push({name,passed:!!result,detail});if(!result)throw Error(name);};
const digest=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const delta=(a,b)=>{let d=0;for(let i=0;i<a.length;i++)d=Math.max(d,Math.abs(a[i]-b[i]));return d;};
let summaries=[];
try{
 for(const profile of['pan','cover']){
  const t=C.tile(profile,'test/'+profile,32017),m=C.mesh(t),again=C.mesh(t);check(profile+' deterministic mesh',digest(m.positions)===digest(again.positions));
  check(profile+' real relief exceeds 1mm candidate',m.metrics.topPeakToValley>.001,m.metrics.topPeakToValley);check(profile+' thickness floor',m.metrics.minThickness>=m.metrics.minimumAllowedThickness,m.metrics.minThickness);
  check(profile+' finite positions and normals',m.positions.every(Number.isFinite)&&m.normals.every(Number.isFinite));
  let lengths=true;for(let i=0;i<m.normals.length;i+=3)if(Math.abs(Math.hypot(...m.normals.slice(i,i+3))-1)>1e-5)lengths=false;check(profile+' recomputed unit geometry normals',lengths);
  const edges=new Map();let degenerate=0;for(let i=0;i<m.indices.length;i+=3){const tri=[...m.indices.slice(i,i+3)];if(new Set(tri).size!==3)degenerate++;for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b);edges.set(k,(edges.get(k)||0)+1);}}
  check(profile+' closed two-manifold indexed shell',!degenerate&&[...edges.values()].every(v=>v===2));
  check(profile+' all declared details sampled',Object.values(m.metrics.hitMap).every(n=>n>0));
  const noPores=structuredClone(t);noPores.parameters.pores=0;const mp=C.mesh(noPores);check(profile+' pore causes real vertex displacement',delta(m.positions,mp.positions)>.0002,delta(m.positions,mp.positions));check(profile+' pore cause controls cavity field',mp.cavities.every(v=>v===0));
  const noForm=structuredClone(t);noForm.parameters.forming=0;check(profile+' forming cause changes real geometry',delta(m.positions,C.mesh(noForm).positions)>.0002);
  const color=structuredClone(t);color.seeds.color++;check(profile+' color stream isolated from geometry',digest(C.mesh(color).positions)===digest(m.positions));
  const micro=structuredClone(t);micro.seeds.micro++;check(profile+' optical micro stream isolated from mesh',digest(C.mesh(micro).positions)===digest(m.positions));
  const child=C.tile(profile,'test/'+profile+'/child',32017);check(profile+' stable entity identity changes child',digest(C.mesh(child).positions)!==digest(m.positions));
  const wet=C.evolve(t,2*C.DAY),dry=C.evolve(t,6*C.DAY),future=C.evolve(t,50*C.DAY);check(profile+' drying lowers moisture',dry.wetness<wet.wetness);check(profile+' drying does not heal damage',dry.damage>=wet.damage);
  check(profile+' water budget accounted',Math.abs(future.budget.residual)<1e-10,future.budget);check(profile+' replay exact',JSON.stringify(future)===JSON.stringify(C.evolve(t,50*C.DAY)));
  for(const fps of[15,30,60]){let display=0;for(let i=0;i<fps;i++)display=(i+1)/fps;check(profile+' display '+fps+'fps selects same physical state',JSON.stringify(C.evolve(t,display*50*C.DAY))===JSON.stringify(future));}
  const off=C.evolve(t,50*C.DAY,{...C.historyDefaults,rain:0});check(profile+' rain off disables wetness and damage',off.wetness===0&&off.damage===0&&off.exposureDoseDays===0);
  const sheltered=C.evolve(t,50*C.DAY,C.historyDefaults,.3);check(profile+' shared history respects exposure',sheltered.wetness<future.wetness&&sheltered.exposureDoseDays<future.exposureDoseDays);
  summaries.push({profile,hash:digest(m.positions),metrics:m.metrics});
 }
 for(const test of[()=>C.tile('bad'),()=>C.tile('pan','a',NaN),()=>C.evolve(C.tile(),-1),()=>C.evolve(C.tile(),3,{...C.historyDefaults,solverStepSeconds:0}),()=>C.mesh(C.tile(),{nu:999,nv:3})]){let rejected=false;try{test();}catch{rejected=true;}check('reject invalid core input',rejected);}
}catch(error){tests.push({name:'unhandled',passed:false,error:String(error)});process.exitCode=1;}
const r={version:C.VERSION,tests,summaries,allPassed:tests.every(t=>t.passed),visualApproved:false,productionApproved:false};fs.writeFileSync(process.env.QA_OUT||'core-report.json',JSON.stringify(r,null,2));console.log(JSON.stringify({allPassed:r.allPassed,count:tests.length,summaries:summaries.map(s=>({profile:s.profile,relief:s.metrics.topPeakToValley,thickness:s.metrics.minThickness}))}));
