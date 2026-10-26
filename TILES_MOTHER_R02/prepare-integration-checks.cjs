const fs=require('fs'),target='G:/HOUSE/brick-tiles-mother-09i-20261026';
const settings='micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48';
for(let name of ['qa','contact-fold','support']){
 let s=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09h-20261026/'+name+'09h.cjs','utf8').replaceAll('micStrength:1,micScale:1',settings).replaceAll("version:'09H'","version:'09I'").replaceAll('QA09H.json','QA09I.json').replaceAll('FOLD_CONTACT09H.json','FOLD_CONTACT09I.json').replaceAll('SUPPORT09H.json','SUPPORT09I.json').replaceAll('roof-cache09h.json','roof-cache09i.json').replaceAll('stitch-cache09h.json','stitch-cache09i.json');
 fs.writeFileSync(target+'/'+name+'09i.cjs',s);
}
