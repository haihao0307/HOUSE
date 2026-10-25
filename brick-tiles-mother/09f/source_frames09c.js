/* 09C: explicit source-plane members. Pixels are observations, not measured 3D.
   Requires the existing FRAME_CASES, woodProfile, woodBox, M and renderer API.
   No inferred mortises, automatic shoulders, roof-envelope shims, or ground ridge posts. */
const SOURCE_FRAME_09C={
 frame2:{supports:[],beams:[[[575,218],[711,218],[711,225],[575,225]]]},
 frame4:{supports:[[980,209,246],[1086,247,266]],beams:[[[867,252],[1089,252],[1089,270],[1048,270],[1048,266],[867,266]],[[868,218],[985,218],[1007,229],[1009,238],[984,236],[970,228],[868,228]]]},
 frame6:{supports:[[198,746,755],[325,695,717],[411,661,687],[495,692,706]],beams:[[[183,750],[461,750],[461,774],[238,774],[218,770],[208,763],[186,763]],[[238,709],[462,709],[462,727],[326,727],[312,722],[298,722],[298,714],[238,714]],[[374,683],[460,683],[460,698],[414,698],[404,693],[374,693]],[[460,697],[504,697],[504,707],[460,707]]]},
 frame7:{extraPurlin:[498,744],supports:[[498,744,761],[779,626,638],[879,574,638],[982,626,638]],beams:[[[490,753],[681,753],[681,781],[562,781],[548,775],[490,765]],[[677,677],[1088,677],[1088,715],[1075,715],[1064,710],[1045,708],[1045,718],[719,718],[708,713],[697,717],[677,717]],[[774,638],[989,638],[989,662],[978,662],[963,659],[950,653],[813,653],[801,662],[774,662]]]},
 frame13:{supports:[[95,1213,1231],[123,1207,1245],[218,1172,1225],[347,1106,1118],[411,1068,1118],[478,1107,1118],[605,1174,1200],[702,1211,1244],[733,1220,1236]],beams:[[[92,1225],[283,1225],[283,1243],[153,1243],[144,1239],[123,1240],[113,1236],[92,1236]],[[120,1245],[283,1245],[283,1261],[161,1261],[149,1256],[120,1256]],[[148,1270],[283,1270],[283,1284],[166,1284],[155,1280],[148,1280]],[[279,1137],[546,1137],[546,1159],[519,1159],[508,1155],[318,1155],[305,1160],[279,1160]],[[343,1118],[482,1118],[482,1138],[470,1138],[460,1133],[366,1133],[356,1138],[343,1138]],[[540,1228],[736,1228],[736,1241],[715,1245],[689,1245],[677,1250],[540,1250]],[[540,1252],[705,1252],[705,1267],[678,1272],[540,1272]]]},
 frame3:{supports:[[979,1165,1222]],beams:[[[851,1222],[1105,1222],[1105,1237],[851,1237]]]}
};
function sourceContext09C(api,origin,scale,depth=.18){
 const pt=([x,y])=>[(x-origin[0])*scale,(origin[1]-y)*scale];
 const profile=(id,poly)=>api.put(id,woodProfile(poly.map(pt),depth),M.identity(),1);
 const rect=(id,x,y0,y1,w=.13)=>{let a=pt([x,y0]),b=pt([x,y1]);if(a[1]>b[1])api.block(id,a[0],b[1],0,w,a[1]-b[1],depth,1);};
 return{pt,profile,rect};
}
function sourceRoof09C(api,id,points,r,depth=.8,edges={}){
 const p=points.slice().sort((a,b)=>a[0]-b[0]),runs=[];
 for(let i=0;i<p.length-1;i++){
  const a=p[i],b=p[i+1],s=(b[1]-a[1])/(b[0]-a[0]),normal=Math.sqrt(1+s*s);
  const x0=i===0?(edges.xMin??a[0]):a[0],x1=i===p.length-2?(edges.xMax??b[0]):b[0];
  const centerOffset=(r+.024)*normal,topOffset=(r+.048)*normal;
  if(typeof api.roofAlong!=='function')for(let z of [-depth*.35,0,depth*.35])api.bar(id+'-rafter-'+i+'-'+z,[x0,a[1]+s*(x0-a[0])+centerOffset,z],[x1,a[1]+s*(x1-a[0])+centerOffset,z],.045,.045);
  const endpoints=[[x0,a[1]+s*(x0-a[0])+topOffset,0],[x1,a[1]+s*(x1-a[0])+topOffset,0]];
  const run={id:id+'-roof-run-'+i,unit:'m',frame:'x section horizontal; y vertical; z transverse',endpoints,purlinCenters:[a,b],supportRadius_m:r,tangent:[1/normal,s/normal,0],upNormal:[-s/normal,1/normal,0],depth_m:depth,depth_status:'unmeasured display extrusion',surface:'rafter upper tangent plane; tile solver must seat above this plane',eaveExtensions_m:[a[0]-x0,x1-b[0]],eave_status:edges.status||'source-plane observed limits',source:edges.source||'L8'};
  run.from=endpoints[0][1]<=endpoints[1][1]?endpoints[0]:endpoints[1];run.to=endpoints[0][1]<=endpoints[1][1]?endpoints[1]:endpoints[0];run.width_m=depth;run.set='L9';run.withEnds=false;run.datum='rafter_top';run.purlins=[a,b].map(p=>({center:[p[0],p[1],0],radius:r}));runs.push(run);if(typeof api.roofAlong==='function')api.roofAlong(run);
 }
 (api.workshop.definition.roofRuns??=[]).push(...runs);return runs;
}
function buildSourceFrame09C(id,api){
 const f=FRAME_CASES[id],v=SOURCE_FRAME_09C[id],S=f.scale,{pt,profile,rect}=sourceContext09C(api,f.origin,S),r=.072;
 const purlins=f.purlins.map(p=>p.slice());if(v.extraPurlin)purlins.unshift(v.extraPurlin);
 f.posts.forEach(([x,y],i)=>{let q=pt([x,y]);api.block(id+'-post-'+i,q[0],.10,0,.20,q[1]-r-.10,.20,1);api.block(id+'-stone-'+i,q[0],0,0,.27,.10,.27,0);});
 v.beams.forEach((poly,i)=>profile(id+'-observed-beam-'+i,poly));
 // Explicit vertical bearings terminate at a drawn beam, never at ground.
 v.supports.forEach(([x,y,base],i)=>rect(id+'-observed-bearing-'+i,x,y+r/S,base));
 purlins.forEach((p,i)=>{let q=pt(p);api.log(id+'-purlin-'+i,q[0],q[1],0,r,.8);});
 // Ridge bearing bases are the upper beam faces, not nearby lower ties.
 
 
 if(id==='frame13'){
  const upper=[[543,1210],[561,1198],[583,1188],[605,1183],[624,1188],[646,1200],[670,1218]],lower=[[670,1230],[646,1212],[624,1200],[605,1196],[583,1201],[561,1211],[543,1223]];
  profile(id+'-observed-porch-curved-member',[...upper,...lower]);
 }
 sourceRoof09C(api,id,purlins.map(pt),r,.8,{xMin:pt(f.roof[0])[0],xMax:pt(f.roof.at(-1))[0],source:'L8 figure7'});
 api.workshop.definition.sourceFrame={source:'L8',printedFigure:'图7',case:f.sourceCase,pixel_image_size:[1170,1620],source_plane_pixels:{...f,purlins,observedMembers:v},status:f.status,depth_m:.8,depth_status:'display assumption',method:'individually observed beam silhouettes and explicit bearing endpoints; no generic stepped shoulders or automatic packing',seventh_purlin:id==='frame7'?{pixel:[498,744],status:'partly occluded left eave section; approximate observed center'}:null,unresolved:'section depths, exact joints, carved infill, drawing distortion and structural behavior remain unknown'};
 api.workshop.connections.push({a:id+'-observed-members',b:id+'-purlins',kind:'source-defined section bearings',historical_joint_verified:false,structural_verified:false});
}

