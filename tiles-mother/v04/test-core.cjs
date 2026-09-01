'use strict';
const C=require('./operators.js'),assert=require('node:assert/strict'),fs=require('node:fs');
const tests=[];function check(name,fn){try{const detail=fn();tests.push({name,passed:true,detail});}catch(e){tests.push({name,passed:false,error:e.message});}}
function same(a,b){assert.equal(Buffer.compare(Buffer.from(a.buffer),Buffer.from(b.buffer)),0);}
const rows={};
for(const family of ['pan','cover']){
 const t=C.tile(family,'single/'+family+'/0',32017),m=C.mesh(t);rows[family]=m.metrics;
 check(family+' deterministic actual vertex buffers',()=>same(m.positions,C.mesh(t).positions));
 check(family+' finite output',()=>assert.ok(m.positions.every(Number.isFinite)));
 check(family+' positive residual thickness',()=>assert.ok(m.metrics.minThickness>=m.metrics.minimumAllowedThickness));
 check(family+' visible geometry amplitude',()=>assert.ok(m.metrics.topPeakToValley>.001));
 check(family+' each event reaches vertices',()=>assert.ok(Object.values(m.metrics.hitMap).every(x=>x>=8)));
 check(family+' closed manifold indexed shell',()=>{const edges=new Map();for(let i=0;i<m.indices.length;i+=3){const tri=Array.from(m.indices.slice(i,i+3));for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b),r=edges.get(k)||[0,0];r[0]++;r[1]+=a<b?1:-1;edges.set(k,r);}}assert.ok([...edges.values()].every(x=>x[0]===2&&x[1]===0));return {edgeCount:edges.size};});
 check(family+' real cavity ablation affects front and not back',()=>{const a=C.tile(family,t.id,t.master);a.parameters.pores=0;const other=C.mesh(a);const n=m.positions.length/6;same(m.positions.slice(n*3),other.positions.slice(n*3));assert.ok(m.positions.some((x,i)=>Math.abs(x-other.positions[i])>.0004));});
 check(family+' color namespace leaves actual geometry unchanged',()=>{const a=C.tile(family,t.id,t.master);a.seeds.color++;same(m.positions,C.mesh(a).positions);});
 check(family+' family defaults never mutated',()=>{const a=C.tile(family,t.id,t.master);a.dimensions.thickness*=2;assert.notEqual(a.dimensions.thickness,C.profiles[family].thickness);});
 check(family+' master changes actual surface',()=>assert.notEqual(C.fingerprint(m.positions),C.fingerprint(C.mesh(C.tile(family,t.id,32018)).positions)));
 check(family+' history replay exact',()=>assert.deepEqual(C.evolve(t,19.75*86400),C.evolve(t,19.75*86400)));
 check(family+' rewind replay restores earlier state',()=>{const early=C.evolve(t,5*86400);C.evolve(t,80*86400);assert.deepEqual(early,C.evolve(t,5*86400));});
 check(family+' wet dry cycle preserves damage',()=>{const wet=C.evolve(t,2*86400),dry=C.evolve(t,6*86400);assert.ok(dry.wetness<wet.wetness);assert.ok(dry.damage>=wet.damage);});
 check(family+' declared normalized water budget closes',()=>{const state=C.evolve(t,120*86400);assert.ok(Math.abs(state.budget.residual)<1e-10);return state.budget;});
 check(family+' common moisture cause changes color and roughness',()=>{const f=C.field(.1,.1,t,C.events(t));const a=C.appearance(.1,.1,t,C.evolve(t,0),f),b=C.appearance(.1,.1,t,C.evolve(t,2*86400),f);assert.notDeepEqual(a.linearColor,b.linearColor);assert.notEqual(a.roughness,b.roughness);});
 check(family+' changing light metadata cannot mutate source',()=>{const a=JSON.stringify(t);const display={key:5,rim:1};display.key=0;assert.equal(JSON.stringify(t),a);});
}
check('adding unrelated entity preserves stable identity',()=>{const a=C.tile('pan','roof/pan/0/0',91);C.tile('cover','roof/cover/3/5',91);assert.deepEqual(C.tile('pan','roof/pan/0/0',91),a);});
check('invalid clocks and history rejected',()=>{assert.throws(()=>C.evolve(C.tile(),-1));assert.throws(()=>C.evolve(C.tile(),1,{solverStepSeconds:-1}));assert.throws(()=>C.evolve(C.tile(),Infinity));});
const report={schema:'tiles-study-v04-core-tests',version:C.VERSION,tests,rows,allPassed:tests.every(t=>t.passed),visualApproved:false,productionApproved:false,limitations:['Manifold edge incidence and bounded thickness do not prove absence of every self-intersection.','No measured micro-height or calibrated aging rate.','CPU test is separate from browser image validation.']};fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/core-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.allPassed)process.exit(1);
