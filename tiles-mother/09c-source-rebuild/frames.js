// Coordinates are observations on qa/L8-left.png (1170 x 1620), not survey coordinates.
// Scale uses a labeled bay where available; the other frames remain proportional studies.
const FRAME_CASES={
 frame2:{name:'二柱二架二桁 · 一溜水',origin:[575,405],scale:2/105,posts:[[575,170],[680,205]],purlins:[[575,170],[680,205]],roof:[[565,159],[751,219]],beams:[[575,680,218,12]],sourceCase:'刘姓祠堂，图7上方简式',status:'无独立标尺；2 m柱距为显示参数'},
 frame4:{name:'二柱三架四桁 · 一溜水',origin:[870,510],scale:2/175,posts:[[870,169],[1045,232]],purlins:[[870,169],[980,209],[1045,232],[1086,247]],roof:[[839,170],[871,156],[1150,258]],beams:[[870,1086,266,17],[870,980,223,13]],sourceCase:'刘姓祠堂，图7乙断面',status:'柱距200、挑出110、柱高320为图示；像素比例有畸变'},
 frame6:{name:'二柱四架六桁 · 二溜水',origin:[238,1005],scale:2/173,posts:[[238,729],[460,678]],purlins:[[198,746],[238,729],[325,695],[411,661],[460,678],[495,692]],roof:[[112,773],[411,645],[523,685]],beams:[[183,460,755,22],[238,460,717,14],[325,460,687,14]],sourceCase:'刘姓祠堂，图7甲厢房',status:'200与110为图示尺寸；高度按图面比例，非精确测绘'},
 frame7:{name:'三柱六架七桁 · 前廊两溜水',origin:[679,1035],scale:1.16/102,posts:[[532,735],[679,679],[1085,676]],purlins:[[532,735],[679,679],[779,626],[879,574],[982,626],[1085,676]],roof:[[498,739],[879,555],[1147,690]],beams:[[532,679,769,19],[679,1085,715,22],[779,982,658,18]],sourceCase:'刘姓祠堂，图7丙祠堂',status:'原题七桁，当前只定位六个明确圆截面，第七位置待核；前廊170、四步116、井口柱高426为原注'},
 frame13:{name:'四柱九架十三桁 · 前后出檐',origin:[151,1440],scale:.014,posts:[[151,1200],[282,1140],[543,1145],[670,1198]],purlins:[[95,1213],[123,1207],[151,1200],[218,1172],[282,1140],[347,1106],[411,1068],[478,1107],[543,1145],[605,1174],[670,1198],[702,1211],[733,1220]],roof:[[75,1222],[411,1052],[786,1230]],beams:[[95,282,1240,18],[123,282,1260,14],[151,282,1280,14],[282,543,1160,23],[347,478,1124,19],[543,733,1241,18],[543,702,1261,14]],sourceCase:'响应寺大殿，图7下方对照',status:'无尺寸：整体比例与0.8 m显示进深；游椿为主屋架下部构造'},
 frame3:{name:'二柱三架三桁',origin:[875,1420],scale:.014,posts:[[875,1215],[1085,1224]],purlins:[[875,1215],[979,1165],[1085,1224]],roof:[[803,1229],[979,1152],[1148,1238]],beams:[[875,1085,1233,14]],sourceCase:'图7下方右侧简式，具体建筑归属待核',status:'无尺寸：按图面比例展示'}
};
function buildSourceFrame(id,api){
 const f=FRAME_CASES[id],{put,block,bar,log,workshop}=api,S=f.scale,pt=p=>[(p[0]-f.origin[0])*S,(f.origin[1]-p[1])*S],depth=.8,r=.072;
 const roofY=x=>{for(let i=0;i<f.roof.length-1;i++){let a=f.roof[i],b=f.roof[i+1];if(x>=a[0]&&x<=b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return f.roof[0][1]};
 // Column tops touch the observed purlin undersides. Source plane remains visible at z=0.
 f.posts.forEach(([x,y],i)=>{let q=pt([x,y]);block(id+'-post-'+i,q[0],.10,0,.20,q[1]-r-.10,.20,1);block(id+'-stone-'+i,q[0],0,0,.27,.10,.27);});
 f.beams.forEach(([a,b,y,h],i)=>{let p=pt([a,y]),q=pt([b,y]);const H=h*S;
  let outline=[[p[0]-.08,p[1]],[q[0]+.08,p[1]],[q[0]+.08,p[1]+H],[p[0]-.08,p[1]+H]];
  put(id+'-beam-'+i,woodProfile(outline,.18),M.identity(),1);
  // Stepped ends follow the visible bracket shoulders; exact depth is unknown.
  if(i>0||id==='frame7'||id==='frame13')for(let side of [-1,1]){let x=side<0?p[0]:q[0],d=-side,poly=[[x,p[1]-.18],[x+d*.12,p[1]-.18],[x+d*.12,p[1]-.12],[x+d*.25,p[1]-.12],[x+d*.25,p[1]-.06],[x+d*.40,p[1]],[x,p[1]]];put(id+'-shoulder-'+i+'-'+side,woodProfile(poly,.16),M.identity(),1);}
 });
 f.purlins.forEach(([x,y],i)=>{let q=pt([x,y]);log(id+'-purlin-'+i,q[0],q[1],0,r,depth);
  if(!f.posts.some(p=>Math.abs(p[0]-x)<2)){let bs=f.beams.filter(b=>x>=b[0]-2&&x<=b[1]+2&&b[2]>y).sort((a,b)=>a[2]-b[2]);if(bs.length){let b=bs[0],base=pt([x,b[2]-b[3]])[1],h=q[1]-r-base;if(h>0)block(id+'-short-post-'+i,q[0],base,0,.13,h,.16,1);}}
 });
 // Fit the underside to the support envelope. Pixel roof ink is retained as evidence, not floating geometry.
 let supports=f.purlins.map(pt).sort((a,b)=>a[0]-b[0]),envelope=[];
 for(let q of supports){while(envelope.length>1){let a=envelope.at(-2),b=envelope.at(-1);if((b[1]-a[1])/(b[0]-a[0])<(q[1]-b[1])/(q[0]-b[0]))envelope.pop();else break;}envelope.push(q);}
 let segments=[];for(let i=0;i<envelope.length-1;i++){let a=envelope[i],b=envelope[i+1],slope=(b[1]-a[1])/(b[0]-a[0]),offset=(r+.0225)*Math.sqrt(1+slope*slope),x0=i===0?pt(f.roof[0])[0]:a[0],x1=i===envelope.length-2?pt(f.roof.at(-1))[0]:b[0];segments.push({a,b,slope,offset,x0,x1});for(let z of [-.30,0,.30])bar(id+'-rafter-'+i+'-'+z,[x0,a[1]+slope*(x0-a[0])+offset,z],[x1,a[1]+slope*(x1-a[0])+offset,z],.045,.045);}
 // Where the diagram varies from a straight rafter, show explicit small bearing pieces, never leave a gap.
 supports.forEach(([x,y],i)=>{let seg=segments.find(s=>x>=s.x0-1e-6&&x<=s.x1+1e-6);if(seg){let top=seg.a[1]+seg.slope*(x-seg.a[0])+seg.offset-.0225*Math.sqrt(1+seg.slope*seg.slope),h=top-y-r;if(h>.002)for(let z of [-.30,0,.30])block(id+'-bearing-fit-'+i+'-'+z,x,y+r,z,.07,h,.06,1);}});
 if(id==='frame13'){
  let pts=[[543,1208],[557,1200],[577,1191],[604,1184],[625,1188],[650,1201],[670,1218]],outer=pts.map(pt),inner=pts.slice().reverse().map(([x,y])=>pt([x,y+10]));put('frame13-you-chun-arch',woodProfile([...outer,...inner],.17),M.identity(),1);
 }
 workshop.definition.sourceFrame={source:'L8',printedFigure:'图7',case:f.sourceCase,source_plane_pixels:f,pixel_image_size:[1170,1620],status:f.status,depth_m:depth,depth_status:'display assumption',roof:'rafter lines only; tile layering not inferred from the schematic',unresolved:'beam mortises, decorative profiles and structural behavior not verified'};
 workshop.connections.push({a:id+'-posts',b:id+'-purlins',kind:'column top to purlin underside',display_contact:true,historical_joint_verified:false});
}
function buildYouChun(api){
 const {put,block,log,workshop}=api,base=2.82,S=(4.13-3.78)/(413-378),depth=.24;
 // Detail plane uses qa/L8-right.png, and three labeled heights; horizontal dimensions remain independent.
 const p=([x,y])=>[(x-88)*.006,(918-y)*(4.13/(918-58))];
 for(let [i,x]of [88,538].entries()){let q=p([x,918]);block('you-chun-post-'+i,q[0],0,0,.19,3.78,.19,1);block('you-chun-base-'+i,q[0],0,0,.28,.15,.28);}
 for(let [i,y,h]of [[0,190,47],[1,255,39],[2,299,42]]){let a=p([88,y+h]),b=p([642,y]),cx=(a[0]+b[0])/2,bm=woodBox(b[0]-a[0],b[1]-a[1],depth);put('you-chun-band-'+i,bm,M.translate(cx,a[1],0),1);
  const fronts=[];for(let k=0;k<bm.idx.length;k+=3){let v=[0,1,2].map(j=>Array.from(bm.p.slice(bm.idx[k+j]*3,bm.idx[k+j]*3+3)));if(v.some(p=>p[2]<depth*.4))continue;let [A,B,C]=v,D=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]);if(Math.abs(D)>1e-12)fronts.push({A,B,C,D,x0:Math.min(A[0],B[0],C[0]),x1:Math.max(A[0],B[0],C[0]),y0:Math.min(A[1],B[1],C[1]),y1:Math.max(A[1],B[1],C[1])});}
  const surface=(x,y)=>{x-=cx;y-=a[1];let found=-Infinity;for(let t of fronts){if(x<t.x0-1e-6||x>t.x1+1e-6||y<t.y0-1e-6||y>t.y1+1e-6)continue;let {A,B,C,D}=t,u=((B[1]-C[1])*(x-C[0])+(C[0]-B[0])*(y-C[1]))/D,w=((C[1]-A[1])*(x-C[0])+(A[0]-C[0])*(y-C[1]))/D;if(u>=-1e-6&&w>=-1e-6&&u+w<=1.000001)found=Math.max(found,u*A[2]+w*B[2]+(1-u-w)*C[2]);}return Number.isFinite(found)?found:depth/2;};
  const G=new Mesh();for(let rings of PAINT_CURVES['band'+i].polygons){let points=rings.flat(),holes=[],n=rings[0].length;for(let ring of rings.slice(1)){holes.push(n);n+=ring.length;}let base=G.p.length/3;for(let q of points){let [x,y]=p(q);G.vertex([x,y,surface(x,y)+.0006]);}let indices=triangulateHoles(points.flat(),holes,2);for(let j=0;j<indices.length;j+=3){let a=indices[j],b=indices[j+1],c=indices[j+2],A=points[a],B=points[b],C=points[c];if((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])>0)G.tri(base+c,base+b,base+a);else G.tri(base+a,base+b,base+c);}}
  G.definition={kind:'source ink on timber face',source:'L8 figure8',roi:PAINT_CURVES['band'+i].roi,paint_color_status:'black is diagram ink only; historical pigments unknown',surface_fit:'barycentric interpolation of actual displaced beam triangles',display_depth_bias_m:.0006};put('you-chun-source-ink-'+i,G.finish(false),M.identity(),6);
 }
 const tails=[[[632,190],[654,185],[681,187],[701,194],[710,206],[700,217],[680,225],[658,227],[642,234],[632,234]],[[632,255],[653,245],[671,248],[682,255],[675,268],[657,277],[653,288],[641,298],[632,298]]];tails.forEach((poly,i)=>put('you-chun-profiled-tail-'+i,woodProfile(poly.map(p),depth),M.identity(),1));
 // Curved upper member follows the source outline and is independent of the sloping main roof.
 const top=[[87,151],[144,129],[203,105],[255,78],[290,62],[320,58],[354,63],[407,81],[470,108],[538,136]],bot=top.slice().reverse().map(([x,y])=>[x,y+13]);put('you-chun-curved-member',woodProfile([...top,...bot].map(p),depth),M.identity(),1);
 for(let [i,q]of [[88,164],[222,109],[398,109],[538,165],[641,177]].entries()){let [x,y]=p(q);log('you-chun-purlin-'+i,x,y,0,.075,.7);let bottom=p([q[0],190])[1];if(y-.075>bottom)block('you-chun-bearing-'+i,x,bottom,0,.10,y-.075-bottom,.18,1);}
 block('you-chun-door-lintel',1.35,2.745,0,2.7,.075,.24,1);block('you-chun-threshold',1.35,0,0,2.7,.17,.27,1);
 // Door was marked removed in the reference: retain its boundary, no fabricated carved door.
 workshop.definition.sourceFrame={source:'L8',printedFigure:'图8',case:'响应寺大殿游椿及彩画',height_labels_m:[0,2.82,3.78,4.13],transcribed_sections_cm:{天头:[15,24],门枋:[7.5,24],门槛:[17,27]},status:'游椿弧形与梁端按图观察；三道梁枋面保留原图墨线，其他比例与进深为显示假设',paint:'three installed beam bands retain source ink; independent samples shown separately, no historical palette inferred',door:'source labels lattice door removed; no replacement invented',joint_status:'mortises and structural behavior unknown'};
}
