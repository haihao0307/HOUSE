'use strict';
const fs0=require('fs');
const path0=require('path');
const H0=__dirname;
const base=fs0.readFileSync(path0.join(H0,'qa_geometry.cjs'),'utf8');
const marker='for(const strength of [0,1.6,3])';
const cut=base.indexOf(marker);
if(cut<0) throw new Error('qa_geometry matrix insertion marker not found');
const prefix=base.slice(0,cut);
const program=prefix+String.raw`
const seeds=[314159,271828,161803];
const strengths=[0,1.6,3];
const toleranceMm=.05;
const supportMaxGapMm=.5;
const matrix={
  version:'08F',
  method:'Expanded CPU double precision projected-triangle matrix on the actual 08F self-contained page. Three deterministic roof identity neighborhoods x three Microscope strengths. Adjacent pans use the real +1777 identity stride from roof generation. This is representative, not an exhaustive proof over every seed or arbitrary damage state.',
  seeds,
  strengths,
  toleranceMm,
  supportMaxGapMm,
  checks:[]
};
function record(group,name,lower,lm,upper,um,support,seed,strength){
  const r=G.gap(name,lower,lm,upper,um);
  const intersects=r.trianglePairs>0 && r.minGapMm!==null;
  const noPenetration=intersects && r.minGapMm>=-toleranceMm;
  const supportClose=!support || (intersects && r.minGapMm<=supportMaxGapMm);
  const out={group,...r,support,seed,strength,intersects,noPenetration,supportClose,pass:noPenetration&&supportClose};
  matrix.checks.push(out);
  return out;
}
const wood=A.timber();
for(const strength of strengths){
  for(const seed of seeds){
    const pan=mesh('pan',sid(seed),strength,1);
    const panRight=mesh('pan',sid(seed+1777),strength,1);
    const cover=mesh('cover',sid(seed+389),strength,1);
    const panNext=mesh('pan',sid(seed+97),strength,1);
    const coverNext=mesh('cover',sid(seed+486),strength,1);
    record('pan-cover','cover on left pan',pan,A.tileModel('pan',-S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase),true,seed,strength);
    record('pan-cover','cover on right adjacent pan',panRight,A.tileModel('pan', S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase),true,seed,strength);
    record('rafter-pan','left rafter on pan',wood,A.model(-S.spacing*.5,0,0,0,0,[S.rafterRadius,S.rafterRadius,7*S.step+.06]),pan,A.tileModel('pan',0,S.panY,-3*S.step),true,seed,strength);
    record('rafter-pan','right rafter on pan',wood,A.model( S.spacing*.5,0,0,0,0,[S.rafterRadius,S.rafterRadius,7*S.step+.06]),pan,A.tileModel('pan',0,S.panY,-3*S.step),true,seed,strength);
    record('longitudinal','pan longitudinal overlap',pan,A.tileModel('pan',0,S.panY,0),panNext,A.tileModel('pan',0,S.panY,S.step),false,seed,strength);
    record('longitudinal','cover longitudinal overlap',cover,A.tileModel('cover',0,S.coverY,S.coverPhase),coverNext,A.tileModel('cover',0,S.coverY,S.coverPhase+S.step),false,seed,strength);
  }
}
matrix.pass=matrix.checks.every(x=>x.pass);
matrix.failures=matrix.checks.filter(x=>!x.pass);
matrix.summary={
  checks:matrix.checks.length,
  passed:matrix.checks.filter(x=>x.pass).length,
  failed:matrix.failures.length,
  minGapMm:Math.min(...matrix.checks.filter(x=>x.minGapMm!==null).map(x=>x.minGapMm)),
  maxSupportGapMm:Math.max(...matrix.checks.filter(x=>x.support&&x.minGapMm!==null).map(x=>x.minGapMm))
};
fs.writeFileSync(H+'/CONTACT_MATRIX_QA.json',JSON.stringify(matrix,null,2));
console.log(JSON.stringify(matrix.summary,null,2));
if(!matrix.pass){
  console.error(JSON.stringify(matrix.failures,null,2));
  process.exitCode=2;
}
`;
eval(program);
