const fs=require('fs'),vm=require('vm'),path=require('path');const H=__dirname;
const h=fs.readFileSync(H+'/START_HERE.html','utf8');const code=h.match(/<script>([\s\S]*?)<\/script>/)[1];const C={console};vm.createContext(C);vm.runInContext(code.slice(0,code.indexOf('const VERT='))+';this.A={ceramic,timber,M,model,tileModel,SEATS,V,smooth,clamp};',C);const A=C.A,S=A.SEATS;
const smooth=A.smooth,fract=x=>x-Math.floor(x),handHash=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453123);
function hand(p,meta,sid){if(meta[1]<.5)return[0,0,0];let halfW=meta[1]>1.5?.0575:.121,len=meta[1]>1.5?.222:.238,u=A.clamp(p[0]/halfW,-1,1),t=A.clamp(p[2]/len+.5),side=(1-u*u)**2,end=Math.sin(Math.PI*t)**2,a=handHash(sid*1.113)-.5,b=handHash(sid*2.173+3.1)-.5,c=handHash(sid*4.317+1.7)-.5,d=handHash(sid*7.919+5.2)-.5;return[Math.abs(u)**12*(a*.00034+b*.00018*Math.sin(t*7.1+d*3))*Math.sign(u),side*end*(a*.0028+b*.0014*Math.sin(2.3*u+1.7*t+c*4)+c*.0009*(2*t-1)+d*.0007*u),Math.abs(2*t-1)**12*(c*.00055+d*.00028*Math.sin(u*5.3+a*4))]}

function band(p,seed,density,footprint){let q=[p[0]+(fract(Math.sin(seed*12.9898+78.233)*43758.5453)-.5)*.11,p[2]+.4,p[1]+.27],r=Math.hypot(...q),xi=[Math.log2(r)-2,-q[2]/r,Math.atan2(q[0],q[1])].map(x=>x*density),span=footprint*density/Math.max(Math.hypot(q[0],q[1]),.2),value=0;for(let j=0,s=1;j<17;j++,s*=2){if(span*s>=2.4)break;let c=xi.map(x=>Math.cos(x*s));value+=(1-smooth(.8,2.4,span*s))*(Math.cos(c[2]*c[0]+c[1]*c[1]+c[1]*c[0])-.6556965)/s;}return value}
function micro(p,m,seed,strength,scale){
 if(!strength||m[1]<.5)return[0,0,0];
 let len=m[1]>1.5?.222:.238,u=m[3],t=A.clamp(p[2]/len+.5),q=A.clamp(m[2],0,1);
 let b=A.clamp(band(p,seed,6*scale,.0012),-1,1),mid=A.clamp(band(p,seed,26*scale,.0012),-1,1),pores=smooth(.56,.67,band(p,seed,80*scale,.0012));
 let under=A.clamp(band(p,seed,18*scale,.0015),-1,1),underPores=smooth(.60,.73,band(p,seed,58*scale,.0011)),sideField=A.clamp(band(p,seed,11*scale,.012),-1,1);
 let topW=1-smooth(.34,.84,q),bottomW=smooth(.60,.90,q),rear=smooth(.86,1,t),back=1-rear,bottomBack=1-.70*rear,bodyBack=back*(1-bottomW)+bottomBack*bottomW;
 let supportTop=1-.55*smooth(.80,.96,Math.abs(u))*smooth(.20,.35,t)*(1-smooth(.65,.80,t));
 let seatRail=smooth(.55,.75,Math.abs(u)),supportBottom=1-.995*seatRail,bodySupport=supportTop*(1-bottomW)+supportBottom*bottomW;
 let bodyDy=strength*(.00140*b+.00055*mid)*bodyBack*bodySupport,topDy=strength*(.00100*b+.00045*mid-.00220*pores)*topW*back*supportTop,underDy=strength*(.00022*b+.00028*under-.00055*underPores)*bottomW*bottomBack*supportBottom;
 let dy=A.clamp(bodyDy+topDy+underDy,-.0045,.0035);let panBearing=(m[1]<1.5?1:0)*(1-bottomW)*smooth(.68,.86,Math.abs(u)),coverBearing=(m[1]>=1.5?1:0)*bottomW*(1-smooth(.24,.46,Math.abs(u))),bearingGuard=Math.max(panBearing,coverBearing);dy*=1-.997*bearingGuard;
 if(m[1]<1.5)dy-=Math.max(dy,0)*smooth(.35,.50,Math.abs(u));else dy+=Math.max(-dy,0)*smooth(.50,.70,Math.abs(u));
 let wall=16*q*q*(1-q)*(1-q),through=.28+.72*wall,sideCarrier=smooth(.90,.985,Math.abs(u));
 let dx=Math.sign(u)*strength*(.00026*sideField-.00042*pores+.00014*under)*through*sideCarrier;
 let notch=smooth(-.35,.55,band(p,seed,8*scale,.018)),front=1-smooth(.025,.16,t),rearLip=smooth(.88,.98,t),lip=1-smooth(.35,.50,Math.abs(u));
 let dz=strength*(.00025+.0020*notch)*topW*front*lip;
 dz+=strength*(.00010+.00075*notch)*bottomW*front*lip;
 dz+=strength*.00022*sideField*through*(front+.20*rearLip);
 dz+=strength*.00055*pores*through*front;
 return[dx,dy,dz]
}
const source=fs.readFileSync(path.join(H,'contact-lib.cjs'),'utf8');vm.runInNewContext(source.slice(source.indexOf('function triangles('),source.indexOf('if(process.env.CONTACT_LIB)'))+';this.gap=gap',{A,...C});const G={A};vm.createContext(G);vm.runInContext(source.slice(source.indexOf('function triangles('),source.indexOf('if(process.env.CONTACT_LIB)'))+';this.gap=gap',G);
const results=[],checks=[];let maxOffset=0,flips=0;
function mesh(kind,sid,strength,scale){
 const g=A.ceramic(kind),original=Array.from(g.p),stats={topMicroMaxMm:0,sideMicroMaxMm:0,bottomMicroMaxMm:0,topTotalMaxMm:0,sideTotalMaxMm:0,bottomTotalMaxMm:0};
 for(let i=0;i<g.p.length/3;i++){
  const p=original.slice(i*3,i*3+3),m=Array.from(g.meta.slice(i*4,i*4+4)),o=micro(p,m,sid,strength,scale),b=hand(p,m,sid),total=o.map((v,k)=>v+b[k]);
  maxOffset=Math.max(maxOffset,Math.hypot(...o));
  const q=A.clamp(m[2],0,1),bucket=q<=.05?'top':q>=.95?'bottom':'side',microMm=Math.hypot(...o)*1000,totalMm=Math.hypot(...total)*1000;
  stats[bucket+'MicroMaxMm']=Math.max(stats[bucket+'MicroMaxMm'],microMm);stats[bucket+'TotalMaxMm']=Math.max(stats[bucket+'TotalMaxMm'],totalMm);
  g.p.set(p.map((v,k)=>v+total[k]),i*3);
 }
 g._offsetStats=stats;return g;
}

