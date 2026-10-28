const fs=require('fs'),util=require('util'),Pack=require('./record-compact.cjs'),h=fs.readFileSync('G:/HOUSE/brick-tiles-mother-09n-20261028/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const Q=Function('const settings={micStrength:1,micScale:1,micColor:.3,micRough:.3,brightness:.96,warmth:.36,patina:.38,wet:0,variation:.58,core:.48};'+code.slice(0,code.indexOf('const $=s=>'))+';return {STUDY,StudyWorkshop,CATALOG,TILE_RULE_MANIFEST}')();
const cases=[];for(const id of ['tileSystem','eaves','ridgeD5','mainHouse']){
 Q.STUDY.id=id;Q.STUDY.family=Q.CATALOG.find(x=>x.id===id).family;const w=new Q.StudyWorkshop({clear(){},add(){}});w.build({});let result=Pack.pack({definition:w.definition,records:w.records,study:Q.STUDY,ruleManifest:Q.TILE_RULE_MANIFEST}),missing=0;
 for(let i=0;i<w.records.length;i++){let {geometryRef,time,location,...rest}=result.objects[i],original=w.records[i],recovered={...rest,geometry:result.geometryTemplates[geometryRef]};if(!util.isDeepStrictEqual(recovered,original))missing++;}
 const stats=Pack.stats(result);cases.push({id,records:w.records.length,lostFields:missing,...stats,pass:missing===0});console.log(id,'records',w.records.length,'lost',missing,'tile range',JSON.stringify(stats.tiles),'templates',stats.templatesCount,'bytes',stats.sceneBytes);if(missing)process.exitCode=1;
}

fs.writeFileSync('PACK_VALIDATION.json',JSON.stringify({version:'09N',pass:cases.every(x=>x.pass),cases,scope:'Round-trip reconstruction of records for four default scenes; not all parameter states.'},null,2));
