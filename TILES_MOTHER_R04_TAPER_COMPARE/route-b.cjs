'use strict';
const {createSection}=require('./section.cjs');
function sectionHeight(x,width,k){
 // Straight path, continuously varying circular section, evaluated at the same chord address.
 if(k===0)return 0;
 const angle=Math.asin(k*x),half=Math.sin(angle/2);
 return 2*half*half/k;
}

// One bounded sheet; shape recipes contain values, never a tile-type constructor.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const fract=x=>x-Math.floor(x), identity=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453), handIdentity=x=>fract(Math.sin(x*12.9898+78.233)*43758.5453123);
const hash=n=>{n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return((n^(n>>>16))>>>0)/4294967295};
function noise(x,y,seed){let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);const h=(a,b)=>hash((Math.imul(a,73856093)^Math.imul(b,19349663)^seed)>>>0);return mix(mix(h(i,j),h(i+1,j),u),mix(h(i,j+1),h(i+1,j+1),u),v)}
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{let l=Math.hypot(...a);if(l<1e-14)throw Error('Singular surface');return mul(a,1/l)};
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function segment(p,a,b){let d=sub(b,a),t=clamp(dot(sub(p,a),d)/(dot(d,d)||1));return Math.hypot(...sub(p,add(a,mul(d,t))))}
// Scalar rule bodies also generate GLSL in the optional adapter; no second recipe.
const waveResult=(value,fine,gx,gy,gz)=>({value,fine,gradient:[gx,gy,gz]});
function fieldRule(px,py,pz,shift,density,footprint,lo,hi){
 let x=px+(shift-.5)*.11,y=pz+.4,z=py+.27,r=Math.sqrt(x*x+y*y+z*z),xy2=x*x+y*y;
 let a=(Math.log2(r)-2.)*density,b=-z/r*density,c=Math.atan2(x,y)*density;
 let value=0.,fine=0.,gx=0.,gy=0.,gz=0.,scale=1.,span=footprint*density/Math.max(Math.sqrt(xy2),.2);
 for(let j=0;j<17;j++){
  let w=1.-smooth(lo,hi,span*scale);if(w<=0.)break;
  let cx=Math.cos(a*scale),cy=Math.cos(b*scale),cz=Math.cos(c*scale),v=cx*cz+cy*cy+cy*cx;
  let term=w*(Math.cos(v)-.6556965)/scale,fac=w*Math.sin(v);value+=term;if(j>=3)fine+=term;
  gx+=fac*Math.sin(a*scale)*(cz+cy);gy+=fac*Math.sin(b*scale)*(2.*cy+cx);gz+=fac*Math.sin(c*scale)*cx;scale*=2.;
 }
 let d0=density/(r*r*.6931471805599453),d1=density/(r*r*r),d2=density/xy2;
 return waveResult(value,fine,gx*x*d0+gy*z*x*d1+gz*y*d2,gx*z*d0+gy*(z*z*d1-density/r),gx*y*d0+gy*z*y*d1-gz*x*d2);
}
function field(p,seed,density,footprint=0,cut=[.8,2.4]){return fieldRule(...p,identity(seed),density,footprint,...cut)}
function colorChannel(value,individual,delta,a,b,patina,warm,neutral,cool,bias,added,temperature,M){
 let body=mix(mix(a,b,individual),patina,M.patina*.18)*(1.+.18*delta)+bias*delta;
 let family=clamp(.5+value*.30,0.,1.),tone=mix(mix(warm,neutral,smooth(.46,.66,family)),cool,smooth(.83,.94,family));
 return (mix(body,tone*(.80+.40*individual),M.color*.65)*(1.+clamp(value*.25,-.20,.20)*M.color)+added*clamp(value,-1.,1.)*M.color*M.warmth)*(1.+temperature*-.06)*M.brightness*(1.-M.wet*.15);
}
const surfaceResult=(r,g,b,roughness,h,gx,gy,gz)=>({color:[r,g,b],roughness,metallic:0,microHeight:h,microGradient:[gx,gy,gz]});
function skinRule(q){return smooth(.05,.92,.78+.22*Math.max(1.-smooth(0.,.14,q),smooth(.86,1.,q)));}
function materialRule(value,fine,gx,gy,gz,M,strength,skin){
 let individual=clamp(.5+(M.tint-.5)*M.variation,0.,1.),delta=(M.tint-.5)*M.variation;
 let r=colorChannel(value,individual,delta,.050,.142,.238,.102,.092,.075,-.008,.010,.13,M);
 let g=colorChannel(value,individual,delta,.064,.151,.229,.082,.089,.088,-.002,.002,.015,M);
 let b=colorChannel(value,individual,delta,.071,.149,.204,.067,.083,.096,.009,-.006,-.14,M);
 r=mix(mix(.245,.38,M.core)*(.98+fine*.10),r,skin);g=mix(mix(.182,.245,M.core)*(.98+fine*.10),g,skin);b=mix(.102*(.98+fine*.10),b,skin);
 return surfaceResult(r,g,b,clamp(.86+fine*M.roughness*.32,.76,.97)*(1.-M.wet*.16),.00018*strength*value,.00018*strength*gx,.00018*strength*gy,.00018*strength*gz);
}
function sheetGeometry(S,P,route=false){const seed=S.seed,N=P.shoulder;
 const section=createSection(S,P);
 function flat(u,t,q){return [u*S.width/2,-q*S.thickness,(t-.5)*S.length]}
 function base(u,t,a){let rest=flat(u,t,0),[w,h,l]=section(t);w=mix(S.width,w,a);let x=rest[0]*w/S.width;h*=a;
  const k=2*h/(w*w*.25+h*h),y=a*l+(route?sectionHeight(x,w,k):k*x*x/(1+Math.sqrt(Math.max(0,1-k*k*x*x))));
  const gain=P.formGain*a,side=(noise(t*1.35,1,seed+7)-.5)*(1-u)*.00082+(noise(t*1.55,1,seed+97)-.5)*(1+u)*.00082;
  const z=rest[2]+gain*(mix((noise(u*1.45,2,seed+113)-.5)*.00135,(noise(u*1.72,2,seed+311)-.5)*.00135,t)+(noise(u*1.55,5,seed+211)-.5)*.00110*Math.abs(2*t-1)**8);
  const bow=(noise(u*1.15+2.3,t*1.35+1.7,seed)-.5)*.00220+(noise(u*2.10+.7,t*2.35+4.1,seed+11)-.5)*.00100+(hash(seed+331)-.5)*.00120*u*Math.sin(Math.PI*t);
  return [x+side*gain,y+gain*Math.max(0,1-u*u)**1.45*bow*Math.sin(Math.PI*t)**2,z];
 }
 function normal(u,t,a){let du=sub(base(u+.0001,t,a),base(u-.0001,t,a)),dv=sub(base(u,t+.0001,a),base(u,t-.0001,a));return norm(P.longitudinalNormal?cross(dv,du):[-du[1],du[0],0])}
 function skin(u,t,q,a){let p=base(u,t,a),n=normal(u,t,a),th=mix(S.thickness,section(t)[3],a)*(1+P.formGain*a*(.070*(noise(t*1.55,u*1.35,seed+37)-.5)+.035*(noise(t*4.1,u*3.1,seed+137)-.5)));
  let inset=q<.14?1-Math.sqrt(Math.max(0,1-(1-q/.14)**2)):q>.86?1-Math.sqrt(Math.max(0,1-(1-(1-q)/.14)**2)):0,edge=[Math.sign(u)*Math.abs(u)**18,0,Math.sign(t-.5)*Math.abs(2*t-1)**18];edge=sub(edge,mul(n,dot(edge,n)));
  return sub(sub(p,mul(n,q*th)),mul(edge,P.edgeGain*(.00050+.00030*noise(u*1.8,t*2.2,seed+1901))*inset));
 }

return {section,flat,base,normal,skin};
}
function create(input){
 const o=JSON.parse(JSON.stringify(input));if(o.function!=='kaopu.sheet/3'||o.unit!=='m')throw Error('Expected metre sheet/3 definition');
 const S=o.sheet,P=o.press,W=o.wave,M=o.material,seed=S.seed,amount=P.amount;P.endWidth??=S.width;P.endThickness??=S.thickness;
 const finite=x=>Number.isFinite(x),pair=(x,test)=>Array.isArray(x)&&x.length===2&&x.every(test),positive=x=>finite(x)&&x>0;
 if(!positive(S.length)||!positive(S.width)||!positive(S.thickness)||!positive(P.endWidth)||!positive(P.endThickness)||!pair(P.rise,finite)||!pair(P.lift,finite)||!finite(amount)||amount<0||amount>1||!finite(P.formGain)||P.formGain<0||!finite(P.handGain)||P.handGain<0||!finite(P.edgeGain)||P.edgeGain<0||![0,1].includes(P.longitudinalNormal)||!Number.isInteger(seed))throw Error('Invalid sheet/press');
 if(!Number.isInteger(W.seed)||!positive(W.scale)||!finite(W.strength)||W.strength<0||!positive(P.handReferenceHalfWidth)||!positive(P.handReferenceLength))throw Error('Invalid wave/reference');
 for(const k of ['color','roughness','brightness','warmth','patina','wet','tint','variation','core'])if(!finite(M[k]))throw Error('Invalid material '+k);
 const R=o.materialReference;
 if(!R||!R.sheet||!R.press)throw Error('Explicit materialReference required');
 if(R.version!=='sheet-material-ref/1'||R.policy!=='fixed-under-press')throw Error('Unsupported material reference policy/version');
 const RS=R.sheet,RP=R.press;RP.endWidth??=RS.width;RP.endThickness??=RS.thickness;
 if(!positive(RS.width)||!positive(RS.length)||!positive(RS.thickness)||!Number.isInteger(RS.seed)||!positive(RP.endWidth)||!positive(RP.endThickness)||!pair(RP.rise,finite)||!pair(RP.lift,finite)||![0,1].includes(RP.longitudinalNormal)||!finite(RP.formGain)||!finite(RP.edgeGain)||!positive(RP.handReferenceHalfWidth)||!positive(RP.handReferenceLength))throw Error('Invalid materialReference');
 const refGeometry=sheetGeometry(RS,RP);
 for(let t of Array.from({length:129},(_,i)=>i/128)){let [w,h,,th]=refGeometry.section(t),k=2*h/(w*w/4+h*h);if(!positive(w)||!positive(th)||!finite(h)||Math.abs(h)>=w/2*.999999||Math.abs(k)*th>=.8)throw Error('Invalid reference bend/thickness')}
 const N=P.shoulder;
 if(N&&(!finite(N.at)||N.at<=0||N.at>=1||!positive(N.span)||N.span>N.at||!positive(N.width)||!positive(N.thickness)||!finite(N.rise)||!finite(N.lift)))throw Error('Invalid shoulder');
 const motifs=o.emboss||[];
 for(const c of motifs)if(!Array.isArray(c.points)||c.points.length<2||!c.points.every(p=>pair(p,finite))||!positive(c.radius)||!finite(c.height))throw Error('Invalid source curve');
 for(const poly of [o.outline,...(o.holes||[])].filter(Boolean))if(poly.length<3||!poly.every(p=>pair(p,finite)))throw Error('Invalid trim');
 const {section,flat,base,normal,skin}=sheetGeometry(S,P,true);
 for(let t of Array.from({length:129},(_,i)=>i/128)){let [w,h,,th]=section(t),k=2*h/(w*w/4+h*h);if(Math.abs(h)>=w/2*.999999||Math.abs(k)*th>=.8)throw Error('Section exceeds supported bend/thickness range')}
 function contains(u,t){return finite(u)&&finite(t)&&u>=-1&&u<=1&&t>=0&&t<=1&&(!o.outline||inside([u,t],o.outline))&&!(o.holes||[]).some(p=>inside([u,t],p))}
 function domain(u,t,q){if(!contains(u,t)||!finite(q)||q<0||q>1)throw Error('Outside sheet material domain')}
 function hand(p){let u=clamp(p[0]/RP.handReferenceHalfWidth,-1,1),t=clamp(p[2]/RP.handReferenceLength+.5),a=handIdentity(W.seed*1.113)-.5,b=handIdentity(W.seed*2.173+3.1)-.5,c=handIdentity(W.seed*4.317+1.7)-.5,d=handIdentity(W.seed*7.919+5.2)-.5;return [Math.abs(u)**12*(a*.00034+b*.00018*Math.sin(t*7.1+d*3))*Math.sign(u),(1-u*u)**2*Math.sin(Math.PI*t)**2*(a*.0028+b*.0014*Math.sin(2.3*u+1.7*t+c*4)+c*.0009*(2*t-1)+d*.0007*u),Math.abs(2*t-1)**12*(c*.00055+d*.00028*Math.sin(u*5.3+a*4))]}
 function emboss(u,t){let height=0,mark=0;for(let c of motifs){let p=[u,t],d=Infinity;for(let i=1;i<c.points.length;i++)d=Math.min(d,segment(p,c.points[i-1],c.points[i]));if(c.closed)d=Math.min(d,segment(p,c.points.at(-1),c.points[0]));let f=c.fill&&inside(p,c.points)?1:1-smooth(0,c.radius,d);height+=c.height*f;mark=Math.max(mark,f)}return {height,mark}}
 function chart(p){return [p[0],p[1],p[2]+Math.max(0,RS.length*.6-.4)]}
 function signals(u,t,q,fp){let ref=refGeometry.skin(u,t,q,1),p=chart(ref),b=field(p,W.seed,6*W.scale,.0012).value,m=field(p,W.seed,26*W.scale,.0012).value,po=smooth(.56,.67,field(p,W.seed,80*W.scale,.0012).value),f=field(p,W.seed,24*W.scale,fp,[.30,.85]),e=emboss(u,t);
  const vt=clamp(ref[2]/RS.length+.5),edge=smooth(.85,1,Math.abs(u)),end=Math.abs(2*vt-1)**8,neck=RP.shoulder?smooth(RP.shoulder.at-.005/RS.length,RP.shoulder.at,vt):0,amp=mix(1,.52,Math.max(q,edge,end,neck));
  return {p,ref,b,m,po,f,e,vt,edge,end,height:W.strength*amp*(.00135*clamp(b,-1,1)+.00045*clamp(m,-1,1)-.00075*po)+e.height*(1-q),side:.00018*W.strength*clamp(m,-1,1)};
 }
 function material(s,q){return materialRule(s.f.value,s.f.fine,...s.f.gradient,M,W.strength,skinRule(q))}
 function positionFrom(u,t,q,s){let p=skin(u,t,q,amount),n=normal(u,s.vt,amount),h=hand(s.ref);return p.map((x,i)=>x+n[i]*s.height+h[i]*P.handGain*amount+(i===0?Math.sign(u)*s.edge*s.side:i===2?Math.sign(s.vt-.5)*s.end*s.side:0))}
 function position(u,t,q=0){domain(u,t,q);return positionFrom(u,t,q,signals(u,t,q,0))}
 function evaluate(u,t,q=0,footprint=0){domain(u,t,q);if(!finite(footprint)||footprint<0)throw Error('Invalid material footprint');let s=signals(u,t,q,footprint);return {position:positionFrom(u,t,q,s),materialPoint:s.p,materialAddress:[u,t,q],...material(s,q),embossHeight:s.e.height,displacementHeight:s.height};}
 function sheetPoint(u,t,q=0){domain(u,t,q);return flat(u,t,q)}
 function shape(u,t,q=0){domain(u,t,q);return skin(u,t,q,amount)}
 function materialPoint(u,t,q=0){domain(u,t,q);return chart(refGeometry.skin(u,t,q,1))}
 return Object.freeze({evaluate,position,sheetPoint,shape,materialPoint,contains,definition:()=>JSON.parse(JSON.stringify(o))});
}
function instantiate(library,name,changes={}){let base=library.common,recipe=library.instances[name];if(!recipe)throw Error('Unknown recipe '+name);const o={...base,...recipe,...changes};for(let k of ['sheet','press','wave','material'])o[k]={...base[k],...recipe[k],...changes[k]};const r=library.materialDomains?.[o.materialRef];if(!r)throw Error('Unknown material reference '+o.materialRef);o.materialReference={...r,sheet:{...base.sheet,...r.sheet},press:{...base.press,...r.press}};return create(o)}
module.exports={create,instantiate,field,identity,fieldRule,colorChannel,skinRule,materialRule,version:'kaopu.sheet/3'};
