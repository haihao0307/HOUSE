const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),THREE=require('../source/vendor/three_runtime.cjs');
const s=fs.readFileSync(path.join(root,'source/app.js'),'utf8');
const code=s.slice(s.indexOf('const clamp'),s.indexOf('const threeText'))+s.slice(s.indexOf('const PROFILE'),s.indexOf('const PALETTE'))+s.slice(s.indexOf('function circleArcY'),s.indexOf('function makeDetail'));
const A=new Function('THREE',code+';return {makeTileGeometry,woodGeometry,woodUVGate};')(THREE);
let failures=[];let count=0;
for(const seed of [101,202,314159,61771,987654])for(const kind of ['pan','cover'])for(const damage of [0,1,2])for(const lod of [[10,14],[16,22],[28,34]]){
 const g=A.makeTileGeometry(kind,{seed,damageClass:damage,nu:lod[0],nv:lod[1]}),P=g.attributes.position.array,I=g.index.array;
 for(const f of g.userData.surfaces)if(['top','bottom'].includes(f.name))for(let k=f.start;k<f.start+f.count;k+=3){const a=I[k]*3,b=I[k+1]*3,c=I[k+2]*3,ny=(P[b+2]-P[a+2])*(P[c]-P[a])-(P[b]-P[a])*(P[c+2]-P[a+2]);if(ny*(f.name==='top'?1:-1)<=0)failures.push({seed,kind,damage,lod,face:f.name,k});}count++;g.dispose();}
for(const radius of [.04,.069])for(const loss of [0,.25,.65]){const g=A.woodGeometry(.8,40,617,radius,t=>({loss:loss*Math.sin(Math.PI*t),stain:loss,y:-.012*Math.sin(Math.PI*t)**2}),loss>.5?[[.44,.56]]:[]);if(!A.woodUVGate(g).allPassed)failures.push({timber:radius,loss});}
console.log(JSON.stringify({tileCases:count,failures},null,2));process.exitCode=failures.length?1:0;
