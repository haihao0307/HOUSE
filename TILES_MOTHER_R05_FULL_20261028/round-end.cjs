'use strict';
// A continuous, smoothly blended tilt/length transformation for the D7 round end.
// Temporary extrema searches are numerical rule evaluation, not saved vertex data.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function create({joined,diameter=.123,plateThickness=.010,projectedHeight=.110,bodyLength=.232,totalLength=.278}){
 if(!joined?.carrierAt||!joined?.faceAt||![diameter,plateThickness,projectedHeight,bodyLength,totalLength].every(x=>Number.isFinite(x)&&x>0))throw Error('Invalid round end rule');
 const center=joined.centerY,z0=joined.z0,L=-z0*2;let lo=0,hi=1;
 for(let i=0;i<40;i++){let a=(lo+hi)/2;if(diameter*Math.cos(a)+plateThickness*Math.sin(a)>projectedHeight)lo=a;else hi=a}
 const angle=(lo+hi)/2;
 function first(p){const [x,y,z]=p,blend=1-smooth(0,.035,z-z0),dy=y-center;return[x,y+blend*(dy*Math.cos(angle)-dy),(z-z0)*(bodyLength/L)-blend*dy*Math.sin(angle)]}
 let min=Infinity,max=-Infinity;
 function observe(p){let z=first(p)[2];min=Math.min(min,z);max=Math.max(max,z)}
 // Coarse, bounded parameter-domain probes; no samples are retained as object facts.
 for(let i=0;i<=48;i++)for(let j=0;j<=48;j++)for(const q of [0,1])observe(joined.carrierAt(-1+2*i/48,j/48,q));
 for(let i=0;i<=48;i++)for(const u of [-1,1])for(let j=0;j<=12;j++)observe(joined.carrierAt(u,i/48,j/12));
 for(let i=0;i<192;i++)for(const radius of [.0,.5,1]){let a=i*Math.PI*2/192,x=radius*diameter/2*Math.cos(a),y=radius*diameter/2*Math.sin(a);for(const q of [0,1])observe(joined.faceAt(x,y,q));}
 const frontExtra=totalLength-(max-min);
 function transform(p){const v=first(p);v[2]-=(1-smooth(min,min+.07,v[2]))*frontExtra;return v}
 function carrierAt(u,t,q=0){return transform(joined.carrierAt(u,t,q))}
 function faceAt(x,y,q=0){return transform(joined.faceAt(x,y,q))}
 function evaluateFace(x,y,q=0,footprint=.0012){let v=joined.evaluateFace(x,y,q,footprint);return {...v,position:transform(v.position)}}
 return Object.freeze({transform,carrierAt,faceAt,evaluateFace,angle,min,max,frontExtra,definition:()=>({rule:'tiles.round-tilt/1',parent:joined.definition(),diameter_m:diameter,projectedHeight_m:projectedHeight,totalLength_m:totalLength,bodyLength_m:bodyLength,angle_rad:angle,fit:'bounded numerical extrema of continuous functions',source:'D7',error_m:null})});
}
module.exports={create,version:'tiles.round-tilt/1'};
