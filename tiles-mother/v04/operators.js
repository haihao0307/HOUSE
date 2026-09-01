/* Tiles Mother 0.4.0: original thin-shell adaptation of event-based detail.
   All dimensions below are candidate design dimensions, not measurements.
   Brick operator provenance and limitations are in STUDY.md. No source assets. */
(function (root) {
'use strict';
const VERSION='0.4.0';
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return h>>>0;}
const random=(seed,label)=>hash(seed+'|'+label)/4294967296;
function hashNum(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
function noise(x,y,seed){const a=Math.floor(x),b=Math.floor(y),u=smooth(0,1,x-a),v=smooth(0,1,y-b);const r=(i,j)=>hashNum(Math.imul(i,374761393)^Math.imul(j,668265263)^seed)/4294967296;return mix(mix(r(a,b),r(a+1,b),u),mix(r(a,b+1),r(a+1,b+1),u),v);}
function fbm(x,y,seed){return .58*noise(x,y,seed)+.28*noise(x*2.07,y*2.07,seed+1)+.14*noise(x*4.13,y*4.13,seed+2);}
const profiles=Object.freeze({pan:Object.freeze({width:.22,length:.32,thickness:.0115,curve:.046,taper:.12}),cover:Object.freeze({width:.16,length:.30,thickness:.0105,curve:.072,taper:.09})});
function tile(profile='pan',id='single/pan/0',master=32017){if(!profiles[profile])throw Error('unknown profile');if(!Number.isInteger(master)||master<1||master>4294967295)throw Error('invalid seed');const seeds={};for(const p of ['shape','forming','pore','flake','color','micro','absorption'])seeds[p]=hash(master+'|'+id+'|'+p+'|tm-namespace-v1');return {id,profile,master,seeds,dimensions:{...profiles[profile]},parameters:{relief:1,pores:1,forming:1}};}
function events(t){const a=[],T=t.dimensions.thickness,r=(s,l,lo,hi)=>mix(lo,hi,random(s,l));
 for(let i=0;i<19;i++){const s=t.seeds.pore,k='p'+i;a.push({id:k,type:'cavity',u:r(s,k+'u',-.86,.86),v:r(s,k+'v',-.88,.88),ru:r(s,k+'r',.046,.11),rv:r(s,k+'s',.034,.088),angle:r(s,k+'a',0,6.283),depth:r(s,k+'d',.065,.20)*T,phase:r(s,k+'f',0,6.283)});}
 for(let i=0;i<5;i++){const s=t.seeds.flake,k='f'+i;a.push({id:k,type:'flake',u:r(s,k+'u',-.92,.92),v:r(s,k+'v',-.92,.92),ru:r(s,k+'r',.085,.21),rv:r(s,k+'s',.045,.12),angle:r(s,k+'a',-1,1),depth:r(s,k+'d',.028,.07)*T,phase:r(s,k+'f',0,6.283)});}
 for(let i=0;i<6;i++){const s=t.seeds.forming,k='d'+i;a.push({id:k,type:'drag',u:r(s,k+'u',-.85,.85),v:r(s,k+'v',-.78,.78),ru:r(s,k+'r',.018,.033),rv:r(s,k+'s',.10,.30),angle:r(s,k+'a',-.7,.7),depth:r(s,k+'d',.018,.045)*T,phase:r(s,k+'f',0,6.283)});}return a;}
function base(u,v,t){const d=t.dimensions,w=d.width*(1-d.taper*v*.5);let x=u*w*.5,y=(u*u-.5)*d.curve;if(t.profile==='cover'){x=Math.sin(u*Math.PI*.475)*w*.5;y=Math.cos(u*Math.PI*.475)*d.curve-d.curve*.5;}return [x,y,v*d.length*.5];}
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);};
function field(u,v,t,ev,damage=0){const T=t.dimensions.thickness,s=t.seeds,p=t.parameters;
 const q=u+.045*(fbm(u*4,v*4,s.forming)-.5),r=v+.035*(fbm(u*3+17,v*3-8,s.shape)-.5);
 const broad=(fbm(q*3.4,r*3.4,s.forming)-.5)*T*.24;
 const meso=(fbm(q*18,r*18,s.forming+51)-.5)*T*.085;
 let cavity=0,flake=0,drag=0,rim=0;const hits=[];
 for(const e of ev){const dx=u-e.u,dy=v-e.v,ca=Math.cos(e.angle),sa=Math.sin(e.angle);let x=(dx*ca+dy*sa)/e.ru,y=(-dx*sa+dy*ca)/e.rv;
  if(e.type==='drag'){x+=.27*Math.sin(y*2.8+e.phase);const d=Math.exp(-x*x*3.4)*Math.max(0,1-y*y)**2;if(d>1e-4){drag+=e.depth*d;hits.push(e.id);}continue;}
  let r=Math.hypot(x,y),angle=Math.atan2(y,x);r/=(1+.18*Math.sin(angle*3+e.phase)+.085*Math.sin(angle*5-e.phase));if(r>1.25)continue;
  if(e.type==='cavity'){const cut=e.depth*smooth(1.04,.23,r);cavity=Math.max(cavity,cut);rim=Math.max(rim,e.depth*.105*Math.exp(-(((r-.94)/.13)**2)));}
  else flake=Math.max(flake,e.depth*smooth(1,.63,r)*(1+.15*x));if(r<.9)hits.push(e.id);
 }
 const edge=smooth(.83,1,Math.max(Math.abs(u),Math.abs(v)))*smooth(.40,.70,fbm(u*7,v*7,t.seeds.flake));
 const shrink=edge*T*(.05+damage*.15);
 // Asymmetric removal. Back face does not repeat front-face cavities.
 const relief=clamp(p.relief,0,2),pores=clamp(p.pores,0,2),forming=clamp(p.forming,0,2);
 const top=relief*(broad*forming+meso*forming-drag*forming-cavity*pores*(1+damage*.5)-flake*(1+damage*.7)+rim*pores)-shrink;
 const back=relief*((fbm(q*5,r*8,s.forming+71)-.5)*T*.06);
 const topBound=clamp(top,-.37*T,.20*T),bottomBound=clamp(back,-.08*T,.08*T);
 return {top:topBound,bottom:bottomBound,cavity:clamp(cavity*pores/T/.23),flake:clamp(flake/T/.075),forming:broad*forming,edge,hits};
}
function mesh(t,{nu=112,nv=148,damage=0}={}){if(!Number.isInteger(nu)||!Number.isInteger(nv)||nu<8||nv<8||nu>240||nv>300)throw Error('invalid mesh budget');const ev=events(t),positions=[],uv=[],cavities=[],flakes=[],relief=[],face=[],indices=[];let minThickness=Infinity,minTop=Infinity,maxTop=-Infinity;const hitMap={};for(const e of ev)hitMap[e.id]=0;
 const n=(nu+1)*(nv+1);const top=[],back=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu*2-1,v=j/nv*2-1,b=base(u,v,t),N=unit(cross(sub(base(u,v+.0001,t),base(u,v-.0001,t)),sub(base(u+.0001,v,t),base(u-.0001,v,t)))),f=field(u,v,t,ev,damage);const W=(fbm(u*1.9,v*1.9,t.seeds.shape)-.5)*t.dimensions.thickness*.15;const th=t.dimensions.thickness/2;
  top.push(b.map((x,k)=>x+N[k]*(th+f.top+W)));back.push(b.map((x,k)=>x+N[k]*(-th+f.bottom+W)));
  minThickness=Math.min(minThickness,t.dimensions.thickness+f.top-f.bottom);minTop=Math.min(minTop,f.top);maxTop=Math.max(maxTop,f.top);for(const h of f.hits)hitMap[h]++;uv.push((u+1)/2,(v+1)/2);cavities.push(f.cavity);flakes.push(f.flake);relief.push(f.top);face.push(1);
 }
 for(const p of top)positions.push(...p);for(const p of back)positions.push(...p);
 uv.push(...uv.slice());cavities.push(...new Array(n).fill(0));flakes.push(...new Array(n).fill(0));relief.push(...new Array(n).fill(0));face.push(...new Array(n).fill(0));
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d,n+a,n+b,n+c,n+b,n+d,n+c);}
 const boundary=[];for(let i=0;i<=nu;i++)boundary.push(i);for(let j=1;j<=nv;j++)boundary.push(j*(nu+1)+nu);for(let i=nu-1;i>=0;i--)boundary.push(nv*(nu+1)+i);for(let j=nv-1;j>0;j--)boundary.push(j*(nu+1));
 // Shared boundary indices make the shell topologically closed.
 for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];indices.push(a,b,n+a,b,n+b,n+a);}
 return {positions:new Float32Array(positions),uv:new Float32Array(uv),cavities:new Float32Array(cavities),flakes:new Float32Array(flakes),relief:new Float32Array(relief),face:new Float32Array(face),indices:new Uint32Array(indices),nu,nv,metrics:{minThickness,minimumAllowedThickness:t.dimensions.thickness*.55,topPeakToValley:maxTop-minTop,hitMap,throughHoles:false,undercuts:false,scaleCalibration:'experimental_not_measured'}};
}
const historyDefaults=Object.freeze({preset:'wet-dry',rain:1,drying:1,solverStepSeconds:21600});
function evolve(t,physicalTimeSeconds,history=historyDefaults,exposure=1){if(!Number.isFinite(physicalTimeSeconds)||physicalTimeSeconds<0||physicalTimeSeconds>86400*365)throw Error('time outside preview budget');const h={...historyDefaults,...history};if(!['wet-dry','dry','rain'].includes(h.preset)||![h.rain,h.drying,exposure].every(x=>Number.isFinite(x)&&x>=0&&x<=2)||h.solverStepSeconds!==21600)throw Error('invalid history');let W=0,damage=0,dose=0,input=0,evaporation=0,drainage=0;const absorb=.65+.55*random(t.seeds.absorption,'coefficient');
 for(let now=0;now<physicalTimeSeconds;){const dt=Math.min(h.solverStepSeconds,physicalTimeSeconds-now)/86400,day=now/86400;const raining=h.preset==='rain'||(h.preset==='wet-dry'&&day%6<2);const rain=raining?h.rain*.85*exposure:0,dry=h.drying*(raining?.045:.23),drain=.09;const k=rain*absorb+dry+drain,steady=k>0?rain*absorb/k:W,next=k>0?steady+(W-steady)*Math.exp(-k*dt):W;const integral=k>0?steady*dt+(W-steady)*(1-Math.exp(-k*dt))/k:W*dt;input+=rain*absorb*(dt-integral);evaporation+=dry*integral;drainage+=drain*integral;dose+=integral;damage+=Math.abs(next-W)*.028;W=next;now+=dt*86400;}
 return {physicalTimeSeconds,solverStepSeconds:h.solverStepSeconds,wetness:W,exposureDoseDays:dose,damage:clamp(damage),budget:{input,evaporation,drainage,stored:W,residual:input-evaporation-drainage-W,unit:'normalized water capacity'},calibrationStatus:'illustrative_not_calibrated',history:{...h},id:t.id};
}
const sRGB=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
function appearance(u,v,t,state,f,front=true){const s=t.seeds;const n=fbm(u*2.8,v*2.8,s.color),m=fbm(u*11+2,v*11-5,s.color+17),mineral=smooth(.51,.73,fbm(u*5,v*5,s.color+71));const warm=smooth(.47,.63,fbm(u*3+9,v*3-11,s.color+41));const greys=[117,118,116],ochre=[137,100,65];let rgb=greys.map((x,i)=>mix(x,ochre[i],warm*.82));const tone=(n-.49)*94+(m-.5)*46+mineral*17;const shelter=front?1-smooth(.60,.92,v)*.45:.28;const wet=state.wetness*shelter;const weather=clamp(state.exposureDoseDays/55)*shelter;
 rgb=rgb.map((x,i)=>clamp((x+tone+f.flake*[8,2,-3][i])*(1-wet*.27)*(1-weather*.08),18,198));
 return {linearColor:rgb.map(x=>sRGB(x/255)),rgb,roughness:clamp(.85+(m-.5)*.10+f.flake*.05-wet*.23,.50,.96),wetness:wet,weather,cavity:f.cavity};
}
function fingerprint(values){let h=2166136261;for(const x of values){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}}return (h>>>0).toString(16).padStart(8,'0');}
const API={VERSION,profiles,tile,events,base,field,mesh,evolve,appearance,hash,noise,fbm,fingerprint,historyDefaults};root.TilesStudyCore=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis==='undefined'?this:globalThis);
