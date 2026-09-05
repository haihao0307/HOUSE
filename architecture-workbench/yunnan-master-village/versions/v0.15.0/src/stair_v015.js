// V0.15: one data source for treads, landings, supports and walking footprints.
// Placement is a circulation candidate; no SU measurement is asserted here.
const stairGroup=new THREE.Group();groups.floor.add(stairGroup);const stairWidth=1.00;
const S15=Object.freeze({width:stairWidth,groundTop:.21,top:P.floorTop,risers:16,tread:.26,thickness:.065,
 x:4.10,topZ:-3.60,midFrontZ:-5.42,midBackZ:-6.56,midWestX:3.53,midEastX:4.67,lowerStartX:6.49});
const stairRise=(S15.top-S15.groundTop)/S15.risers,landingY=S15.groundTop+8*stairRise;
const stairStart=new THREE.Vector3(S15.lowerStartX,S15.groundTop,-5.99),stairTurn=new THREE.Vector3(4.10,landingY,-5.99),stairEnd=new THREE.Vector3(4.10,P.floorTop,-3.30);
const walkSurfaces=[],stairTreads=[],stairBearers=[],stairPads=[],stairContactTests=[];
function surfaceRect(obj,id,x0,x1,z0,z1,top,role){walkSurfaces.push({obj,id,x0,x1,z0,z1,top,role});return obj;}
function stairBox(id,name,bounds,top,thick,mat,role,support=[]){const[x0,x1,z0,z1]=bounds;
 const o=box(stairGroup,[x1-x0,thick,z1-z0],[(x0+x1)/2,top-thick/2,(z0+z1)/2],mat,meta(id,name,'floor',support,{topY:top,locationStatus:'circulation_candidate_not_su_measurement',role}),0);
 stairMembers.push(o);if(role==='tread'||role==='landing')surfaceRect(o,id,x0,x1,z0,z1,top,role);return o;}
