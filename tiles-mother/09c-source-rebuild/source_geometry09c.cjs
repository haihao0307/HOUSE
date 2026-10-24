const fs=require('fs'),vm=require('vm');
const h=fs.readFileSync(__dirname+'/START_HERE.html','utf8'),code=h.match(/<script>([\s\S]*?)<\/script>/)[1];
const Q=new Function('const settings={micStrength:1,micScale:1};\n'+code.slice(0,code.indexOf('const $=s=>'))+'\nreturn {STUDY,StudyWorkshop,CATALOG,ROOF_CACHE,SOURCE_FIT_CACHE09C};')();
const w=new Q.StudyWorkshop({clear(){},add(){}}),report={version:'09C',entries:[],pass:false};
for(const e of Q.CATALOG){if(!['frame','house','timber','roof','masonry'].includes(e.family)||['joinery','eaves','roofPatch'].includes(e.id))continue;
 Q.STUDY.id=e.id;Q.STUDY.family=e.family;w.build({});
 let bad=0;for(const g of w.groups.values())if(![...g.mesh.p].every(Number.isFinite)||g.items.some(q=>!q.m.every(Number.isFinite)))bad++;
 let row={id:e.id,objects:w.records.length,bad,roofFits:w.definition.sourceRoofFits||[],definition:w.definition};report.entries.push(row);
 fs.writeFileSync(__dirname+'/roof_fits09c.json',JSON.stringify([...Q.SOURCE_FIT_CACHE09C]));fs.writeFileSync(__dirname+'/roof_seats09c.json',JSON.stringify([...Q.ROOF_CACHE]));fs.writeFileSync(__dirname+'/SOURCE_GEOMETRY09C.json',JSON.stringify(report,null,2));
 console.log(e.id,row.objects,'bad',bad,'max roof endpoint',Math.max(0,...row.roofFits.map(x=>x.endpoint_error_m)),'contact',row.roofFits.every(x=>x.roof_contact));
}
report.pass=report.entries.every(e=>e.objects>0&&!e.bad&&e.roofFits.every(r=>r.endpoint_error_m<.0005&&r.roof_contact&&(r.purlin_rafter_bearings||[]).every(b=>b.gap_m!==null&&Math.abs(b.gap_m)<.0005)));
fs.writeFileSync(__dirname+'/SOURCE_GEOMETRY09C.json',JSON.stringify(report,null,2));console.log('PASS',report.pass);
