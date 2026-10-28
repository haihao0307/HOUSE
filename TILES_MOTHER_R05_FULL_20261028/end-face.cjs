'use strict';
// Continuous face rule. Source contours are reusable evidence data, not display vertices.
// Geometry evaluation and the ceramic wave/material share this face's material coordinates.
const {fieldRule,identity,materialRule}=require('./route-a.cjs');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function area2(poly){let a=0;for(let i=0;i<poly.length;i++){let p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-p[1]*q[0]}return a}
function inside2(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function reliefField(t){
 const cell=.004,bins=new Map(),fills=new Map();
 const curves=t.curves.map(c=>({...c,points:c.points.map((p,i,a)=>p.map((v,k)=>(a[(i-1+a.length)%a.length][k]+v*2+a[(i+1)%a.length][k])/4))}));
 for(let c of curves){
  // Closed small motifs are broad moulded features, not pairs of wire outlines.
  if(c.hole&&Math.abs(area2(c.points))/2<.00072){let xs=c.points.map(p=>p[0]),ys=c.points.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){let k=x+','+y;if(!fills.has(k))fills.set(k,[]);fills.get(k).push(c.points);}}
  for(let i=0;i<c.points.length;i++){let a=c.points[i],b=c.points[(i+1)%c.points.length];for(let x=Math.floor((Math.min(a[0],b[0])-.003)/cell);x<=Math.floor((Math.max(a[0],b[0])+.003)/cell);x++)for(let y=Math.floor((Math.min(a[1],b[1])-.003)/cell);y<=Math.floor((Math.max(a[1],b[1])+.003)/cell);y++){let k=x+','+y;if(!bins.has(k))bins.set(k,[]);bins.get(k).push([a,b]);}}
 }
 const traced=(x,y)=>{let key=Math.floor(x/cell)+','+Math.floor(y/cell);if((fills.get(key)||[]).some(p=>inside2([x,y],p)))return 1;let d=.003;for(let [a,b]of bins.get(key)||[]){let dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1));d=Math.min(d,Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy));}return 1-smooth(.00012,.0014,d);};
 if(t.kind==='round'&&t.source_box_px[0]===825)return(x,y)=>{
  // L9 circular rafter coin: 16 long petals + 8 inner petals observed in the drawing.
  // The outer meander is still evaluated from the retained source curves.
  const yy=y*t.width_m/t.height_m,r=Math.hypot(x,yy),a=Math.atan2(yy,x),petal=(count,r0,r1,width)=>{let angle=Math.atan2(Math.sin(a*count),Math.cos(a*count))/count,along=r*Math.cos(angle),across=r*Math.sin(angle),u=(along-r0)/(r1-r0);if(u<=0||u>=1)return 0;let w=width*Math.pow(Math.sin(Math.PI*u),.85),body=1-smooth(w-.0006,w+.0003,Math.abs(across)),vein=(1-smooth(.00025,.0008,Math.abs(across)))*smooth(.20,.30,u)*(1-smooth(.85,.94,u));return body*(.85-.32*vein);};
  const leaves=petal(16,.010,.043,.0057),heart=petal(8,.0038,.0175,.0045),circle=c=>1-smooth(.0004,.0012,Math.abs(r-c));
  return Math.max(leaves,heart,circle(.0455)*.8,circle(.048)*.65,r>.050?traced(x,y):0,circle(.0635)*.65);
 };
 return traced;
}
function create({id,trace,depth=.012,relief=.0012,seed=31,scale=1,strength=1,material={},domain=null}){
 if(typeof id!=='string'||!id||!trace||!Array.isArray(trace.curves)||!Number.isFinite(depth)||depth<=0||!Number.isFinite(relief)||!Number.isFinite(scale)||scale<=0||!Number.isFinite(strength)||strength<0)throw Error('Invalid face definition');
 const reliefAt=reliefField(trace),M={color:.3,roughness:.3,brightness:.96,warmth:.36,patina:.38,wet:0,tint:.5,variation:.58,core:.48,...material};
 function contains(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  if(domain)return domain(x,y);
  if(trace.kind==='round'){let f=(x/(trace.width_m/2))**2+(y/(trace.height_m/2))**2;return f<=1+1e-9&&(id!=='rosette'||x*x+y*y>=.0023**2-1e-12)}
  return Array.isArray(trace.outline)&&inside2([x,y],trace.outline);
 }
 function position(x,y,q=0){if(![x,y,q].every(Number.isFinite)||q<0||q>1)throw Error('Invalid face coordinates');return [x,y,depth*(.5-q)+relief*reliefAt(x,y)*(1-q)];}
 function evaluate(x,y,q=0,footprint=.0012){
  if(!contains(x,y))throw Error('Outside source outline');
  const p=position(x,y,q),reference=[x,y,depth/2],w=fieldRule(...reference,identity(seed),24*scale,footprint,.30,.85),m=materialRule(w.value,w.fine,...w.gradient,M,strength,1);
  return {position:p,materialPoint:reference,materialAddress:[x,y,q],...m,embossHeight:relief*reliefAt(x,y),waveHeight:m.microHeight};
 }
 return Object.freeze({contains,position,evaluate,reliefAt,definition:()=>({id,rule:'tiles.end-face/1',sourceRef:'tile-source-curves.json#'+id,unit:'m',frame:'face-local x/y, z thickness',depth_m:depth,relief_m:relief,seed,waveScale:scale,waveStrength:strength,error_m:null})});
}
module.exports={create,reliefField,version:'tiles.end-face/1'};