function buildHouse09C(id,api){
 const main=id==='mainHouse',gate=id==='gateHouse',W=api.workshop,D=.8,r=.085;
 const putPoly=(name,p,d=.18)=>api.put(id+'-'+name,woodProfile(p,d),M.identity(),1);
 const col=(name,x,y0,y1,w=.20)=>{api.block(id+'-'+name,x,y0,0,w,y1-y0,w,1);if(y0===.10)api.block(id+'-'+name+'-stone',x,0,0,w*1.35,.10,w*1.35,0);};
 const beam=(name,a,b,y,h=.16)=>api.block(id+'-'+name,(a+b)/2,y,0,b-a,h,.18,1);
 const floor=(a,b,y)=>{beam('floor-tie',a,b,y-.18,.18);api.block(id+'-floor',(a+b)/2,y,0,b-a,.055,D,1);for(let x=a+.16;x<b-.05;x+=.40)api.block(id+'-floor-joist-'+x,x,y-.12,0,.09,.12,D,1);};
 const roof=(name,points,edges={})=>{points.forEach(([x,y],i)=>api.log(id+'-'+name+'-purlin-'+i,x,y,0,r,D+.15));sourceRoof09C(api,id+'-'+name,points,r,D,{source:main?'L5 figure4':'L4 figure3',...edges});};
 const opening=(name,x0,x1,y0,y1)=>{col(name+'-left',x0,y0,y1,.08);col(name+'-right',x1,y0,y1,.08);beam(name+'-lintel',x0,x1,y1-.075,.075);beam(name+'-threshold',x0,x1,y0,.07);};
 if(main){
  col('central-column',2.70,.10,6.18,.24);col('front-column',0,.10,5.11,.23);col('porch-column',-1.30,.10,3.23,.23);
  floor(0,2.70,2.73);
  beam('upper-large-tie',0,2.70,4.81,.30);beam('upper-small-tie',1.35,2.70,5.40,.13);
  col('upper-short-bearing',1.35,5.11,5.55,.15);
  roof('main',[[0,5.195],[1.35,5.635],[2.70,6.265]],{xMin:-.80,xMax:2.70,status:'front overhang 80 cm labeled; section ends at ridge, opposite slope not inferred'});
  // The two porch roof bearings occur on the porch column and front column.
  beam('porch-tie',-1.72,0,2.62,.18);
  putPoly('porch-curved-support',[[-1.72,2.59],[-1.50,2.56],[-1.30,2.49],[-.75,2.47],[-.25,2.52],[0,2.58],[0,2.68],[-1.72,2.68]]);
  roof('porch',[[-1.65,3.20],[-1.30,3.315],[0,3.80]],{xMin:-2.40,xMax:0,status:'front overhang 110 cm from porch column; 35 cm outer support separation observed label'});col('porch-outer-bearing',-1.65,2.80,3.115,.12);
  beam('porch-upper-tie',-1.70,0,2.80,.13);
  opening('upper-door',.12,.86,2.785,3.925);
  for(let [a,b]of [[.95,1.70],[1.78,2.55]]){api.block(id+'-upper-board-'+a,(a+b)/2,2.785,0,b-a,2.025,.035,1);col('panel-stile-'+a,a,2.785,4.81,.065);}
  opening('lower-door',1.71,2.51,.10,2.43);api.block(id+'-lower-door-leaf',2.11,.17,0,.70,2.18,.035,1);
  W.definition.transcribed_dimensions_cm={main_column_height:618,front_column_height:511,porch_column_height:323,lower_floor_clear:273,upper_floor_clear:238,upper_bays:[135,135],porch_width:130,eave_extensions:[80,110],upper_rises:[44,63]};
 }else if(gate){
  // No center column: the drawing shows a curved transverse beam above the room.
  col('eave-post',1,.10,4.03,.20);col('wall-side-post',-1,.10,4.03,.20);floor(-1,1,2.38);
  putPoly('curved-beam',[[-1.10,3.98],[-.80,4.10],[-.45,4.20],[0,4.25],[.45,4.20],[.80,4.10],[1.10,3.98],[1.10,3.80],[.80,3.90],[.45,4.00],[0,4.03],[-.45,4.00],[-.80,3.90],[-1.10,3.80]]);
  col('ridge-short-bearing',0,4.25,4.28,.13);roof('main',[[-1,4.115],[0,4.365],[1,4.115],[1.35,3.995]],{xMin:-1.72,xMax:2.20,status:'right overhang 120 cm labeled; left extent 72 cm observed image proportion'});
  beam('eave-outrigger',1,1.58,3.83,.13);col('hanging-eave-post',1.35,2.48,3.91,.13);
  api.block(id+'-rear-earth-wall',-1.20,0,0,.24,3.88,D,0);
  opening('ground-door',-.92,.14,.10,1.87);api.block(id+'-ground-door-leaf',-.39,.17,0,.96,1.63,.035,1);
  W.definition.transcribed_dimensions_cm={bays:[100,100],overhang:120,lower_clear:238,door_height:177,door_width:106,upper_figure_reference:165};
 }else{
  col('front-post',0,.10,4.33,.17);floor(0,2.6,2.48);
  api.block(id+'-rear-earth-wall',2.76,0,0,.32,5.60,D,0);
  beam('large-tie',0,2.6,4.08,.25);beam('small-tie',1.3,2.6,4.70,.13);
  col('middle-short-bearing',1.3,4.33,4.83,.13);
  roof('main',[[-.25,4.32],[0,4.415],[1.3,4.915],[2.6,5.465]],{xMin:-.85,xMax:2.60,status:'85 cm front overhang; ridge is rear section limit'});
  // Rear ridge is carried by the drawn earth wall; no invented full-height timber post.
  beam('wall-seat',2.48,2.85,5.24,.14);
  beam('porch-outrigger',-.75,0,2.95,.13);col('porch-hanging-post',-.55,2.10,3.02,.13);
  roof('porch',[[-.55,3.105],[0,3.33]],{xMin:-1.05,xMax:0,status:'50+55 cm porch horizontal dimensions labeled'});
  opening('upper-door',.08,.70,2.535,3.385);
  api.block(id+'-upper-board-wall',1.66,2.535,0,1.80,1.545,.035,1);
  W.definition.transcribed_dimensions_cm={bays:[130,130],overhang:85,upper_rises:[50,55],lower_clear:248,upper_panel:185,door:85};
 }
 W.definition.sourceFrame={source:main?'L5':'L4',case:main?'孟姓一颗印住宅正房带厦横断面':gate?'倒八尺断面':'耳房断面',status:'labeled dimensions and individual source-plane members; unlabelled member sizes and opening locations are display approximations',roof:'explicit roofRuns with rafter-top tangent planes, supporting purlins and eave extensions; actual tile mother provided through api.roofAlong',unresolved:'earth-wall bearings, complete mortises, hidden members, finish colors and structural behavior not verified'};
 W.definition.transverse_depth_m=D;W.definition.transverse_depth_status='display extrusion only';
 W.connections.push({a:id+'-source-members',b:id+'-roof',kind:'explicit section-bearing chain',validated:false});
}