const bottomLanding=stairBox('STAIR-BASE-LANDING','木梯起步石台，落入地面',[6.49,7.26,-6.56,-5.42],.21,.39,mats.stone,'landing',['COMPACTED-SITE']);stairPads.push(bottomLanding);
const exitStep=stairBox('STAIR-EXIT-STEP','起步石台至院地过渡级',[7.26,7.60,-6.56,-5.42],.105,.27,mats.stone,'tread',['COMPACTED-SITE']);stairPads.push(exitStep);
const stairLanding=stairBox('STAIR-TURN-LANDING','两跑木梯中间转向平台',[3.53,4.67,-6.56,-5.42],landingY,.09,mats.woodLight,'landing',['STAIR-LANDING-BEARER-N','STAIR-LANDING-BEARER-S']);
const topLanding=stairBox('STAIR-TOP-LANDING','二楼木廊接梯平口，不覆盖踏步',[3.56,4.64,-3.60,-3.30],P.floorTop,.036,mats.woodLight,'landing',['STAIR-TOP-BRIDGE','GJOIST-2-0']);
// Treads terminate at the landing faces, never at their centres.
const lowerCount=7,upperCount=7;
for(let i=0;i<7;i++){
 const x1=6.49-i*S15.tread,x0=x1-S15.tread,top=.21+(i+1)*stairRise;
 stairTreads.push(stairBox(`STAIR-LOWER-TREAD-${i}`,'下跑木踏步',[x0,x1,-6.49,-5.49],top,S15.thickness,mats.woodLight,'tread',['STAIR-LOWER-STRING-N','STAIR-LOWER-STRING-S']));
 const z0=-5.42+i*S15.tread,z1=z0+S15.tread,up=landingY+(i+1)*stairRise;
 stairTreads.push(stairBox(`STAIR-UPPER-TREAD-${i}`,'上跑木踏步',[3.60,4.60,z0,z1],up,S15.thickness,mats.woodLight,'tread',['STAIR-UPPER-STRING-W','STAIR-UPPER-STRING-E']));
}
function string15(id,start,end,offset,run){const a=start.clone(),b=end.clone(),dir=b.clone().sub(a).setY(0).normalize();
 const slope=stairRise/S15.tread,cos=1/Math.sqrt(1+slope*slope),drop=S15.thickness+.20/(2*cos);
 a.y+=stairRise/2-drop;b.y-=stairRise/2+drop;
 if(run==='lower'){a.z+=offset;b.z+=offset;}else{a.x+=offset;b.x+=offset;}
 a.addScaledVector(dir,-.13);a.y-=slope*.13;b.addScaledVector(dir,.13);b.y+=slope*.13;
 const o=beam(stairGroup,a.toArray(),b.toArray(),.12,.20,mats.woodDark,meta(id,'承托每级踏步的通长木斜梁','floor',run==='lower'?['STAIR-BASE-LANDING','STAIR-LANDING-BEARER-N']:['STAIR-TURN-LANDING','STAIR-TOP-BRIDGE'],{run,continuous:true}));stairMembers.push(o);stairBearers.push(o);return o;
}
for(const side of[-1,1]){string15('STAIR-LOWER-STRING-'+(side<0?'N':'S'),new THREE.Vector3(6.49,.21,-5.99),new THREE.Vector3(4.67,landingY,-5.99),side*.44,'lower');string15('STAIR-UPPER-STRING-'+(side<0?'W':'E'),new THREE.Vector3(4.10,landingY,-5.42),new THREE.Vector3(4.10,P.floorTop,-3.60),side*.44,'upper');}
for(const zz of[-6.43,-5.55]){const id=zz<-6?'N':'S';const bearer=beam(stairGroup,[3.58,landingY-.18,zz],[4.62,landingY-.18,zz],.13,.18,mats.woodDark,meta(`STAIR-LANDING-BEARER-${id}`,'平台下承托梁','floor',['STAIR-LANDING-POST-'+id+'-W','STAIR-LANDING-POST-'+id+'-E']));stairMembers.push(bearer);stairBearers.push(bearer);
 for(const xx of[3.65,4.55]){const side=xx<4.1?'W':'E',pid=`STAIR-LANDING-POST-${id}-${side}`,pad=stairBox(pid+'-FOOT','平台支柱石脚',[xx-.13,xx+.13,zz-.13,zz+.13],.15,.28,mats.stone,'support',['COMPACTED-SITE']);stairPads.push(pad);const post=beam(stairGroup,[xx,.15,zz],[xx,landingY-.27,zz],.105,.105,mats.wood,meta(pid,'平台支柱，柱脚落石座','floor',[pid+'-FOOT']));stairMembers.push(post);}}
const topBridge=beam(stairGroup,[3.54,P.floorTop-.126,-3.53],[4.66,P.floorTop-.126,-3.53],.12,.18,mats.woodDark,meta('STAIR-TOP-BRIDGE','接梯平台下边梁','floor',['STAIR-TOP-OUTRIGGER-W','STAIR-TOP-OUTRIGGER-E']));stairMembers.push(topBridge);stairBearers.push(topBridge);
for(const xx of[3.64,4.56]){const o=beam(stairGroup,[xx,P.floorTop-.126,-3.58],[xx,P.floorTop-.126,-2.98],.11,.18,mats.woodDark,meta('STAIR-TOP-OUTRIGGER-'+(xx<4.1?'W':'E'),'接梯小平台与廊楼楞联系','floor',['GJOIST-2-0','GJOIST-2-1']));stairMembers.push(o);stairBearers.push(o);}
const railing=new THREE.Group();groups.floor.add(railing);railing.visible=false;
addLabel('侧向起步 → 转台 → 二楼平口 · 人员沿实踏步下行',[4.10,2.10,-5.10],s=>s.boards>0&&(state.axes||state.view==='floor'||state.view==='walk'));
