'use strict';
// A front piece and its carrier use continuous rules. The planar junction is
// explicit; display tessellation and clipping are derived later by an adapter.
const Sheet=require('./route-a.cjs'),End=require('./end-face.cjs'),Drip=require('./fit-drip.cjs');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function extreme(fn,wantMax){
 const n=80, values=Array.from({length:n+1},(_,i)=>fn(i/n));let best=0;
 for(let i=1;i<=n;i++)if(wantMax?values[i]>values[best]:values[i]<values[best])best=i;
 let lo=Math.max(0,(best-1)/n),hi=Math.min(1,(best+1)/n);
 for(let i=0;i<26;i++){let x=lo+(hi-lo)*.38196601125,y=hi-(hi-lo)*.38196601125;if((fn(x)<fn(y))===wantMax)lo=x;else hi=y}
 return wantMax?Math.max(values[best],fn((lo+hi)/2)):Math.min(values[best],fn((lo+hi)/2));
}
function coverCenter(carrier,source,height){
 const rx=source.width_m/2,ry=source.height_m/2;
 const at=(u,q)=>carrier.position(u,0,q);
 function bounds(p){let d=ry*Math.sqrt(Math.max(0,1-(p[0]/rx)**2));return [p[1]-d+.0003,p[1]+d-.0003]}
 let low=-Infinity,high=Infinity;
 for(const edge of [i=>at(2*i-1,0),i=>at(2*i-1,1),i=>at(-1,i),i=>at(1,i)]){
  low=Math.max(low,extreme(i=>bounds(edge(i))[0],true));
  high=Math.min(high,extreme(i=>bounds(edge(i))[1],false));
 }
 return {center:clamp(height-ry+.003,Math.min(low,high),Math.max(low,high)),low,high};
}
function create({id,kind,carrier,source,depth=.012,relief=.0012,materialCenter=null,fittedFace=null}){
 if(!carrier?.position||!source||!['pan','cover'].includes(kind))throw Error('A tile end requires its carrier and source');
 const def=carrier.definition(),z0=-def.sheet.length/2,height=def.press.lift[0],fit=kind==='pan'?(fittedFace||Drip.create({id,source,carrier,depth,relief})):null;
 const cy=kind==='pan'?0:coverCenter(carrier,source,height).center;
 const face=fit||End.create({id,trace:source,depth,relief});
 const refDef=def.materialReference;
 let refCenter=materialCenter;
 if(refCenter===null){
  if(kind==='pan')refCenter=0;
  else {const frozen=JSON.parse(JSON.stringify(def));frozen.sheet={...refDef.sheet};frozen.press={...refDef.press,amount:1};const refCarrier=Sheet.create(frozen);refCenter=coverCenter(refCarrier,source,refDef.press.lift[0]).center;}
 }
 const refZ=-refDef.sheet.length/2;
 function materialPoint(x,y,q=0){return[-x,y+refCenter,refZ-depth*(1-q)]}
 function carrierAt(u,t,q=0){const p=carrier.position(u,t,q);if(t===0)p[2]=z0;return p}
 function faceAt(x,y,q=0){
  let p=face.position(x,y,q),r=materialPoint(x,y,q),wave=Sheet.fieldRule(...r,Sheet.identity(def.wave.seed),24*def.wave.scale,.0012,.30,.85),h=.00018*def.wave.strength*wave.value;
  return[-p[0],p[1]+cy,z0-depth/2-p[2]-h*(1-q)]
 }
 function evaluateFace(x,y,q=0,footprint=.0012){
  if(!face.contains(x,y))throw Error('Outside end-face domain');
  const pos=faceAt(x,y,q),reference=materialPoint(x,y,q),wave=Sheet.fieldRule(...reference,Sheet.identity(def.wave.seed),24*def.wave.scale,footprint,.30,.85);
  const surface=Sheet.materialRule(wave.value,wave.fine,...wave.gradient,def.material,def.wave.strength,1);
  return {position:pos,materialAddress:[x,y,q],materialPoint:reference,...surface,embossHeight:face.reliefAt(x,y)*relief};
 }
 return Object.freeze({carrierAt,faceAt,evaluateFace,materialPoint,face,centerY:cy,z0,jointPlane:z0,definition:()=>({id,rule:'tiles.joined-end/1',carrier:'kaopu.sheet/3',face:fit?'tiles.fitted-drip/1':'tiles.end-face/1',sourceRef:'tile-source-curves.json#'+id,frame:'carrier-local',junction:{plane_z_m:z0,relation:'face back touches carrier front',status:'geometric rule; physical manufacture unknown'},materialReference:{frame:'carrier-local',center_m:refCenter,policy:'fixed-until-explicitly-changed'},unit:'m',error_m:null})});
}
module.exports={create,coverCenter,version:'tiles.joined-end/1'};
