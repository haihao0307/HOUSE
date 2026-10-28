'use strict';
const fs=require('fs'),h=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09n-20261028/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const Q=Function('const settings={micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48};'+code.slice(0,code.indexOf('const $=s=>'))+';return {settings,ridgeStackFit09N,TilesRolled,TilesFlat,SHEET_LIBRARY,TILE_INSTANCES}')();
const find=id=>Q.TILE_INSTANCES.instances.find(x=>x.id===id).variables,a=find('ridge-eye-L7'),b=find('ridge-board-L7'),out=[];
for(const [strength,scale] of [[0,1],[1,1],[3,.5],[3,3]]){
 Q.settings.micStrength=strength;Q.settings.micScale=scale;const fit=Q.ridgeStackFit09N();
 const eye=Q.TilesRolled.create({library:Q.SHEET_LIBRARY,outer:a.outer_m,inner:a.inner_m,length:a.length_m,angle:a.angle_rad,geometryGain:a.geometryGain,strength,scale}),board=Q.TilesFlat.create({library:Q.SHEET_LIBRARY,width:b.width,length:b.length,thickness:b.thickness,geometryGain:b.geometryGain,strength,scale});
 let high=-Infinity,low=Infinity,top=-Infinity;for(let i=0;i<10000;i++){let u=2*((i*.6180339887498949)%1)-1,t=(i*.414213562373095)%1;high=Math.max(high,eye.position(u,t,0)[1]);low=Math.min(low,board.position(u,t,1)[1]);top=Math.max(top,board.position(u,t,0)[1]);}
 let eyeGap=fit.boardY+low-(.075+high),boardGap=fit.lowerY-(fit.boardY+top);out.push({strength,scale,samples:10000,eyeGap_m:eyeGap,boardGap_m:boardGap,pass:eyeGap>=0&&boardGap>=0});
}
const report={version:'09N',pass:out.every(x=>x.pass),cases:out,scope:'10,000 independent quasi-random samples per case; global y-bound separation, not proof at all points or physical structure.'};fs.writeFileSync('RIDGE_STACK_VALIDATION.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
