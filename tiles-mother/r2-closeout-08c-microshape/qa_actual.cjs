const fs=require('fs');const source=fs.readFileSync(__dirname+'/qa_geometry.cjs','utf8');const lib=Function('__dirname','require',source.slice(0,source.indexOf('for(const sid of'))+'return {A,S,G,mesh};')(__dirname,require);const {A,S,G,mesh}=lib;
function hash(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967295}
const sid=n=>3+hash(n)*97,results=[];
for(const strength of [0,3]){
 const pan=mesh('pan',sid(314159),strength,1),cover=mesh('cover',sid(314159+389),strength,1);
 results.push({...G.gap('actual default row0 col0 pan to cover',pan,A.tileModel('pan',-S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase)),strength});
 results.push({...G.gap('actual default row0 col0 left rafter',A.timber(),A.model(-S.spacing*.5,0,0,0,0,[S.rafterRadius,S.rafterRadius,7*S.step+.06]),pan,A.tileModel('pan',0,S.panY,-3*S.step)),strength});
}
let report={scope:'Actual default roof seed314159, row0 col0 and cover seed314548; local roof frame before common rigid slope transform. Left rafter at first-row position.',results,passed:results.every(r=>r.pass),browserVerified:false};fs.writeFileSync(__dirname+'/ACTUAL_CONTACT_QA.json',JSON.stringify(report,null,2));console.log(report);
