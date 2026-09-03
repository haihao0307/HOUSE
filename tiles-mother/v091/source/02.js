
/* Tiles Mother V0.4.0. Thin-shell event operators, not a copied Brick runtime.
   Source observations and design dimensions are separated in STUDY.md. */
(function(root){'use strict';
const VERSION='0.4.0', DAY=86400;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return h>>>0;}
const random=(s,label)=>hash(s+'|'+label)/4294967296;
function hashNum(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return(n^(n>>>16))>>>0;}
function noise(x,y,s){const a=Math.floor(x),b=Math.floor(y),u=smooth(0,1,x-a),v=smooth(0,1,y-b),r=(i,j)=>hashNum(Math.imul(i,374761393)^Math.imul(j,668265263)^s)/4294967296;return mix(mix(r(a,b),r(a+1,b),u),mix(r(a,b+1),r(a+1,b+1),u),v);}
function fbm(x,y,s){return .58*noise(x,y,s)+.28*noise(x*2.07,y*2.07,s+1)+.14*noise(x*4.13,y*4.13,s+2);}
const profiles=Object.freeze({pan:Object.freeze({width:.22,length:.32,thickness:.0115,curve:.046,taper:.12}),cover:Object.freeze({width:.16,length:.30,thickness:.0105,curve:.072,taper:.09})});
function tile(profile='pan',id='single/pan/0',master=32017,controls={},bank={}){
 if(!profiles[profile])throw Error('unknown tile profile');if(!Number.isInteger(master)||master<1||master>4294967295)throw Error('invalid seed');
 const seeds={},links={shape:'shape',forming:'warp',pore:'structure',flake:'damage',color:'color',micro:'micro',absorption:'weather'};
 for(const [p,k]of Object.entries(links))seeds[p]=hash((bank[k]??master)+'|'+id+'|'+p+'|tm-namespace-v1');
 const d={...profiles[profile]};for(const k of ['width','length','thickness','curve'])if(controls[k]!==undefined){if(!Number.isFinite(controls[k])||controls[k]<0)throw Error('invalid dimension');d[k]=controls[k]*.01;}
 if(controls.taper!==undefined)d.taper=controls.taper*.01;
 if(d.thickness<.005||d.thickness>.035||d.width<.08||d.width>.45||d.length<.1||d.length>.55||d.curve>.12)throw Error('dimension outside candidate domain');
 return {id,profile,master,seeds,dimensions:d,parameters:{relief:1,pores:controls.pores===undefined?1:controls.pores/32,forming:controls.warp===undefined?1:controls.warp/22,edge:controls.damage===undefined?1:controls.damage/18}};
}
function events(t){const a=[],T=t.dimensions.thickness,r=(s,l,lo,hi)=>mix(lo,hi,random(s,l));
 // Spatial clusters, irregular lips, small satellite pores. No all-over black dots.
 for(let i=0;i<22;i++){const s=t.seeds.pore,k='p'+i,g='cluster'+(i%5),u=r(s,g+'u',-.72,.72),v=r(s,g+'v',-.76,.76);a.push({id:k,type:'cavity',causeId:g,u:clamp(u+r(s,k+'u',-.15,.15),-.91,.91),v:clamp(v+r(s,k+'v',-.16,.16),-.91,.91),ru:r(s,k+'r',.022,.080),rv:r(s,k+'s',.021,.067),angle:r(s,k+'a',0,6.283),depth:r(s,k+'d',.045,.18)*T,phase:r(s,k+'f',0,6.283)});}
 for(let i=0;i<7;i++){const s=t.seeds.flake,k='f'+i;a.push({id:k,type:'flake',causeId:'forming-break/'+i,u:r(s,k+'u',-.93,.93),v:r(s,k+'v',-.93,.93),ru:r(s,k+'r',.07,.20),rv:r(s,k+'s',.036,.10),angle:r(s,k+'a',-1,1),depth:r(s,k+'d',.025,.065)*T,phase:r(s,k+'f',0,6.283)});}
 for(let i=0;i<9;i++){const s=t.seeds.forming,k='d'+i;a.push({id:k,type:'drag',causeId:'hand-forming/'+i,u:r(s,k+'u',-.86,.86),v:r(s,k+'v',-.8,.8),ru:r(s,k+'r',.012,.026),rv:r(s,k+'s',.11,.35),angle:r(s,k+'a',-.70,.70),depth:r(s,k+'d',.018,.048)*T,phase:r(s,k+'f',0,6.283)});}return a;
}
function base(u,v,t){const d=t.dimensions,w=d.width*(1-d.taper*v*.5);let x=u*w*.5,y=(u*u-.5)*d.curve;if(t.profile==='cover'){x=Math.sin(u*Math.PI*.475)*w*.5;y=Math.cos(u*Math.PI*.475)*d.curve-d.curve*.5;}return[x,y,v*d.length*.5];}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=Math.hypot(...a)||1;return a.map(x=>x/n);};
function field(u,v,t,ev,damage=0){const T=t.dimensions.thickness,s=t.seeds,p=t.parameters;
 const q=u+.045*(fbm(u*4,v*4,s.forming)-.5),r=v+.035*(fbm(u*3+17,v*3-8,s.shape)-.5);
 const broad=(fbm(q*3.4,r*3.4,s.forming)-.5)*T*.36,meso=(fbm(q*19,r*19,s.forming+51)-.5)*T*.14;
 let cavity=0,flake=0,drag=0,rim=0;const hits=[];
 for(const e of ev){const dx=u-e.u,dy=v-e.v,ca=Math.cos(e.angle),sa=Math.sin(e.angle);let x=(dx*ca+dy*sa)/e.ru,y=(-dx*sa+dy*ca)/e.rv;
  if(e.type==='drag'){x+=.26*Math.sin(y*2.8+e.phase);const d=Math.exp(-x*x*3.4)*Math.max(0,1-y*y)**2;if(d>1e-4){drag+=e.depth*d;hits.push(e.id);}continue;}
  let rr=Math.hypot(x,y),angle=Math.atan2(y,x);rr/=(1+.18*Math.sin(angle*3+e.phase)+.085*Math.sin(angle*5-e.phase));if(rr>1.25)continue;
  if(e.type==='cavity'){cavity=Math.max(cavity,e.depth*smooth(1.04,.23,rr));rim=Math.max(rim,e.depth*.12*Math.exp(-(((rr-.94)/.13)**2)));}
  else flake=Math.max(flake,e.depth*smooth(1,.63,rr)*(1+.15*x));if(rr<.9)hits.push(e.id);
 }
 const edge=smooth(.83,1,Math.max(Math.abs(u),Math.abs(v)))*smooth(.40,.70,fbm(u*7,v*7,s.flake));
 const relief=clamp(p.relief,0,2),pores=clamp(p.pores,0,2),forming=clamp(p.forming,0,2);
 const top=relief*(broad*forming+meso*forming-drag*forming-cavity*pores*(1+damage*.5)-flake*(1+damage*.7)+rim*pores)-edge*T*(.045+damage*.12)*p.edge*relief;
 const back=relief*(fbm(q*5,r*8,s.forming+71)-.5)*T*.09;
 return {top:clamp(top,-.37*T,.20*T),bottom:clamp(back,-.08*T,.08*T),cavity:clamp(cavity*pores/T/.20)*relief,flake:clamp(flake/T/.07)*relief,forming:broad*forming*relief,edge,hits};
}
function normals(pos,idx){const n=new Float32Array(pos.length);for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3,ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;for(const j of[a,b,c]){n[j]+=x;n[j+1]+=y;n[j+2]+=z;}}
 for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
