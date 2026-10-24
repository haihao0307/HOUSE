from pathlib import Path
H=Path(__file__).parent
s=Path('G:/HOUSE/tiles-mother-measured-09-20261024/study.js').read_text(encoding='utf-8')
s=s.replace(" ['jointD2','timber'", " ['joinery','timber','榫卯验证台 · 真孔与缩肩榫','D2,D3,D4,D6','A02'],['jointD2','timber'")
s=s.replace("put(id,boxMesh(w,h,d),M.translate", "put(id,type===1?woodBox(w,h,d):boxMesh(w,h,d),M.translate")
s=s.replace('return[boxMesh(w,len,d),mat]', 'return[woodBox(w,len,d),mat]')
s=s.replace("let g=timber();g.definition={kind:'unit circular cylinder',radius:1,length:1,dimensions_in_instance_transform:true};return put(id,g,model(x,y,z,0,ry,[r,r,l]),1)","let g=woodRound(r,l);return put(id,g,model(x,y,z,0,ry),1)")
a=s.index(' const makeRoof=');b=s.index(' const ridge=',a)
s=s[:a]+''' let roofSerial=0;
 const makeRoof=(cols=4,rows=5,withEnds=false,root=M.identity(),slope=.36,ownPurlins=true)=>{
  const serial=roofSerial++,p=spec(),seat=roofSeats(),{spacing,step,rise,coverY,roll,angle,phase,panAngle}=seat,tilt=M.mul(root,M.rx(-slope)),total=(rows-1)*step+p.pan.l,base=.089;
  const frame=m=>M.mul(tilt,m),pan=shellMesh('pan'),cover=shellMesh('cover');
  for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
   const x=(c-(cols-1)/2)*spacing,z=(r-(rows-1)/2)*step,y=base+r*rise;
   put('pan'+STUDY.set,pan,frame(M.mul(M.translate(x,y+E*.09,z),M.rx(panAngle))));
   const deckSlope=rise/step,deckBase=.060+deckSlope*(z+total/2);
   put('bedding-'+serial+'-'+r,conformingBed(pan,panAngle,r===0?null:p.pan.l/2-step+.004,deckBase-y,deckSlope),frame(M.translate(x,y,z)));
   if(c<cols-1)put('cover'+STUDY.set,cover,frame(M.mul(M.translate(x+spacing/2,y+coverY+E*.16,z+phase),M.mul(M.rz(roll),M.rx(angle)))));
   this.stats.originalTiles+=c<cols-1?2:1;
   if(withEnds&&r===0){
    // Source diameter is used once; no arbitrary .8 scale. Join back plane to the carrier end.
    const drip=traceMesh('dripFloral'),top=SOURCE_CURVES.dripFloral.height_m/2;
    put('dripFloral',drip,frame(model(x,y+p.pan.h-top,z-p.pan.l/2-STUDY.depth/2,0,Math.PI)));
    if(c<cols-1){let scale=p.end/SOURCE_CURVES.flower.width_m;
     put('flower',traceMesh('flower'),frame(model(x+spacing/2,y+coverY+p.cover.h-p.end/2+Math.sin(angle)*(p.cover.body+p.cover.neck)/2,z+phase-(p.cover.body+p.cover.neck)/2-STUDY.depth/2,0,Math.PI,[scale,scale,1])));}
   }
  }
  // Explicit continuous bedding joins shell undersides to the rafter/deck layer.
  for(let c=0;c<cols;c++)put('roof-rafter-'+serial,woodRound(.024,total),frame(M.mul(M.translate((c-(cols-1)/2)*spacing,.024+rise/step*total/2,0),M.rx(-Math.atan(rise/step)))),1);
  if(ownPurlins)for(let z of [-total*.35,total*.35])put('roof-purlin-'+serial,woodRound(.032,cols*spacing+.10),frame(model(0,-.032+rise/step*(z+total/2),z,0,Math.PI/2)),1);
  const deckSlope=rise/step;put('deck-'+serial,woodBox(cols*spacing,.012,total),frame(M.mul(M.translate(0,.048+deckSlope*total/2,0),M.rx(-Math.atan(deckSlope)))),1);
  this.definition.roofSeating=seat;this.connections.push({a:'cover',b:'two adjacent pans',kind:'projected_triangle_contact',algorithm:'actual 08D-displaced triangles',seat,validated:false},{a:'pan',b:'bedding/deck/rafter/purlin',kind:'support_chain',bedding_status:'assumed filler; geometric conformance pending'});
 };
''' +s[b:]
a=s.index("  // Traced section proportions;");b=s.index(" }else if(e.family==='house')",a)
s=s[:a]+'''  // A demonstrable joint assembly. Joint dimensions are parameters; drawings do not specify them.
  if(e.id==='joinery'){
  const postH=.71,postW=.17,postD=.20,beamY=.57,span=.78;
  const holeH=.081,holeD=.061,tenH=.08,tenD=.06,tenL=.17;
  const rawPost=TimberOriginal.createMortisedPostGeometry({length:postH,width:postW,depth:postD,mortiseCenter:beamY-postH/2,mortiseHeight:holeH,mortiseDepth:holeD});
  for(let side of [-1,1])put('mortised-column',woodMesh(rawPost,'y',postH/2),M.translate(side*(span/2+postW/2),0,0),1);
  const rawBeam=TimberOriginal.createTenonedBeamGeometry({bodyLength:span,bodyHeight:.15,bodyDepth:.12,tenonLength:tenL,tenonHeight:tenH,tenonDepth:tenD});
  put('tenoned-beam',woodMesh(rawBeam),M.translate(E*.85,beamY+E*.25,0),1);
  // Separate bearing blocks stand on the beam, then carry purlins and the sloped rafter.
  for(let side of [-1,1]){
   const x=side*.31,y=.76+side*.055;
   block('bearing-block'+side,x,beamY+.075,0,.10,y-.045-(beamY+.075),.14,1);
   log('purlin'+side,x,y,0,.045,.50);
  }
  bar('rafter',[-.53,.711,0],[.53,.899,0],.055,.085);
  this.definition.joinery={type:'through rectangular mortise with reduced beam tenons',source:'existing timber-original geometry',historical_status:'illustrative joinery; drawing does not provide this joint detail',mortise_m:[postW,holeH,holeD],tenon_m:[tenL,tenH,tenD],clearance_each_side_m:[.0005,.0005],shoulder_contact:true,explosion:E};
  this.connections.push({a:'tenoned-beam',b:'mortised-columns',kind:'true_void_and_tenon',validated:E===0,validation:'parametric containment: tenon height/depth less than mortise by 1 mm; shoulder at column side; through length 170 mm'});
  }else{
   const short=e.id==='jointD3',span=short?.740:1.120,hangX=.435,beamTop=short?.66:.663,beamBottom=short?.46:.488,beamH=beamTop-beamBottom,beamY=(beamTop+beamBottom)/2;
   const post=(id,x,bottom,top,width,depth)=>{
    let raw=TimberOriginal.createMortisedPostGeometry({length:top-bottom,width,depth,mortiseCenter:beamY-(top+bottom)/2,mortiseHeight:beamH+.001,mortiseDepth:.141});
    return put(id,woodMesh(raw,'y',(top+bottom)/2),M.translate(x,0,0),1);
   };
   post('wall-post',0,.05,.92,.14,.20);
   const beamOutline=[[-.09,beamBottom],[span-.16,beamBottom],[span-.10,beamBottom+.025],[span-.095,beamBottom+.060],[span-.05,beamBottom+.085],[span-.05,beamTop],[-.09,beamTop]];
   put('profiled-through-beam',woodProfile(beamOutline,.14),M.translate(E*.65,E*.12,0),1);
   if(!short){
    post('hanging-post',hangX,.198,.773,.195,.195);
    put('hanging-finial',woodFinial([[.198,.0975],[.17,.0975],[.135,.065],[.120,.035],[.095,.035],[.075,.06],[.035,.095],[-.017,.0975]]),M.translate(hangX,0,0),1);
    // Front elevation stepped brackets are kept distinct from the side-profile beam.
    for(let side of [-1,1]){
     const poly=[[.100,.48],[.16,.48],[.16,.52],[.21,.52],[.21,.56],[.27,.56],[.27,.663],[.100,.663]].map(([x,y])=>[side*x,y]);
     put('front-bracket-'+side,woodProfile(poly,.055),model(hangX,0,0,0,Math.PI/2),1);
    }
   }
   const center=short?.32:.435,rows=short?4:6,roofY=short?.91:.883;
   makeRoof(2,rows,true,model(center,roofY,0,0,-Math.PI/2),.33);
   // Bearing heights follow the actual roof frame, so posts no longer stop in empty air.
   const seat=roofSeats(),total=(rows-1)*seat.step+spec().pan.l;
   if(!short){let localY=-.032+seat.rise/seat.step*total/2,y=roofY+Math.cos(.33)*localY,x=center+Math.sin(.33)*localY;log('hanging-post-purlin',x,y,0,.032,2*seat.spacing+.10);block('hanging-post-bearing',x,.773,0,.10,y-.032-.773,.14,1);}
   for(let f of [-.35,.35]){let z=total*f,localY=-.032+seat.rise/seat.step*(z+total/2),worldY=roofY+Math.cos(.33)*localY+Math.sin(.33)*z,x=center-Math.cos(.33)*z+Math.sin(.33)*localY,bottom=beamTop;
    if(worldY-.032>bottom)block('roof-bearing-'+f,x,bottom,0,.065,worldY-.032-bottom,.14,1);
   }
   this.definition.joinery={type:'through beam in cut post; stepped brackets and hanging finial where drawn',historical_status:'source-led study; tenon/mortise depth not measured',clearance_each_side_m:.0005,beamHeight_m:beamH};
   this.definition.transcribed_candidates_mm=short?{eave:740,lowerStep:510,intermediate:598}:{eave:1120,hangingPostX:435,finialWidth:195,elevations:[4020,3840,3773,3663,3488,3198,2983]};
   this.connections.push({a:'through-beam',b:'cut wall/hanging posts',kind:'real mortise void',validated:false,note:'void matches displayed beam; full historical node and all secondary contacts remain study evidence'});
  }
''' +s[b:]
s=s.replace("if(e.family==='timber')return '按图中支承顺序建立梁、檩、椽、瓦与挑木；横向长度、榫卯深度与夹层未给出。当前为关系研究模型，接触与榫卯尚未验收。';","if(e.family==='timber')return e.id==='joinery'?'真实榫眼与缩肩榫头，可用拆解滑杆查看孔壁和端纹。榫眼/榫头截面相差1 mm，肩部贴柱；这是榫卯验证节点，不代表图纸中未画出的具体做法。':'保留图示的挑梁侧形、垂柱和正面层叠关系；D3按独立短挑檐处理。柱体已实际开孔，瓦采用共同搭接规则。榫眼深度、横向跨度与部分细节仍是研究参数，完整历史节点尚未定稿。';")
s=s.replace('截面采用半椭圆，未被原图唯一确定。','恢复08D圆弧薄壳、手工边口与Microscope真实位移；弧线为模型假设。')
s=s.replace('model(0,.055,-.139+STUDY.depth/2)','model(0,.064+p.cover.h-.0615,-(p.cover.body+p.cover.neck)/2-STUDY.depth/2)')
# Replace isolated, horizontal cover pieces on the house with the same tested roof assembly.
start=s.index("for(let r=0;r<16;r++)for(let c=0;c<4;c++)")
end=s.index('this.definition.transcribed_dimensions_cm=',start)
s=s[:start]+"makeRoof(3,17,false,model(.95,5.628,0,0,Math.PI/2),.345,false);makeRoof(3,11,false,model(-1.20,3.388,0,0,Math.PI/2),.321,false);block('upper-tie-beam',1.35,4.81,0,2.7,.30,.13,1);block('mid-roof-post',1.35,5.11,0,.13,.535,.13,1);block('floor-tie-beam',1.35,2.60,0,2.7,.13,.13,1);log('porch-purlin',-1.3,3.31,0,.08,zSpan+.15);log('porch-wall-purlin',0,3.79,0,.08,zSpan+.15);"+s[end:]
s=s.replace("for(let [x,y] of [[0,5.11],[1.35,5.55],[2.7,6.18]])log('purlin',x,y,0,.10,zSpan+.15);","for(let [x,y] of [[0,5.21],[1.35,5.745],[2.7,6.28]])log('purlin',x,y,0,.10,zSpan+.15);")
s=s.replace("block('upper-floor',1.35,2.73,0,2.7,.10,zSpan,1)","block('upper-floor',1.3475,2.73,0,2.465,.10,zSpan,1)")
s=s.replace("block('porch-beam',-.65,2.73,0,1.3,.20,.16,1)","block('porch-beam',-.65,2.60,0,1.3,.13,.13,1)")
s=s.replace("block(id,x,0,0,width,height,zSpan*.20,1);", "let holes=main?[{y:2.665,h:.131,d:.131},...(height>5?[{y:4.96,h:.301,d:.131}]:[])]:[];put(id,holes.length?multiMortisedPost(height,width,width,holes):woodBox(width,height,width),M.translate(x,0,0),1);")
s=s.replace("bar('main-roof-rafter',[-.8,5.11,0],[2.7,6.18,0],.10,zSpan);bar('porch-roof',[-2.40,2.87,0],[0,3.82,0],.09,zSpan);",'')
s=s.replace("bar('left-roof',[-1.6,4.12,0],[0,4.65,0],.08,zSpan);bar('right-roof',[0,4.65,0],[2.2,4.02,0],.08,zSpan);","makeRoof(3,7,false,model(-.80,4.295,0,0,Math.PI/2),.287);makeRoof(3,10,false,model(1.10,4.245,0,0,-Math.PI/2),.246);")
s=s.replace("bar('roof',[-.85,4.58,0],[2.6,5.88,0],.09,zSpan);bar('porch-roof',[-1.4,2.75,0],[0,3.25,0],.07,zSpan);","makeRoof(3,16,false,model(.875,5.14,0,0,Math.PI/2),.328);makeRoof(3,6,false,model(-.7,2.91,0,0,Math.PI/2),.31);")
s=s.replace("'连接状态：候选关系，几何接触未验收'","(e.family==='timber'?'榫卯：真实开孔 / 可拆解检查':'屋面：按实际三角面求搭接与盖缝')")
s=s.replace("yaw:e.family==='pattern'||e.family==='ornament'?-.30:-.63", "yaw:e.id==='eaves'?2.55:e.id==='jointD4'?1.45:e.family==='pattern'||e.family==='ornament'?-.30:-.63")
s=s.replace("document.getElementById(id).onchange=()=>rebuild(false)","document.getElementById(id).onchange=()=>rebuild(key==='explode')")
s=s.replace("put('floor',floorMesh()", "put('__ground',floorMesh()").replace("this.groups.get('floor').cast=false", "this.groups.get('__ground').cast=false")
s=s.replace("function dimensionRows(){let e=currentEntry();", "function dimensionRows(){let e=currentEntry();if(e.id==='joinery')return [['榫头截面','80 × 60 mm'],['榫眼截面','81 × 61 mm'],['单侧间隙','0.5 mm（展示参数）'],['肩部与柱侧','合拢时同一接触平面'],['来源界限','几何验证节点，非原图确定榫型']];if(['roofPatch','eaves'].includes(e.id)){let q=workshop?.definition?.roofSeating;return [['板瓦横向净让位','包含薄壳厚度外扩'],['顺坡搭接','实际三角面求解'],['左右支承','0.5 mm 内为数字验收阈值'],['当前接触',''+(q&&q.coverLap.pass&&q.panLap.pass&&q.checks.filter(c=>c.row===0).every(c=>c.pass&&c.minGapM<=.0005)?'通过':'待核')],['承托层','按瓦底拟合；厚度非历史实测']];}")
s=s.replace("if(e.family==='house')return", "if(['roofPatch','eaves'].includes(e.id))return '使用08D瓦体与位移规则，重新求顺坡搭接和左右支承；改变起伏后重新求解。瓦下承托层由瓦底拟合，是显示构造假设。数字接触通过不代表排水、受力或历史尺寸验证。';if(e.family==='house')return",1)
(H/'study.js').write_text(s,encoding='utf-8')
