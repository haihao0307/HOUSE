const fs=require('fs');
const source=fs.readFileSync(__dirname+'/qa_geometry.cjs','utf8');
const {A,S,G,mesh}=Function('__dirname','require',source.slice(0,source.indexOf('for(const sid of'))+'return {A,S,G,mesh};')(__dirname,require);
for(const deformed of [false,true]){
 const pan=deformed?mesh('pan',51,0,1):A.ceramic('pan'),cover=deformed?mesh('cover',51,0,1):A.ceramic('cover');
 for(const side of [-1,1]){
 console.log(deformed?'hand':'raw',G.gap('cover '+side,pan,A.tileModel('pan',side*S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase)));
 console.log(deformed?'hand':'raw',G.gap('rafter '+side,A.timber(),A.model(side*S.spacing*.5,0,0,0,0,[S.rafterRadius,S.rafterRadius,4.02]),pan,A.tileModel('pan',0,S.panY,0)));
 }
}
