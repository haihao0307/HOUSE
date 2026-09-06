'use strict';
// Executes only existing lifecycle/integrateTimber functions, without rendering.
const fs=require('node:fs'), vm=require('node:vm'), crypto=require('node:crypto'), path=require('node:path');
const appPath=path.resolve(process.argv[2]||path.join(__dirname,'../../v0910/source/app.js'));
const src=fs.readFileSync(appPath,'utf8');
const sha=crypto.createHash('sha256').update(src).digest('hex');
if(sha!=='d942354f4e6207081a8e81a9760c7ab136c994ad7ca9cf0b9484b165549a801d')throw Error('Unreviewed app identity');
function extract(name){const a=src.indexOf('function '+name+'(');if(a<0)throw Error(name);let i=src.indexOf('{',a),depth=1,j=i+1;for(;depth&&j<src.length;j++){if(src[j]==='{')depth++;if(src[j]==='}')depth--;}return src.slice(a,j);}
const context={console};vm.createContext(context);
vm.runInContext(src.slice(0,src.indexOf('const threeText'))+'\nconst state={year:0,seed:314159,care:"abandoned"};\n'+extract('lifecycle')+'\n'+extract('integrateTimber')+'\nthis.audit=(year,rows,cols,care)=>{state.year=year;state.care=care;const m=integrateTimber(rows,cols);return {year,rows,cols,care,damagedPan:m.panStates.filter(s=>s.damageClass>0).length,missingPanBeforePlacement:m.panStates.filter(s=>s.missing).length,maxRafterLoss:Math.max(...m.loss),maxBeamLoss:Math.max(...m.beamLoss),segmentsAboveRafterBreakThreshold:Array.from(m.loss).filter(x=>x>.48).length,segmentsAboveBeamBreakThreshold:Array.from(m.beamLoss).filter(x=>x>.20).length};};',context);
const cases=[];for(const [rows,cols] of [[6,4],[20,22]])for(const year of [0,3,5,10,15,50,100])cases.push(context.audit(year,rows,cols,'abandoned'));
const report={sourceCommit:'48497aec7a903f4d0d151e106c6c67d390eddf55',sourcePath:'tiles-mother/v0910/source/app.js',sourceSHA256:sha,runtime:process.version,scope:'Unmodified historical lifecycle and integrateTimber only. No seating/render/physics execution.',cases,notes:['Threshold counts are segment samples, not counts of final broken meshes.','Shader is already procedural: generated detail DataTextures coexist with analytic noise.','No state, UI, or production source changed.']};
fs.writeFileSync(path.join(__dirname,'BASELINE_AUDIT.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(cases.filter(c=>c.cols===22),null,2));
