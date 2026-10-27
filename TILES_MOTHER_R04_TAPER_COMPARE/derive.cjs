'use strict';
// Derive two reversible candidate implementations from the current R03 code.
// Both retain its complete section, shoulders, texture, trimming, embossing and TLO-compatible API.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=__dirname,source=fs.readFileSync(root+'/baseline-r03/mother.cjs','utf8');
const exact=(s,a,b)=>{let n=s.split(a).length-1;if(n!==1)throw Error('Expected one occurrence, got '+n+': '+a);return s.replace(a,b)};
const original="const k=2*h/(w*w*.25+h*h),y=a*l+k*x*x/(1+Math.sqrt(Math.max(0,1-k*k*x*x)));";
const marker='const {section,flat,base,normal,skin}=sheetGeometry(S,P);';
const helperA=`const R04Tile=require('./tile.cjs');
function sectionHeight(x,width,k){
 // The old parameter is chord position; R04 uses angular material coordinates and arc length.
 if(k===0)return R04Tile([0,x/width,0],[1,width,1,0])[2];
 const arcWidth=2*Math.asin(k*width/2)/k,angle=Math.asin(k*x);
 return R04Tile([0,angle/(k*arcWidth),0],[1,arcWidth,1,k])[2];
}\n`;
const helperB=`function sectionHeight(x,width,k){
 // Straight path, continuously varying circular section, evaluated at the same chord address.
 if(k===0)return 0;
 const angle=Math.asin(k*x),half=Math.sin(angle/2);
 return 2*half*half/k;
}\n`;
for(const [name,helper] of [['route-a',helperA],['route-b',helperB]]){
 let code=exact(source,"'use strict';","'use strict';\nconst {createSection}=require('./section.cjs');\n"+helper);
 code=exact(code,'function sheetGeometry(S,P){','function sheetGeometry(S,P,route=false){');
 const start=code.indexOf(' function section(t)'),end=code.indexOf(' function flat(',start);
 if(start<0||end<0)throw Error('Original continuous section function not found');
 code=code.slice(0,start)+' const section=createSection(S,P);\n'+code.slice(end);
 code=exact(code,original,"const k=2*h/(w*w*.25+h*h),y=a*l+(route?sectionHeight(x,w,k):k*x*x/(1+Math.sqrt(Math.max(0,1-k*k*x*x))));");
 code=exact(code,marker,'const {section,flat,base,normal,skin}=sheetGeometry(S,P,true);');
 fs.writeFileSync(path.join(root,name+'.cjs'),code);
 let graph=fs.readFileSync(root+'/baseline-r03/object-system.cjs','utf8');
 graph=exact(graph,"require('./mother.cjs')",`require('./${name}.cjs')`);
 graph=exact(graph,"__dirname+'/mother.cjs'",`__dirname+'/${name}.cjs'`);
 fs.writeFileSync(path.join(root,'objects-'+name+'.cjs'),graph);
}
console.log(JSON.stringify({source:crypto.createHash('sha256').update(source).digest('hex'),derived:['route-a.cjs','route-b.cjs'],materialReference:'Original R03 reference geometry kept unchanged'}));
