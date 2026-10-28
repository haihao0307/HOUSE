'use strict';
// Compact runtime records by storing each full rule/recipe definition once.
// This preserves every original field and never stores generated mesh buffers.
function pack({definition,records,study,ruleManifest}){
 if(!definition||!Array.isArray(records)||!study)throw Error('Missing scene records');
 const map=new Map(),templates={},objects=[];
 for(const record of records){
  const {geometry,...rest}=record,key=JSON.stringify(geometry??null);let ref=map.get(key);
  if(!ref){ref='shape-'+String(map.size+1).padStart(4,'0');map.set(key,ref);templates[ref]=geometry??null;}
  objects.push({...rest,geometryRef:ref,time:null,location:null});
 }
 return {schema:'tiles.scene/compact-1',version:'09N',unit:'m',ruleManifest,definition,geometryTemplates:templates,objects,study};
}
function stats(packed){
 const enc=new TextEncoder(),bytes=x=>enc.encode(JSON.stringify(x)).length,all=packed.objects.map(bytes),tiles=packed.objects.filter(o=>{let g=packed.geometryTemplates[o.geometryRef];return !!g&&(g.function==='kaopu.sheet/3'||!!g.continuous)}).map(bytes);
 const range=a=>a.length?{count:a.length,min:Math.min(...a),max:Math.max(...a)}:{count:0,min:null,max:null};
 return {all:range(all),tiles:range(tiles),templatesCount:Object.keys(packed.geometryTemplates).length,templatesBytes:bytes(packed.geometryTemplates),sceneBytes:bytes(packed)};
}
module.exports={pack,stats,version:'tiles.scene/compact-1'};