const report={version:'08F',method:'CPU double precision mirror of the actual 08F full-shell field; contacts use projected triangle intersections. Shape-presence metrics distinguish Microscope displacement from combined handmade+Microscope displacement.',contacts:[],shapeEvidence:[],visualApproved:false,productionApproved:false};
function hash(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967295}
const sid=n=>3+hash(n)*97;
for(const strength of [0,1.6,3]){const pan=mesh('pan',sid(314159),strength,1),cover=mesh('cover',sid(314548),strength,1);report.shapeEvidence.push({strength,pan:pan._offsetStats,cover:cover._offsetStats});
report.contacts.push({...G.gap('pan-cover default first pair',pan,A.tileModel('pan',-S.spacing*.5,S.panY,0),cover,A.tileModel('cover',0,S.coverY,S.coverPhase)),strength});
report.contacts.push({...G.gap('left rafter-pan',A.timber(),A.model(-S.spacing*.5,0,0,0,0,[S.rafterRadius,S.rafterRadius,7*S.step+.06]),pan,A.tileModel('pan',0,S.panY,-3*S.step)),strength});}
report.contactPassed=report.contacts.every(x=>x.pass);report.maxOffsetMm=maxOffset*1000;report.bottomOffsetMm=Math.max(...report.shapeEvidence.map(x=>Math.max(x.pan.bottomMicroMaxMm,x.cover.bottomMicroMaxMm)));report.bottomMicroZeroLegacyStatus='not_applicable_after_user_full_shell_goal_2026-09-14';report.shellFieldPresent=report.shapeEvidence.filter(x=>x.strength>0).every(x=>x.pan.bottomMicroMaxMm>1e-6&&x.pan.sideMicroMaxMm>1e-6&&x.cover.bottomMicroMaxMm>1e-6&&x.cover.sideMicroMaxMm>1e-6);fs.writeFileSync(H+'/CONTACT_QA.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
