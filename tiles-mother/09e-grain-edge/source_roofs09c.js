function source09CRidgeInk(api,y){
 const G=new Mesh();for(let rings of RIDGE_INK09C.polygons){let points=rings.flat(),holes=[],n=rings[0].length;for(let ring of rings.slice(1)){holes.push(n);n+=ring.length;}let base=G.p.length/3;for(let q of points)G.vertex([(q[0]/559-.5)*1.10,y+.145-q[1]/91*.13,.0906]);let idx=triangulateHoles(points.flat(),holes,2);for(let j=0;j<idx.length;j+=3)G.tri(base+idx[j+2],base+idx[j+1],base+idx[j]);}G.definition={source:'L7',kind:'rectified source flower-band ink',relief_depth_unknown:true};api.put('source-flower-band',G.finish(false),M.identity(),6);
}
function source09CRoofRun(api,run){if(run.from[1]>run.to[1]){let swap=run.from;run.from=run.to;run.to=swap;}run.datum='rafter_top';run.set=run.source.startsWith('D')?'D7':'L9';run.purlins=run.purlins||[];let d=api.workshop.definition.sourceConstruction;(d.roofRuns||(d.roofRuns=[])).push(run);if(api.roofAlong)api.roofAlong(run);else d.roof_pending=true;}
/* 09C source-led constructions. Metres. Unmeasured transverse depths remain display assumptions. */
function source09CMeta(api,source,view,notes){api.workshop.definition.sourceConstruction={source,view,notes,depth_status:'unmeasured display extrusion',absolute_scale:source==='L7'?'unmeasured; display metres':'transcribed dimensions mixed with declared diagram ratios'};}
function source09CLink(api,a,b,kind){api.workshop.connections.push({a,b,kind,source:api.workshop.definition.sourceConstruction.source,validated:false,scope:'visible drawing relation; no hidden joinery or structural validation'});}
function source09CProfile(api,id,poly,depth=.14,type=0,x=0,y=0,z=0){return api.put(id,type===1?woodProfile(poly,depth):extrude(poly,depth),M.translate(x,y,z),type);}
function source09CBand(api,id,fn,x0,x1,y,thick,depth,type=0,z=0){let p=[];for(let i=0;i<=60;i++){let x=x0+(x1-x0)*i/60;p.push([x,y+fn(x)]);}for(let i=60;i>=0;i--){let x=x0+(x1-x0)*i/60;p.push([x,y+fn(x)-thick]);}return source09CProfile(api,id,p,depth,type,0,0,z);}
function source09CRing(api,id,x,y,outer,inner,depth,alongX=false){let g=new Mesh(),N=64;for(let z of [-depth/2,depth/2])for(let r of [outer,inner])for(let i=0;i<N;i++)g.vertex([r*Math.cos(i*TAU/N),r*Math.sin(i*TAU/N),z]);for(let i=0;i<N;i++){let j=(i+1)%N;g.quad(i,j,2*N+i,2*N+j);g.quad(N+j,N+i,3*N+j,3*N+i);g.quad(j,i,N+j,N+i);g.quad(2*N+i,2*N+j,3*N+i,3*N+j);}g.definition={kind:'hollow eye tile',outer_radius_m:outer,inner_radius_m:inner,depth_m:depth,status:'L7 visible opening; all dimensions unmeasured'};return api.put(id,g.finish(),model(x,y,0,0,alongX?Math.PI/2:0));}
function source09CHood(api,id,x,y,length,r,t){let p=[];for(let i=0;i<=48;i++){let a=Math.PI*i/48;p.push([r*Math.cos(a),r*Math.sin(a)]);}for(let i=48;i>=0;i--){let a=Math.PI*i/48;p.push([(r-t)*Math.cos(a),(r-t)*Math.sin(a)]);}let g=extrude(p,length);g.definition={kind:'ridge baotong independent arch profile',radius_m:r,wall_m:t,length_m:length,source:'L7',status:'unmeasured section interpretation; not a roof cover tile'};return api.put(id,g,model(x,y,0,0,Math.PI/2));}
function buildSourceRoof09C(id,api){
 const ids=['ridge','slopeRidge','flatRidge','tail','snail','firewall','forkRidge','ridgeD5'];if(!ids.includes(id))return false;
 source09CMeta(api,id==='ridgeD5'?'D5':'L7',id,['Separate source silhouettes and named courses','Unknown hidden core, fastening and depth are not reconstructed']);
 if(id==='ridge'||id==='slopeRidge'){
  source09CRing(api,'eye-tile-longitudinal',0,.075,.067,.047,1.12,true);
  api.block('board-tile-course',0,.142,0,1.15,.022,.255);
  api.block('lower-pitiaoxian',0,.164,0,1.18,.022,.29);
  let top=.186;
  if(id==='ridge'){api.block('flower-ridge-core',0,top,0,1.14,.16,.18);source09CRidgeInk(api,top);api.workshop.definition.sourceConstruction.ornament={source:'L7',source_quad_px:RIDGE_INK09C.source_quad_px,status:RIDGE_INK09C.status};top+=.16;}
  api.block('upper-pitiaoxian',0,top,0,1.18,.024,.27);for(let i=0;i<6;i++)source09CHood(api,'baotong-'+i,(i-2.5)*.19,top+.024,.188,.095,.016);
  source09CLink(api,'baotong','upper-pitiaoxian','seated arch feet');source09CLink(api,'board-tile-course','eye-opening','spans visible eye course');
 }else if(id==='ridgeD5'){
  let f=x=>.28*Math.pow(Math.max(0,(x+.40)/1.0),3);
  for(let row=0;row<2;row++)for(let i=0;i<7;i++){let x=-.50+i*.16;api.block('D5-brick-'+row+'-'+i,x,.03+row*.10+f(x),0,.156,.096,.16);}
  source09CBand(api,'D5-bottom-border',f,-.6,.6,.03,.018,.20);
  for(let i=0;i<8;i++){let x=-.53+i*.15,y=.25+f(x);source09CProfile(api,'D5-folded-tile-'+i,[[x-.075,y],[x,y+.065],[x+.075,y],[x+.065,y-.01],[x,y+.050],[x-.065,y-.01]],.15);}
  source09CBand(api,'D5-middle-belt',f,-.6,.6,.355,.035,.20);
  for(let i=0;i<8;i++)source09CRing(api,'D5-eye-'+i,-.53+i*.15,.425+f(-.53+i*.15),.058,.045,.17);
  source09CBand(api,'D5-upper-tile-band',f,-.6,.6,.505,.025,.23);
  for(let i=0;i<10;i++){let x=-.55+i*.12;api.bar('D5-visible-joint-'+i,[x,.508+f(x),-.116],[x,.508+f(x),.116],.003,.003,0);}
  source09CLink(api,'D5-folded-tile','D5-middle-belt','continuous triangular course below eye course');
 }else if(id==='snail'){
  let f=x=>.38*Math.pow(Math.max(0,1-(x/.52)**2),.65);
  for(let k=0;k<3;k++){source09CBand(api,'snail-curved-tile-'+k,f,-.52,.52,.06,.025,.09,0,(k-1)*.105);for(let j=1;j<9;j++){let x=-.52+j*.104;api.block('snail-seam-'+k+'-'+j,x,.06+f(x), (k-1)*.105,.003,.003,.09);}}
 }else if(id==='firewall'||id==='forkRidge'||id==='flatRidge'){
  const f=x=>.045+.065*(1+Math.cos((x+.04)*TAU/.21));
  source09CBand(api,id+'-continuous-wave-section',f,-.6,.6,.10,.025,.17);
  if(id==='firewall'){api.block('firewall-support',0,0,0,1.2,.09,.18);for(let i=0;i<6;i++)source09CProfile(api,'lock-joint-'+i,[[-.014,0],[.014,0],[.014,.025],[0,.025],[0,.045],[-.014,.045]],.175,0,-.52+i*.21,.095);}
  if(id==='flatRidge')for(let i=0;i<6;i++)api.tile('cover',-.52+i*.21,.23,.07,'L9');
  source09CLink(api,id+'-continuous-wave-section',id==='firewall'?'firewall-support':'roof edge','visible wave interface; interlock depth unknown');
 }else if(id==='tail'){
  let f=x=>.18*Math.pow(Math.max(0,(-x+.2)/.8),2);source09CBand(api,'tail-curved-projection',f,-.6,.5,.25,.045,.23);source09CProfile(api,'tail-scroll-support',[[-.10,.02],[-.19,.06],[-.22,.12],[-.16,.18],[.03,.20],[.15,.17],[.13,.13],[0,.13],[-.06,.11],[-.04,.08],[.02,.07],[.03,.04]],.14);
  source09CLink(api,'tail-curved-projection','tail-scroll-support','curved projecting strip over visible scroll support');
 }
 for(let side of (id==='ridgeD5'?[1]:[-1,1]))source09CRoofRun(api,{id:id+'-roof-side-'+side,from:[0,-.025,side*.13],to:[0,-.22,side*.65],width_m:1.12,source:id==='ridgeD5'?'D5':'L7',view:'supporting roof surface',dimensions_status:'unmeasured display run; source ridge layers remain separate'});
 return true;
}
function buildSourceJoint09C(id,api){
 if(!['jointD2','jointD3','jointD4','jointD6'].includes(id))return false;let source=id.slice(5);source09CMeta(api,source,id==='jointD4'?'front elevation':id==='jointD6'?'lower front with separate side relation':'side section',['No invented mortise type','Visible member outlines; transverse depth assumed']);
 const profile=(name,p,d=.14)=>source09CProfile(api,source+'-'+name,p,d,1);
 const front=(cx,base,width=.195)=>{
  api.block(source+'-hanging-post',cx,base+.20,0,width,.575,width,1);
  let poly=[[.10,.48],[.16,.48],[.16,.52],[.21,.52],[.21,.56],[.27,.56],[.27,.663],[.10,.663]];
  for(let s of [-1,1])profile('front-step-'+s,poly.map(([x,y])=>[cx+s*x,base+y]),.055);
  api.put(source+'-finial',woodFinial([[.20,width/2],[.17,width/2],[.135,width*.333],[.12,width*.18],[.095,width*.18],[.075,width*.308],[.035,width*.487],[0,width/2]]),M.translate(cx,base,0),1);
  api.block(source+'-head-strip',cx,base+.775,0,.62,.025,.12,1);
  for(let k=0;k<4;k++)api.block(source+'-visible-tongue-line-'+k,cx,base+.32+k*.065,.101,.045,.004,.004,1);
 };
 if(id==='jointD4'){front(0,0,.245);for(let s of [-1,1])api.block('D4-flanking-frame-'+s,s*.18,0,0,.055,.48,.12,1);api.block('D4-upper-lintel',0,.84,0,.80,.075,.14,1);api.workshop.definition.sourceConstruction.datum_mm={bottom:2983,beam_bottom:3488,beam_top:3663,head:3773,upper:3840};source09CRoofRun(api,{id:'D4-front-roof',from:[0,.94,-.30],to:[0,.87,.30],width_m:.80,source:'D4',view:'front',dimensions_status:'front span follows diagram; slope/depth unmeasured'});source09CLink(api,'D4-front-step','D4-hanging-post','bilateral front support');return true;}
 if(id==='jointD6'){front(.20,0,.14);api.block('D6-bottom-beam',.20,.06,0,1.3,.065,.14,1);api.block('D6-upper-beam',.20,.67,0,1.3,.09,.12,1);for(let x of [-.40,-.20,.60,.80])api.block('D6-panel-stile-'+x,x,.12,-.03,.025,.49,.05,1);api.log('D6-side-purlin-inner',-.68,.60,0,.055,.26);api.log('D6-side-purlin-outer',-.40,.50,0,.045,.26);api.bar('D6-side-rafter',[-.77,.66,0],[-.25,.47,0],.035,.07);front(-1.20,.18,.14);api.block('D6-upper-study-lintel',-1.20,.99,0,.90,.06,.14,1);api.block('D6-upper-study-base',-1.20,.18,0,.90,.055,.14,1);api.workshop.definition.sourceConstruction.views=['lower figure at x=.20','upper figure at x=-1.20; juxtaposed separate observations, not joined structure'];for(let cx of [-1.20,.20])source09CRoofRun(api,{id:'D6-roof-'+cx,from:[cx,1.10,-.28],to:[cx,1.03,.28],width_m:.90,source:'D6',view:'front separate figure',dimensions_status:'depth and slope unknown display parameters'});source09CLink(api,'D6-side-rafter','D6-side-purlin','side roof bearing separated from front hanging member');return true;}
 let short=id==='jointD3',span=short?.740:1.120;
 api.block(source+'-wall-post',0,0,0,short?.17:.14,.95,.17,1);
 profile('lower-profile',[[-.07,.27],[span-.15,.27],[span-.15,.30],[span-.10,.30],[span-.10,.34],[span-.05,.34],[span-.05,.40],[span,.40],[span,.46],[-.07,.46]]);
 profile('upper-profile',[[-.07,.46],[span,.46],[span,.60],[span-.055,.60],[span-.08,.64],[span-.14,.65],[span-.20,.64],[span-.24,.60],[span*.60,.66],[span*.55,.70],[span*.45,.72],[span*.25,.75],[-.07,.76]]);
 const slope=short?-.3404255319:-.2873563218,intercept=short?.93:.93,norm=Math.sqrt(1+slope*slope);
 let positions=short?[[.10,.060],[.57,.055]]:[[.04,.045],[.435,.055],[.91,.045]];
 // Upper purlin centres are computed from one tangent line, not independently guessed heights.
 let seats=[];for(let [x,r] of positions){let y=intercept+slope*x-r*norm;seats.push({x,y,r});api.log(source+'-purlin-'+x,x,y,0,r,.42);}
 // Rebuild upper visible carrier with circular notches; remove previous uncut silhouette from both records and groups.
 api.workshop.groups.delete(source+'-upper-profile');api.workshop.records=api.workshop.records.filter(q=>!q.id.startsWith(source+'-upper-profile#'));
 let top=[];for(let i=0;i<=260;i++){let x=-.07+(span+.07)*i/260,y=Math.min(.74,intercept+slope*x-.065);for(let q of seats)if(Math.abs(x-q.x)<q.r)y=Math.min(y,q.y-Math.sqrt(Math.max(0,q.r*q.r-(x-q.x)**2)));top.push([x,y]);}
 profile('upper-profile-seated',[[-.07,.46],[span,.46],...top.reverse()]);
 let a=[-.08,intercept+slope*(-.08),0],b=[span+.10,intercept+slope*(span+.10),0];
 // beamBetween width is the in-plane rafter thickness: offset centre by half thickness along normal.
 let ox=-slope/norm*.024,oy=1/norm*.024;
 source09CRoofRun(api,{id:source+'-roof',from:[a[0]+2*ox,a[1]+2*oy,0],to:[b[0]+2*ox,b[1]+2*oy,0],width_m:.42,purlins:seats.map(q=>({center:[q.x,q.y,0],radius:q.r})),source,view:'side',dimensions_status:'slope interpreted from diagram; purlin tangency solved'});
 api.workshop.definition.sourceConstruction.purlin_tangent={slope,intercept,seats,max_line_error_m:Math.max(...seats.map(q=>Math.abs((intercept+slope*q.x-q.y)/norm-q.r)))};
 if(!short){api.block('D2-hanging-post',.435,.10,0,.195,.585,.195,1);api.put('D2-finial',woodFinial([[.1,.0975],[.07,.09],[.04,.04],[.01,.035],[-.02,.09],[-.06,.0975]]),M.translate(.435,0,0),1);profile('D2-small-stepped-underbrace',[[.14,.20],[.32,.20],[.32,.23],[.37,.23],[.37,.27],[.14,.27]],.055);}
 source09CLink(api,source+'-rafter',source+'-purlin','sloped bearing on distinct round purlin sections');source09CLink(api,source+'-upper-profile',source+'-wall-post','drawn intersection; hidden joint unspecified');
 api.workshop.definition.sourceConstruction.transcribed_mm=short?{outer_projection:740,inner_projection:680,marked_span:598}:{outer_projection:1120,hanging_axis:435,head_width:195};return true;
}
function buildSourceMasonry09C(id,api){
 if(!['bond','wallCap','herringbone','smallDing'].includes(id))return false;source09CMeta(api,'L9',id,['Brick dimensions source-led; layout edge cuts and depth remain display parameters']);
 if(id==='herringbone'){
  // Orthogonal domino tiling in integer cells, then rotate the entire assembly 45 degrees.
  const s=.10,gap=.003;for(let v=-5;v<=5;v++)for(let u=-5;u<=5;u++){let phase=((u-v)%4+4)%4;if(phase!==0&&phase!==3)continue;let horizontal=phase===0,du=horizontal?1:0,dv=horizontal?0:1;let x=(u+du/2)*s,z=(v+dv/2)*s;if(Math.abs(x)>.45||Math.abs(z)>.45)continue;api.put('L9-herringbone-'+u+'-'+v,boxMesh((horizontal?2:1)*s-gap,.045,(horizontal?1:2)*s-gap),M.mul(M.ry(Math.PI/4),M.translate(x,0,z)));}api.workshop.definition.sourceConstruction.note='Right-angle interlocking paving rotated 45 degrees; perimeter trimmed display extent';
 }else if(id==='wallCap'){
  for(let row=0;row<3;row++)for(let i=0;i<4;i++)api.block('wall-base-'+row+'-'+i,(i-1.5)*.28,row*.05,0,.277,.047,.34);
  for(let z of [-.1775,.1775])for(let i=0;i<4;i++)api.block('wallcap-edge-'+z+'-'+i,(i-1.5)*.283,.15,z,.28,.045,.165);
  for(let x of [-.507,.507])api.block('wallcap-end-'+x,x,.15,0,.165,.045,.19);
  api.block('wallcap-earth-fill',0,.15,0,.849,.037,.19,4);source09CLink(api,'wallcap-earth-fill','wallcap-edge','fill contained by brick surround; no tile cap in source');
 }else if(id==='smallDing'){
  for(let level=0;level<3;level++){let count=4-level;for(let i=0;i<count;i++){let x=(i-1.5)*.304;api.block('smallDing-long-side-'+level+'-'+i,x,level*.09,-.105,.30,.09,.165);for(let j=0;j<2;j++)api.block('smallDing-cross-head-'+level+'-'+i+'-'+j,x+(j-.5)*.15,level*.09,.1275,.147,.09,.30);}}
  api.workshop.definition.sourceConstruction.mortar='none: L9 不用泥巴';api.workshop.definition.sourceConstruction.unresolved=['interior bond and unseen face unknown; stepped exposure follows source axonometric; small header widths 147 mm are display cuts, not source brick-size transcription'];
 }else{
  let dry=false;for(let row=0;row<5;row++){let header=row%2===1,L=header?.165:.30,depth=header?.30:.165,step=L+.004,n=header?7:4;for(let i=0;i<n;i++)api.block('L9-'+(header?'ding-head':'shun-body')+'-'+row+'-'+i,(i-(n-1)/2)*step,row*.094,0,L,.09,depth);if(!dry&&row<4)api.block('L9-bed-joint-'+row,0,row*.094+.09,0,1.20,.004,.165,4);}
  api.workshop.definition.sourceConstruction.mortar=dry?'none: source 不用泥巴':'display mortar variant; not the dry 小丁走';source09CLink(api,'ding-head-course','shun-body-course','alternating visible header and stretcher orientation');
 }return true;
}

