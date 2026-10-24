const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/START_HERE.html','utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(code);
const ctx={console,performance};vm.createContext(ctx);
vm.runInContext(code.slice(0,code.indexOf('const $=s=>'))+';this.API={StudyWorkshop,STUDY,CATALOG,shellMesh,spec,traceMesh};',ctx);
const {StudyWorkshop,STUDY,CATALOG,shellMesh,spec}=ctx.API;
const report={version:'09',catalog:[],tests:[],not_validated:['source dimensional datums','sculptural depth and backs','roof contacts','structural response','full buildings']};
const r={clear(){},add(mesh,items,type){assert(mesh.p.every(Number.isFinite));assert(mesh.n.every(Number.isFinite));assert(mesh.idx.every(i=>i<mesh.p.length/3));}};
const w=new StudyWorkshop(r),definitions=[];
for(const e of CATALOG){STUDY.id=e.id;STUDY.family=e.family;w.build({});definitions.push({definition:w.definition,objects:w.records.filter(r=>r.kind!=='floor')});report.catalog.push({id:e.id,objects:w.records.length,bounds:w.definition.generated_bounds_m,ms:Math.round(w.buildMs)});assert(w.records.length>1,e.id);}
for(const set of ['D7','L9'])for(const kind of ['pan','cover']){const mesh=shellMesh(kind,set),p=spec(set)[kind],xs=[],zs=[];for(let i=0;i<mesh.p.length;i+=3){xs.push(mesh.p[i]);zs.push(mesh.p[i+2]);}const width=Math.max(...xs)-Math.min(...xs),length=Math.max(...zs)-Math.min(...zs);assert(Math.abs(width-(p.w0||p.w))<1e-7);assert(Math.abs(length-(p.l||p.body+p.neck))<1e-7);if(kind==='cover'){const s=mesh.definition.sections;assert(s.length===4);assert(s[3][0]>s[2][0]);assert(s[2][1]<s[1][1]);}report.tests.push({set,kind,width,length,nonzero_distinct_neck:kind==='cover'});}
assert(CATALOG.every(e=>e.sources.length&&e.parts.length));
fs.writeFileSync(__dirname+'/OBJECT_DEFINITIONS.json',JSON.stringify({catalog:CATALOG,definitions},null,2));fs.writeFileSync(__dirname+'/GEOMETRY_QA.json',JSON.stringify(report,null,2));console.log(JSON.stringify({catalog:report.catalog.length,objects:report.catalog.reduce((n,e)=>n+e.objects,0),dimension_checks:report.tests.length,maxBuildMs:Math.max(...report.catalog.map(x=>x.ms))}));
