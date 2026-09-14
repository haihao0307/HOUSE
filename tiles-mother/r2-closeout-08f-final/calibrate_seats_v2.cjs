'use strict';
const fs0=require('fs');
const path0=require('path');
const H0=__dirname;
const base=fs0.readFileSync(path0.join(H0,'qa_geometry.cjs'),'utf8');
const marker='for(const strength of [0,1.6,3])';
const cut=base.indexOf(marker);
if(cut<0) throw new Error('qa_geometry calibration marker not found');
const prefix=base.slice(0,cut);
const tail=String.raw`
const sampleSeeds=[314159,271828,161803];
const targetMm=.02;
const wood=A.timber();
let P={...S};
const clampStep=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function tm(kind,x,y,z,p=P){
  const roll=kind==='pan'?p.panRoll:p.coverRoll;
  const angle=kind==='pan'?p.panAngle:p.coverAngle;
  return A.M.mul(A.M.translate(x,y,z),A.M.mul(A.M.rz(roll),A.M.rx(angle)));
}
function avg(xs){return xs.reduce((a,b)=>a+b,0)/xs.length}
function rafterMeans(p){
  const L=[],R=[];
  for(const seed of sampleSeeds){
    const pan=mesh('pan',sid(seed),0,1);
    const pm=tm('pan',0,p.panY,-3*p.step,p);
    L.push(G.gap('left',wood,A.model(-p.spacing*.5,0,0,0,0,[p.rafterRadius,p.rafterRadius,7*p.step+.06]),pan,pm).minGapMm);
    R.push(G.gap('right',wood,A.model( p.spacing*.5,0,0,0,0,[p.rafterRadius,p.rafterRadius,7*p.step+.06]),pan,pm).minGapMm);
  }
  return {left:avg(L),right:avg(R),leftSamples:L,rightSamples:R};
}
function coverMeans(p){
  const L=[],R=[];
  for(const seed of sampleSeeds){
    const panL=mesh('pan',sid(seed),0,1);
    const panR=mesh('pan',sid(seed+1777),0,1);
    const cover=mesh('cover',sid(seed+389),0,1);
    const cm=tm('cover',0,p.coverY,p.coverPhase,p);
    L.push(G.gap('cover-left',panL,tm('pan',-p.spacing*.5,p.panY,0,p),cover,cm).minGapMm);
    R.push(G.gap('cover-right',panR,tm('pan', p.spacing*.5,p.panY,0,p),cover,cm).minGapMm);
  }
  return {left:avg(L),right:avg(R),leftSamples:L,rightSamples:R};
}
function solvePair(kind,measure,p){
  const history=[];
  for(let it=0;it<4;it++){
    const g=measure(p),eps=.0005;
    const pp={...p},pm={...p};
    const rk=kind==='pan'?'panRoll':'coverRoll',yk=kind==='pan'?'panY':'coverY';
    pp[rk]+=eps;pm[rk]-=eps;
    const gp=measure(pp),gm=measure(pm);
    const dL=(gp.left-gm.left)/(2*eps),dR=(gp.right-gm.right)/(2*eps);
    const fL=g.left-targetMm,fR=g.right-targetMm,den=dR-dL;
    if(!Number.isFinite(den)||Math.abs(den)<1e-6)throw new Error(kind+' seating derivative singular');
    let dr=-(fR-fL)/den;
    dr=clampStep(dr,-.03,.03);
    let dy=-(fL+dL*dr)/1000;
    dy=clampStep(dy,-.006,.006);
    history.push({iteration:it,before:g,dLeftMmPerRad:dL,dRightMmPerRad:dR,deltaRoll:dr,deltaYmm:dy*1000});
    p={...p,[rk]:p[rk]+dr,[yk]:p[yk]+dy};
    if(Math.max(Math.abs(fL),Math.abs(fR))<.002)break;
  }
  return {params:p,history,final:measure(p)};
}
const panSolve=solvePair('pan',rafterMeans,P);P=panSolve.params;
const coverSolve=solvePair('cover',coverMeans,P);P=coverSolve.params;
const calibrationResult={version:'08F',method:'Deterministic bilateral rigid-seat solve. Pan y/roll are solved against both rafters; cover y/roll are solved against the two actual adjacent pan identities. Geometry is not deformed by this solver.',sampleSeeds,targetMm,sourceSeats:S,solvedSeats:P,panSolve,coverSolve,visualApproved:false,productionApproved:false};
let html=fs.readFileSync(H+'/START_HERE.html','utf8');
const re=/const SEATS=Object\.freeze\((\{[^\n]+\})\);/;
if(!re.test(html))throw new Error('SEATS literal not found for calibration');
html=html.replace(re,'const SEATS=Object.freeze('+JSON.stringify(P)+');');
fs.writeFileSync(H+'/START_HERE.html',html);
fs.writeFileSync(H+'/SEAT_CALIBRATION.json',JSON.stringify(calibrationResult,null,2));
console.log(JSON.stringify({solvedSeats:P,pan:panSolve.final,cover:coverSolve.final},null,2));
`;
eval(prefix+tail);
