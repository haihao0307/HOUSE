'use strict';
const fs=require('fs'),Sheet=require('./route-a.cjs'),Joint=require('./tile-end-object.cjs'),lib=require('./library.json'),src=require('./tile-source-curves.json');
const results=[];
for(const [id,kind] of [['seal','cover'],['seeds','cover'],['flower','cover'],['dripFloral','pan'],['dripBeast','pan']]){
 const carrier=Sheet.instantiate(lib,kind+'-L9'),object=Joint.create({id,kind,carrier,source:src[id]}),samples=[];
 for(let i=0;i<=80;i++)for(const q of [0,.25,.5,.75,1]){let p=object.carrierAt(-1+2*i/80,0,q),x=-p[0],y=p[1]-object.centerY;if(!object.face.contains(x,y))continue;let f=object.faceAt(x,y,1),gap=Math.hypot(...p.map((v,k)=>v-f[k]));samples.push(gap)}
 const maxGap=samples.length?Math.max(...samples):null;
 results.push({id,kind,matchingSamples:samples.length,maxGap_m:maxGap,pass:samples.length>=20&&maxGap<1e-10});
}
const report={version:'09N',pass:results.every(r=>r.pass),results,scope:'Finite samples at carrier front plane against end-face back, with model assumptions; not a physical join, waterproofing, continuous coverage or all-parameter proof.'};fs.writeFileSync('JOIN_VALIDATION.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
