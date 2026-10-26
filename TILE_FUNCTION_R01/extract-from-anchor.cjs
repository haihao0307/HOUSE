const fs=require('fs');const out=__dirname,src='G:/HOUSE/brick-tiles-mother-09h-20261026/START_HERE.html';let s=fs.readFileSync(src,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];const Q=new Function('const settings={micStrength:1,micScale:1};'+s.slice(0,s.indexOf('const $=s=>'))+';return{clamp,mix,smooth,hash,noise,fract,handHash,V,tilePoint08D,tileBand,Mesh,ceramic};')();
let math=['clamp','mix','smooth','hash','noise','fract','handHash'].map(n=>'const '+n+'='+Q[n].toString()+';').join('\n')+'\nconst V={'+Object.entries(Q.V).map(([k,v])=>k+':'+v.toString()).join(',\n')+'};\n';
let base=Q.tilePoint08D.toString().replace('tilePoint08D(kind,u,t,seed=23)','base(u,t,seed=P.seed)').replace('const P=PROFILE[kind],w=', 'const w=').replace("(kind==='pan'?R-Math.sqrt(Math.max(1e-8,R*R-x0*x0)):Math.sqrt(Math.max(1e-8,R*R-x0*x0))-(R-h))",'R-Math.sqrt(Math.max(1e-8,R*R-x0*x0))');
let ceramic=Q.ceramic.toString(),point=ceramic.slice(ceramic.indexOf(' function point('),ceramic.indexOf(' for(let q of [0,1])')).replace('function point(u,v,q)','function skin(u,t,q)').replace('let t=getT(u,v),p=tilePoint(kind,u,t,seed),n=tileN(kind,u,t,seed);','const seed=P.seed;let p=base(u,t),n=normal(u,t);').replace("(kind==='cover'?mix(ACTIVE_COVER.t,ACTIVE_COVER.tn,smooth((ACTIVE_COVER.body-.002)/P.l,ACTIVE_COVER.body/P.l,t)):P.t)",'P.t').replaceAll('v-.5','t-.5').replaceAll('2*v-1','2*t-1');
const shared='// Pure continuous pan-tile definition. No mesh, sampling resolution, DOM or display cache.\n'+math+'\n'+Q.tileBand.toString()+`\nconst surfaces=Object.freeze({top:'q=0',bottom:'q=1',left:'u=-1',right:'u=1',front:'t=0',back:'t=1'});
function createEvaluator(object) {
  if(object.function!=='kaopu.pan/1')throw Error('Unsupported function version');
  const v=object.variables, P={l:v.length,w0:v.width0,w1:v.width1,h0:v.height0,h1:v.height1,t:v.thickness,seed:v.shapeSeed};
  const wave=Object.freeze({...object.wave});
  for(const k of ['l','w0','w1','h0','h1','t'])if(!(Number.isFinite(P[k])&&P[k]>0))throw Error('Invalid dimension '+k);
  if(!Number.isInteger(P.seed)||!Number.isInteger(wave.seed)||!Number.isInteger(v.handSeed)||!Number.isFinite(wave.strength)||wave.strength<0||!Number.isFinite(wave.scale)||wave.scale<=0||!Number.isFinite(v.handGain)||!(v.handReferenceHalfWidth>0&&v.handReferenceLength>0))throw Error('Invalid variation parameters');
  const handSeed=v.handSeed,handGain=v.handGain,handHalfWidth=v.handReferenceHalfWidth,handLength=v.handReferenceLength;
  function domain(u,t,q){if(![u,t,q].every(Number.isFinite)||u < -1||u > 1||t < 0||t > 1||q < 0||q > 1)throw Error('Outside parameter domain');}
`+base+`
function normal(u,t){const a=V.sub(base(u+.0001,t),base(u-.0001,t)),b=V.sub(base(u,t+.0001),base(u,t-.0001));return V.norm(V.cross(b,a));}
`+point+`
function hand(p){
  const u=clamp(p[0]/handHalfWidth,-1,1),t=clamp(p[2]/handLength+.5),side=(1-u*u)**2,end=Math.sin(Math.PI*t)**2;
  const a=handHash(handSeed*1.113)-.5,b=handHash(handSeed*2.173+3.1)-.5,c=handHash(handSeed*4.317+1.7)-.5,d=handHash(handSeed*7.919+5.2)-.5;
  return [Math.abs(u)**12*(a*.00034+b*.00018*Math.sin(t*7.1+d*3))*Math.sign(u),side*end*(a*.0028+b*.0014*Math.sin(2.3*u+1.7*t+c*4)+c*.0009*(2*t-1)+d*.0007*u),Math.abs(2*t-1)**12*(c*.00055+d*.00028*Math.sin(u*5.3+a*4))];
}
function offset(p,u,q){
  const t=clamp(p[2]/P.l+.5),n=normal(u,t),strength=wave.strength;
  const broad=clamp(tileBand(p,wave.seed,6*wave.scale,.0012),-1,1),mid=clamp(tileBand(p,wave.seed,26*wave.scale,.0012),-1,1),pore=smooth(.56,.67,tileBand(p,wave.seed,80*wave.scale,.0012));
  const edge=smooth(.85,1,Math.abs(u)),end=Math.pow(Math.abs(2*t-1),8),amplitude=mix(1,.52,Math.max(q,edge,end,0));
  const h=strength*amplitude*(.00135*broad+.00045*mid-.00075*pore),side=.00018*strength*mid;
  return [n[0]*h+Math.sign(u)*edge*side,n[1]*h,Math.sign(t-.5)*end*side];
}
function shape(u,t,q=0){domain(u,t,q);const p=skin(u,t,q),h=hand(p);return p.map((x,k)=>x+h[k]*handGain);}
function displacement(u,t,q=0){domain(u,t,q);return offset(skin(u,t,q),u,q);}
function position(u,t,q=0){domain(u,t,q);const p=skin(u,t,q),w=offset(p,u,q),h=hand(p);return p.map((x,k)=>x+w[k]+h[k]*handGain);}
// The following two point queries let a separate legacy display adapter match float32 staging.
function referencePoint(u,t,q){domain(u,t,q);return skin(u,t,q);}
function evaluateAtReference(p,u,q){const w=offset(p,u,q),h=hand(p);return p.map((x,k)=>x+w[k]+h[k]*handGain);}
return Object.freeze({shape,displacement,position,referencePoint,evaluateAtReference,surfaces});
}
module.exports={createEvaluator};
`;
fs.writeFileSync(out+'/pan.function.cjs',shared);
for(const [name,dims,source]of [['L9',[.24,.21,.19,.045,.045*.94,.014],'L9'],['D7',[.238,.242,.221,.05,.05*.94,.012],'D7']]){
 const [length,width0,width1,height0,height1,thickness]=dims;
 const obj={id:'pan-'+name+'-09H',function:'kaopu.pan/1',unit:'m',frame:'local x width, y up, z length',domain:{u:[-1,1],t:[0,1],q:[0,1]},variables:{length,width0,width1,height0,height1,thickness,shapeSeed:23,handSeed:31,handGain:.55,handReferenceHalfWidth:.121,handReferenceLength:.238},wave:{function:'microscope-adapter/09H',seed:31,strength:1,scale:1},evidence:{source,error_m:null,shape:'09H model assumptions; not a measured replica'}};
 fs.writeFileSync(out+'/pan-'+name+'.json',JSON.stringify(obj,null,2)+'\n');
}
const adapter='// Optional display adapter; never part of the object definition.\n'+math+Q.Mesh.toString()+`
function sample(evaluator,detail=80){
 if(!Number.isInteger(detail)||detail<2)throw Error('Invalid display resolution');
 const G=new Mesh(),reference=[],params=[],bands=detail>40?[0,.05,.10,.14,.22,.32,.42,.5,.58,.68,.78,.86,.90,.95,1]:[0,.14,.5,.86,1];
 function vertex(u,t,q,skin){let p=evaluator.referencePoint(u,t,q).map(Math.fround);reference.push(...p);params.push([u,t,q]);G.vertex(evaluator.evaluateAtReference(p,Math.fround(u),Math.fround(q)),skin,1,q,u);}
 for(let q of [0,1]){let base=G.p.length/3;for(let j=0;j<=detail;j++)for(let i=0;i<=detail;i++)vertex(2*i/detail-1,j/detail,q,1);for(let j=0;j<detail;j++)for(let i=0;i<detail;i++){let a=base+j*(detail+1)+i;G.quad(a,a+1,a+detail+1,a+detail+2,q===0);}}
 function edge(fn,flip){let base=G.p.length/3;for(let i=0;i<=detail;i++){let[u,t]=fn(i/detail);for(let q of bands)vertex(u,t,q,.78);}for(let i=0;i<detail;i++)for(let k=0;k<bands.length-1;k++){let a=base+i*bands.length+k;G.quad(a,a+bands.length,a+1,a+bands.length+1,flip);}}
 edge(t=>[-1,t],true);edge(t=>[1,t],false);edge(u=>[2*u-1,0],false);edge(u=>[2*u-1,1],true);
 G.finish();G.reference=new Float32Array(reference);return G;
}
module.exports={sample};
`;
fs.writeFileSync(out+'/display-adapter.cjs',adapter);
console.log('Wrote pure evaluator, two parameter objects, optional display adapter.');

