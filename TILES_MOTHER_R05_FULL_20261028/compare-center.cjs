const fs=require('fs'),Sheet=require('./route-a.cjs'),L=require('./library.json'),J=require('./tile-end-object.cjs'),S=require('./tile-source-curves.json');
let h=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09n-20261028/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
code=code.replace('let joinedArea=common.reduce','G.debugCenter=centerY;let joinedArea=common.reduce');
const Q=Function('const settings={micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48};'+code.slice(0,code.indexOf('const $=s=>'))+';return {STUDY,integratedEnd,roundEnd09H,SOURCE_CURVES}')();
for(const id of ['seal','seeds','flower']){
 Q.STUDY.id=id;Q.STUDY.family='pattern';Q.STUDY.set='L9';const old=Q.integratedEnd(id,'L9').debugCenter,e=Sheet.instantiate(L,'cover-L9'),nw=J.coverCenter(e,S[id],.052).center;
 console.log(id,'old',old,'new',nw,'difference_mm',(nw-old)*1000)
}