function mesh(t,{nu=112,nv=148,damage=0}={}){if(!Number.isInteger(nu)||!Number.isInteger(nv)||nu<8||nv<8||nu>240||nv>300)throw Error('invalid mesh budget');const ev=events(t),positions=[],uv=[],cavities=[],flakes=[],relief=[],face=[],indices=[];let minThickness=Infinity,minTop=Infinity,maxTop=-Infinity;const hitMap={};for(const e of ev)hitMap[e.id]=0;
 const n=(nu+1)*(nv+1),top=[],back=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu*2-1,v=j/nv*2-1,b=base(u,v,t),N=unit(cross(sub(base(u,v+.0001,t),base(u,v-.0001,t)),sub(base(u+.0001,v,t),base(u-.0001,v,t)))),f=field(u,v,t,ev,damage),W=(fbm(u*1.9,v*1.9,t.seeds.shape)-.5)*t.dimensions.thickness*.15,th=t.dimensions.thickness/2;
  const notch=f.edge*th*.3*t.parameters.edge*t.parameters.relief;b[0]-=Math.sign(u)*notch*smooth(.91,1,Math.abs(u));b[2]-=Math.sign(v)*notch*smooth(.91,1,Math.abs(v));
  top.push(b.map((x,k)=>x+N[k]*(th+f.top+W)));back.push(b.map((x,k)=>x+N[k]*(-th+f.bottom+W)));
  minThickness=Math.min(minThickness,t.dimensions.thickness+f.top-f.bottom);minTop=Math.min(minTop,f.top);maxTop=Math.max(maxTop,f.top);for(const h of f.hits)hitMap[h]++;uv.push((u+1)/2,(v+1)/2);cavities.push(f.cavity);flakes.push(f.flake);relief.push(f.top);face.push(1);
 }
 for(const p of top)positions.push(...p);for(const p of back)positions.push(...p);
 uv.push(...uv.slice());cavities.push(...new Array(n).fill(0));flakes.push(...new Array(n).fill(0));relief.push(...new Array(n).fill(0));face.push(...new Array(n).fill(0));
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d,n+a,n+b,n+c,n+b,n+d,n+c);}
 const boundary=[];for(let i=0;i<=nu;i++)boundary.push(i);for(let j=1;j<=nv;j++)boundary.push(j*(nu+1)+nu);for(let i=nu-1;i>=0;i--)boundary.push(nv*(nu+1)+i);for(let j=nv-1;j>0;j--)boundary.push(j*(nu+1));
 for(let i=0;i<boundary.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length];indices.push(a,b,n+a,b,n+b,n+a);}
 const P=new Float32Array(positions),I=new Uint32Array(indices);
 return {positions:P,normals:normals(P,I),uv:new Float32Array(uv),cavities:new Float32Array(cavities),flakes:new Float32Array(flakes),relief:new Float32Array(relief),face:new Float32Array(face),indices:I,nu,nv,count:n,metrics:{minThickness,minimumAllowedThickness:t.dimensions.thickness*.55,topPeakToValley:maxTop-minTop,hitMap,throughHoles:false,undercuts:false,scaleCalibration:'experimental_not_measured'}};
}
const historyDefaults=Object.freeze({preset:'wet-dry',rain:1,drying:1,solverStepSeconds:21600});
function evolve(t,physicalTimeSeconds,history=historyDefaults,exposure=1){if(!Number.isFinite(physicalTimeSeconds)||physicalTimeSeconds<0||physicalTimeSeconds>DAY*365)throw Error('time outside preview budget');const h={...historyDefaults,...history};if(!['wet-dry','dry','rain'].includes(h.preset)||![h.rain,h.drying,exposure].every(x=>Number.isFinite(x)&&x>=0&&x<=2)||h.solverStepSeconds!==21600)throw Error('invalid history');let W=0,damage=0,dose=0,input=0,evaporation=0,drainage=0;const absorb=.65+.55*random(t.seeds.absorption,'coefficient');
 for(let now=0;now<physicalTimeSeconds;){const dt=Math.min(h.solverStepSeconds,physicalTimeSeconds-now)/DAY,day=now/DAY,raining=h.preset==='rain'||(h.preset==='wet-dry'&&day%6<2),rain=raining?h.rain*.85*exposure:0,dry=h.drying*(raining?.045:.23),drain=.09,k=rain*absorb+dry+drain,steady=k>0?rain*absorb/k:W,next=k>0?steady+(W-steady)*Math.exp(-k*dt):W,integral=k>0?steady*dt+(W-steady)*(1-Math.exp(-k*dt))/k:W*dt;
 input+=rain*absorb*(dt-integral);evaporation+=dry*integral;drainage+=drain*integral;dose+=integral;damage+=Math.abs(next-W)*.028;W=next;now+=dt*DAY;}
 return {physicalTimeSeconds,solverStepSeconds:h.solverStepSeconds,wetness:W,exposureDoseDays:dose,damage:clamp(damage),budget:{input,evaporation,drainage,stored:W,residual:input-evaporation-drainage-W,unit:'normalized water capacity'},calibrationStatus:'illustrative_not_calibrated',history:{...h},id:t.id};
}
function fingerprint(values){let h=2166136261;for(const x of values)for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
const API={VERSION,DAY,profiles,tile,events,base,field,mesh,evolve,hash,noise,fbm,fingerprint,historyDefaults};root.TilesStudyCore=API;if(typeof module!=='undefined')module.exports=API;
})(globalThis);