// Hand-observed individual outer silhouettes on L8-right (725 x 980).
// IDs retain source identity; none is a reusable generic cloud/stepped bracket.
const YOU_CHUN_OUTLINES09C=[
 {id:'left-upper-cloud',label:'左上枕旁云形撑',points:[[176,126],[181,121],[190,123],[196,128],[204,126],[211,119],[217,121],[218,132],[213,140],[202,143],[196,151],[195,160],[184,161],[184,144],[174,139],[171,132]]},
 {id:'left-lower-cloud',label:'左下云形撑',points:[[116,189],[119,181],[128,177],[138,179],[143,183],[154,178],[161,166],[165,158],[177,154],[188,155],[196,160],[196,168],[191,177],[181,183],[168,185],[159,190]]},
 {id:'right-upper-cloud',label:'右上枕旁云形撑',points:[[406,122],[416,120],[424,126],[431,128],[437,125],[440,118],[447,118],[457,125],[460,132],[454,140],[444,144],[439,150],[431,153],[420,151],[414,142]]},
 {id:'right-lower-cloud',label:'右下云形撑',points:[[400,158],[412,155],[425,158],[433,164],[436,172],[443,177],[453,178],[465,174],[474,178],[482,183],[486,190],[448,190],[431,185],[414,181],[404,173]]},
 {id:'central-cloud',label:'撑枕云头',points:[[265,173],[265,164],[272,155],[284,150],[294,149],[298,143],[308,141],[319,143],[325,149],[336,151],[348,158],[355,167],[352,176],[344,180],[336,176],[336,168],[330,165],[325,170],[326,182],[320,190],[303,192],[286,189],[282,182],[284,170],[279,165],[273,169],[274,178],[269,179]]},
 {id:'left-upper-bearing',label:'左上枕实体',points:[[213,119],[230,119],[230,157],[211,157]]},
 {id:'right-upper-bearing',label:'右上枕实体',points:[[389,119],[407,119],[407,155],[389,155]]},
 {id:'left-central-strut',label:'撑枕左斜撑',points:[[230,121],[238,119],[290,148],[286,155]]},
 {id:'right-central-strut',label:'撑枕右斜撑',points:[[383,120],[389,125],[334,157],[328,150]]},
 {id:'central-rise',label:'上枕中部承托',points:[[300,78],[313,77],[327,90],[332,104],[329,122],[323,139],[311,137],[301,139],[294,126],[291,110],[293,94]]},
 {id:'right-post-head-cloud',label:'右柱头外侧云形撑',points:[[550,144],[562,145],[567,153],[563,162],[565,172],[577,176],[581,184],[578,190],[551,190]]},
 {id:'bottom-tail',label:'下枋右端透雕轮廓',points:[[538,301],[572,299],[590,305],[609,306],[623,301],[634,296],[642,300],[640,308],[629,316],[613,320],[603,329],[586,335],[564,337],[538,337]]}
];
function buildYouChun09C(api){
 const {put,block,log,workshop}=api,base=2.82,S=(4.13-3.78)/(413-378),depth=.24;
 // Detail plane uses qa/L8-right.png, and three labeled heights; horizontal dimensions remain independent.
 const height=y=>y>=375?(918-y)*2.82/(918-375):y>=164?2.82+(375-y)*.96/(375-164):3.78+(164-y)*.35/(164-58);
 const p=([x,y])=>[(x-88)*.006,height(y)];
 for(let [i,x]of [88,538].entries()){let q=p([x,918]);block('you-chun-post-'+i,q[0],0,0,.19,p([x,164])[1]-.075,.19,1);block('you-chun-base-'+i,q[0],0,0,.28,.15,.28);}
 for(let [i,y,h]of [[0,190,47],[1,255,39],[2,299,42]]){let a=p([88,y+h]),b=p([642,y]),cx=(a[0]+b[0])/2,bm=woodBox(b[0]-a[0],b[1]-a[1],depth);put('you-chun-band-'+i,bm,M.translate(cx,a[1],0),1);
  const fronts=[];for(let k=0;k<bm.idx.length;k+=3){let v=[0,1,2].map(j=>Array.from(bm.p.slice(bm.idx[k+j]*3,bm.idx[k+j]*3+3)));if(v.some(p=>p[2]<depth*.4))continue;let [A,B,C]=v,D=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]);if(Math.abs(D)>1e-12)fronts.push({A,B,C,D,x0:Math.min(A[0],B[0],C[0]),x1:Math.max(A[0],B[0],C[0]),y0:Math.min(A[1],B[1],C[1]),y1:Math.max(A[1],B[1],C[1])});}
  const surface=(x,y)=>{x-=cx;y-=a[1];let found=-Infinity;for(let t of fronts){if(x<t.x0-1e-6||x>t.x1+1e-6||y<t.y0-1e-6||y>t.y1+1e-6)continue;let {A,B,C,D}=t,u=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/D,w=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/D;if(u>=-1e-6&&w>=-1e-6&&u+w<=1.000001)found=Math.max(found,u*A[2]+w*B[2]+(1-u-w)*C[2]);}return Number.isFinite(found)?found:depth/2;};
  const G=new Mesh();for(let rings of PAINT_CURVES['band'+i].polygons){let points=rings.flat(),holes=[],n=rings[0].length;for(let ring of rings.slice(1)){holes.push(n);n+=ring.length;}let base=G.p.length/3;for(let q of points){let [x,y]=p(q);G.vertex([x,y,surface(x,y)+.0006]);}let indices=triangulateHoles(points.flat(),holes,2);for(let j=0;j<indices.length;j+=3){let a=indices[j],b=indices[j+1],c=indices[j+2],A=points[a],B=points[b],C=points[c];if((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])>0)G.tri(base+c,base+b,base+a);else G.tri(base+a,base+b,base+c);}}
  G.definition={kind:'source ink on timber face',source:'L8 figure8',roi:PAINT_CURVES['band'+i].roi,paint_color_status:'black is diagram ink only; historical pigments unknown',surface_fit:'barycentric interpolation of actual displaced beam triangles',display_depth_bias_m:.0006};put('you-chun-source-ink-'+i,G.finish(false),M.identity(),6);
 }
 const tails=[[[632,190],[654,185],[681,187],[701,194],[710,206],[700,217],[680,225],[658,227],[642,234],[632,234]],[[632,255],[653,245],[671,248],[682,255],[675,268],[657,277],[653,288],[641,298],[632,298]]];tails.forEach((poly,i)=>put('you-chun-profiled-tail-'+i,woodProfile(poly.map(p),depth),M.identity(),1));
 // Curved upper member follows the source outline and is independent of the sloping main roof.
 const top=[[87,151],[144,129],[203,105],[255,78],[290,62],[320,58],[354,63],[407,81],[470,108],[538,136]],bot=top.slice().reverse().map(([x,y])=>[x,y+13]);put('you-chun-curved-member',woodProfile([...top,...bot].map(p),depth),M.identity(),1);
 // The paired cloud-shaped pieces replace the previous invented rectangular fillers.
 for(const member of YOU_CHUN_OUTLINES09C){const g=woodProfile(member.points.map(p),depth);g.definition={source:'L8 figure8',source_image_size:[725,980],source_pixels:member.points,label:member.label,status:'individually hand observed outer silhouette; carving depth unknown'};put('you-chun-'+member.id,g,M.identity(),1);}
 for(let [i,q]of [[88,164],[222,109],[398,109],[538,165],[641,177]].entries()){
  let [x,y]=p(q);log('you-chun-purlin-'+i,x,y,0,.075,.7);
  // Only the three actual straight section pieces visible at the columns/eave remain.
  if([0,3,4].includes(i)){const boxPixels=i===0?[[80,178],[97,178],[97,207],[80,207]]:i===3?[[527,179],[549,179],[549,251],[527,251]]:[[633,190],[650,190],[650,222],[633,222]];put('you-chun-observed-straight-seat-'+i,woodProfile(boxPixels.map(p),depth),M.identity(),1);}
 }
 // Two stacked circular sections are visible above the curved member at its apex.
 for(let [i,q]of [[312,20],[314,46]].entries()){const [x,y]=p(q);log('you-chun-upper-round-section-'+i,x,y,0,.045,.7);}
 workshop.definition.sourceContours=YOU_CHUN_OUTLINES09C;
 block('you-chun-door-lintel',1.35,2.745,0,2.7,.075,.24,1);block('you-chun-threshold',1.35,0,0,2.7,.17,.27,1);
 // Door was marked removed in the reference: retain its boundary, no fabricated carved door.
 workshop.definition.sourceFrame={source:'L8',printedFigure:'图8',case:'响应寺大殿游椿及彩画',height_labels_m:[0,2.82,3.78],unresolved_height_label_m:4.13,transcribed_sections_cm:{天头:[15,24],门枋:[7.5,24],门槛:[17,27]},status:'09C：图面分段校准至0、2.82、3.78；上曲部4.13引线对应尚有歧义，顶部插值只是显示参数。上枕、撑枕、左右云形撑与三道梁端分别按原图轮廓建立，雕刻内层深度未测；三道梁枋面保留原图墨线。横向比例、进深、未注尺寸仍是假设',paint:'three installed beam bands retain source ink; independent samples shown separately, no historical palette inferred',door:'source labels lattice door removed; no replacement invented',joint_status:'mortises and structural behavior unknown'};
}
