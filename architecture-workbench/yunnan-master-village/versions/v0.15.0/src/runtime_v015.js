/* V0.15 incremental layer: measured mesh surfaces -> footfalls -> stair circulation.
   The legacy frame generator, rig handoff and audio engine remain untouched. */
const walkReplay15={enabled:false,time:0};let walkingState15=[],mealState15={},doorAmount15=0;
state.doorManual=false;
const walkBadge15=document.createElement('div');walkBadge15.id='walkBadge15';walkBadge15.hidden=true;viewport.appendChild(walkBadge15);
const upstairsStarts15=[[2.70,-.72],[3.40,-.55],[4.10,-.84]];
// Register only existing physical surfaces. Joint gaps are accepted within 6 mm;
// no invisible ramp is placed over the staircase.
scene.updateMatrixWorld(true);
for(const o of boardMembers){const b=new THREE.Box3().setFromObject(o);surfaceRect(o,o.userData.record.id,b.min.x,b.max.x,b.min.z,b.max.z,b.max.y,'board');}
const surfaceAt15=(x,z,s)=>{let best=null;for(const r of walkSurfaces){if(x>=r.x0-.006&&x<=r.x1+.006&&z>=r.z0-.006&&z<=r.z1+.006&&(!best||r.top>best.top))best=r;}return best?{y:best.top,id:best.id,role:best.role}:{y:groundHeightAt(x,z,s),id:'TERRAIN',role:'ground'};};
function flatNodes15(nodes,to,tag){const from=nodes.at(-1),dx=to[0]-from.x,dz=to[1]-from.z,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.29));for(let i=1;i<=n;i++)nodes.push({x:from.x+dx*i/n,z:from.z+dz*i/n,tag});}
function makeRoute15(j){const[x,z]=upstairsStarts15[j],nodes=[{x,z,tag:'楼面收工具'}];
 flatNodes15(nodes,[3.40,-1.03],'走向东间门洞');flatNodes15(nodes,[3.40,-2.30],'通过二楼门');flatNodes15(nodes,[3.40,-2.72],'院侧木廊');flatNodes15(nodes,[4.10,-2.72],'院侧木廊');flatNodes15(nodes,[4.10,-3.45],'上口平接');
 // Tread centre positions are derived from the generated rectangles.
 for(let i=6;i>=0;i--){const r=walkSurfaces.find(v=>v.id===`STAIR-UPPER-TREAD-${i}`);nodes.push({x:(r.x0+r.x1)/2,z:(r.z0+r.z1)/2,tag:'上跑下行',surfaceId:r.id});}
 flatNodes15(nodes,[4.10,-5.99],'转向平台');flatNodes15(nodes,[4.50,-5.99],'平台转身');
 for(let i=6;i>=0;i--){const r=walkSurfaces.find(v=>v.id===`STAIR-LOWER-TREAD-${i}`);nodes.push({x:(r.x0+r.x1)/2,z:(r.z0+r.z1)/2,tag:'下跑下行',surfaceId:r.id});}
 flatNodes15(nodes,[6.84,-5.99],'起步石台');nodes.push({x:7.43,z:-5.99,tag:'落地过渡级',surfaceId:'STAIR-EXIT-STEP'});nodes.push({x:7.80,z:-5.99,tag:'回到院地'});
 flatNodes15(nodes,[7.86,-6.95],'离开梯脚');flatNodes15(nodes,[2.45+j*.78,-6.95],'前院候席');
 let d=0;nodes.forEach((p,i)=>{if(i){const a=nodes[i-1];d+=Math.hypot(p.x-a.x,p.z-a.z);}p.distance=d;const a=nodes[Math.max(0,i-1)],b=nodes[Math.min(nodes.length-1,i+1)];p.heading=Math.atan2(b.x-a.x,b.z-a.z);});
 return{nodes,length:d,duration:Math.max(33,(nodes.length-1)*.53),worker:builders[j].id};}
const walkRoutes15=[0,1,2].map(makeRoute15);
const uprightObstacle15=[];
registry.forEach(o=>{const r=o.userData.record;if(r&&['beam','tie','purlin','column','post','wall'].includes(r.category))uprightObstacle15.push(o);});
function visible15(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
let overheadCache15=[],overheadKey15='',ceilingRay15=new THREE.Raycaster();
function prepareOverhead15(s){const key=s.stageKey+':'+(s.enclosure>.99)+':'+(s.rafters>.99);if(key===overheadKey15)return;overheadKey15=key;overheadCache15=[];
 for(const o of uprightObstacle15){if(!visible15(o))continue;const r=o.userData.record;if(!['beam','tie','purlin'].includes(r.category)&&!r.id.startsWith('ENC-LINTEL'))continue;overheadCache15.push({mesh:o,bb:new THREE.Box3().setFromObject(o),id:r.id});}}
function ceiling15(x,z,y){let low=Infinity,id=null;for(const q of overheadCache15){if(q.id.startsWith('RAFTER-')||q.bb.max.y-q.bb.min.y>.5)continue;if(q.bb.min.y>y+.60&&x>=q.bb.min.x-.35&&x<=q.bb.max.x+.35&&z>=q.bb.min.z-.35&&z<=q.bb.max.z+.35&&q.bb.min.y<low){low=q.bb.min.y;id=q.id;}}const candidates=overheadCache15.filter(q=>x>=q.bb.min.x-.35&&x<=q.bb.max.x+.35&&z>=q.bb.min.z-.35&&z<=q.bb.max.z+.35&&q.bb.max.y>y+.65).map(q=>q.mesh);
 for(const[dx,dz]of[[0,0],[-.33,0],[.33,0],[0,-.33],[0,.33],[-.23,-.23],[.23,-.23],[-.23,.23],[.23,.23]]){ceilingRay15.set(new THREE.Vector3(x+dx,12,z+dz),new THREE.Vector3(0,-1,0));const hits=ceilingRay15.intersectObjects(candidates,false);for(const hit of hits){if(hit.point.y<y+.65)continue;const q=hit.object;let underside=hit.point.y;
 // A second upward ray returns the actual underside of the same member.
 ceilingRay15.set(new THREE.Vector3(x+dx,y+.50,z+dz),new THREE.Vector3(0,1,0));const below=ceilingRay15.intersectObject(q,false).find(h=>h.point.y>y+.50);if(below)underside=below.point.y;
 if(underside<low){low=underside;id=q.userData.record.id;}}}
 return{y:low,id};}
function overheadDuck15(x,z,y){const c=ceiling15(x,z,y);return Math.min(.52,Math.max(0,1.81+.065-(c.y-y)));}
function footPlacement15(route,index,side,s){const n=route.nodes[Math.max(0,Math.min(route.nodes.length-1,index))],offset=.095;
 const x=n.x+side*offset*Math.cos(n.heading),z=n.z-side*offset*Math.sin(n.heading),surf=surfaceAt15(x,z,s);
 return{x,z,y:surf.y,heading:n.heading,support:surf.id,tag:n.tag};}
function angleMix15(a,b,q){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*q;}
function legIK15(w,j,hip,ankle){const a=.425,b=.435,v=ankle.clone().sub(hip),d=Math.min(a+b-.001,Math.max(.08,v.length())),dir=v.clone().normalize(),k=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-k*k));let bend=new THREE.Vector3(0,0,1).addScaledVector(dir,-dir.z).normalize();if(bend.lengthSq()<.1)bend.set(1,0,0);const knee=hip.clone().addScaledVector(dir,k).addScaledVector(bend,h);poseBeam(w.legs[j*2],hip,knee);poseBeam(w.legs[j*2+1],knee,ankle);}
function poseWalk15(w,route,elapsed,s){const n=route.nodes.length-1,progress=clamp(elapsed/route.duration),continuous=progress*n,k=Math.max(1,Math.min(n,Math.floor(continuous)+1)),u=progress>=1?1:continuous-Math.floor(continuous),q=smooth(u),active=k%2,feet=[];
 for(let j=0;j<2;j++){const side=j?1:-1;if(j!==active)feet[j]=footPlacement15(route,k-1,side,s);else{const a=footPlacement15(route,Math.max(0,k-2),side,s),b=footPlacement15(route,k,side,s);const clearance=.13*Math.sin(Math.PI*u),drop=smooth(clamp((u-.66)/.34)),base=b.y<a.y?lerp(a.y,b.y,drop):lerp(a.y,b.y,smooth(clamp(u/.55)));feet[j]={x:lerp(a.x,b.x,q),z:lerp(a.z,b.z,q),y:base+clearance,heading:angleMix15(a.heading,b.heading,q),support:b.support,tag:b.tag,swing:u>.001&&u<.999};}}
 if(elapsed<=0||progress>=1){const ix=elapsed<=0?0:n;feet[0]=footPlacement15(route,ix,-1,s);feet[1]=footPlacement15(route,ix,1,s);}
 // Sole footprint support: heel and toe must clear each riser and the uneven yard.
 feet.forEach(f=>{let high=f.y;for(const[dx,dz]of[[-.084,-.104],[.084,-.104],[-.084,.104],[.084,.104],[0,0]]){const x=f.x+dx*Math.cos(f.heading)+dz*Math.sin(f.heading),z=f.z-dx*Math.sin(f.heading)+dz*Math.cos(f.heading);high=Math.max(high,surfaceAt15(x,z,s).y);}f.y=high;});
 const x=(feet[0].x+feet[1].x)/2,z=(feet[0].z+feet[1].z)/2,stance=feet[1-active],heelY=(feet[0].y+feet[1].y)/2-(feet[active].swing?.025:0),heading=angleMix15(feet[0].heading,feet[1].heading,.5),duck=overheadDuck15(x,z,heelY);
 poseHuman(w,x,z,heading,'walk',s.t,heelY+.006);w.tool.visible=false;w.basket.visible=false;w.waist.position.y=.90-duck;
 for(const part of[w.torso,w.head,w.neck,w.hat])part.position.y-=duck;w.torso.rotation.x=duck*.28;w.head.rotation.x=duck*.24;w.hat.rotation.x=duck*.24;
 const pelvis=.88-duck;w.g.updateMatrixWorld(true);const measured=[];
 feet.forEach((f,j)=>{const centre=new THREE.Vector3(f.x,f.y+.057,f.z),loc=w.g.worldToLocal(centre);w.feet[j].position.copy(loc);w.feet[j].rotation.set(0,angleMix15(heading,f.heading,1)-heading,0);w.feet[j].scale.z=.80;
 const ankle=w.g.worldToLocal(new THREE.Vector3(f.x,f.y+.115,f.z));legIK15(w,j,new THREE.Vector3(j?.105:-.105,pelvis,0),ankle);w.g.updateMatrixWorld(true);
 const soleY=new THREE.Box3().setFromObject(w.feet[j]).min.y,surf=surfaceAt15(f.x,f.z,s);measured.push({side:j?'right':'left',x:f.x,z:f.z,soleY,supportY:surf.y,supportId:surf.id,clearance:soleY-surf.y,swing:!!f.swing});});
 w.g.updateMatrixWorld(true);return{id:w.id,progress,elapsed,tag:route.nodes[Math.min(n,k)].tag,position:w.g.position.toArray(),duck,feet:measured,finished:progress>=1};}
function setHandWorld15(w,j,target){w.g.updateMatrixWorld(true);const p=w.g.worldToLocal(target.clone()),sh=new THREE.Vector3(j?.225:-.225,w.torso.position.y+.18,0),mid=sh.clone().lerp(p,.53);mid.x+=(j?1:-1)*.08;w.hands[j].position.copy(p);poseBeam(w.arms[j*2],sh,mid);poseBeam(w.arms[j*2+1],mid,p);}
function updateAccessDoor15(s,walkTime){const installed=s.enclosure>0,automatic=walkReplay15.enabled&&walkTime>=.4&&walkTime<58;doorAmount15=installed?(state.doorManual?1:automatic?smooth((walkTime-.4)/1.25):0):0;
 accessDoors.forEach(g=>g.rotation.y=g.userData.openSign*doorAmount15*Math.PI*.56);
 const b=$('#doorToggle15');if(b){b.disabled=!installed||automatic;b.textContent=!installed?'二楼门：待安装':automatic?'二楼门：通行中':doorAmount15>.85?'二楼门：已打开':'二楼门：关闭';}}
function circulationProbe15(){return{enabled:snapshot?.stage===I.descend||walkReplay15.enabled,mode:walkReplay15.enabled?'completed_building_replay':'construction_descent',time:walkReplay15.enabled?walkReplay15.time:snapshot?.stageProgress*STAGES[I.descend].duration,doorOpenDegrees:doorAmount15*100.8,workers:JSON.parse(JSON.stringify(walkingState15)),routes:walkRoutes15.map(r=>({worker:r.worker,steps:r.nodes.length,duration:r.duration})),sourceScaleStatus:P.sourceScaleStatus};}
function updateWalking15(s){walkingState15=[];const active=s.stage===I.descend||walkReplay15.enabled,elapsed=walkReplay15.enabled?walkReplay15.time:s.stageProgress*STAGES[I.descend].duration;
 updateAccessDoor15(s,elapsed);walkBadge15.hidden=!active;document.body.classList.toggle('walk-active15',active);
 if(walkReplay15.enabled){$('#timeline').max=62;$('#timeline').value=walkReplay15.time;$('#clock').textContent=fmt(walkReplay15.time)+' / '+fmt(62);$('#timelineTitle').textContent='成屋通行复核 · 开门后逐级下楼';$('#phaseCaption').textContent='保留已完工几何 · 独立62秒复核';}else{$('#timeline').max=TOTAL;$('#timelineTitle').textContent=STAGES[s.stage].title;}
 if(!active)return;prepareOverhead15(s);
 groups.siteCrew.visible=state.workers&&state.view!=='joint';builders.forEach(w=>w.g.visible=false);builderBowls.forEach(b=>b.visible=false);makerBowl.visible=false;
 for(let j=0;j<3;j++){const w=builders[j];w.g.visible=state.workers;walkingState15.push(poseWalk15(w,walkRoutes15[j],elapsed-j*7.0,s));}
 for(let j=3;j<6;j++){const w=builders[j],x=-3.8+(j-3)*1.15,z=-6.35;w.g.visible=state.workers;poseHuman(w,x,z,Math.PI/2,j%2?'carry':'chisel',s.t,groundHeightAt(x,z,s));}
 siteStatus.roles=walkingState15.map(w=>w.finished?'前院候席':w.tag);
 walkBadge15.innerHTML='<b>'+(walkReplay15.enabled?'成屋通行复核':'铺板收工 · 连续下楼')+'</b><br>东间门洞 → 木廊 → 上跑 → 转台 → 下跑 → 前院<br>'+walkingState15.map((w,i)=>'工人'+(i+1)+'：'+(w.finished?'已到院地':w.tag)).join('　');
}
// Keep the last floor-installation crew within the last bay. No cross-tie is removed.
const siteCrewPrevious15=updateSiteCrew;
updateSiteCrew=function(s){siteCrewPrevious15(s);if(s.stage===I.boards){floorWorkerState.length=0;for(let j=0;j<3;j++){const w=builders[j],installed=-5.1+10.2*clamp(s.boards*2),[x,z]=upstairsStarts15[j];w.g.visible=state.workers&&installed>x+.36;if(w.g.visible){poseHuman(w,x,z,0,j===1?'carry':'hammer',s.t,P.floorTop+.006);w.g.updateMatrixWorld(true);const yy=Math.min(...w.feet.map(f=>new THREE.Box3().setFromObject(f).min.y));floorWorkerState.push({id:w.id,x,z,minFootY:yy,deckTop:P.floorTop,clearance:yy-P.floorTop});}}}};
// One meal prop identity travels from the stone forecourt into the front earth court.
const tableStart15={x:-.5,z:-5.12},tableEnd15=P.feastCenter;
const tableFood15=[...feastBowls,feastPlatter,...feastFood,...feastSteam];feastFood.forEach(o=>o.visible=false);
const drumsticks15=[],drumstickMaterial15=new THREE.MeshStandardMaterial({color:0x995022,roughness:.77}),boneMaterial15=new THREE.MeshStandardMaterial({color:0xf2e2bd,roughness:.90});
for(let i=0;i<4;i++){const g=new THREE.Group();g.name='COOKED-CHICKEN-LEG-'+(i+1);feastGroup.add(g);g.position.set((i%2?1:-1)*.24,.95,(i<2?-1:1)*.20);g.rotation.y=(i%2?1:-1)*.7+(i<2?0:Math.PI);
 ellipsoid(g,[.115,.067,.16],[0,0,.035],drumstickMaterial15);cylinder(g,.062,.030,.20,[0,0,-.13],drumstickMaterial15,null,14).rotation.x=Math.PI/2;
 const bone=beam(g,[0,0,-.16],[0,0,-.30],.033,.033,boneMaterial15,meta('CHICKEN-LEG-'+(i+1),'熟鸡腿 '+(i+1)+'/4','atmosphere',[],{stage:'feast',countOfSourceChickens:2}),true);ellipsoid(g,[.033,.023,.027],[-.019,0,-.30],boneMaterial15);ellipsoid(g,[.033,.023,.027],[.019,0,-.30],boneMaterial15);drumsticks15.push(g);}
const mealSeats15=[[-2.30,-1.02,0],[-1.38,-1.02,0],[-.46,-1.02,0],[.46,-1.02,0],[1.38,-1.02,0],[2.30,-1.02,0],[-2.30,1.02,Math.PI],[-1.38,1.02,Math.PI],[-.46,1.02,Math.PI],[.46,1.02,Math.PI],[1.38,1.02,Math.PI],[2.30,1.02,Math.PI],[3.24,0,-Math.PI/2],[-3.24,0,Math.PI/2],[-3.30,-.82,Math.PI/2],[-3.30,.82,Math.PI/2],[3.30,.82,-Math.PI/2]];
const diners15=[...builders,...crew,...pushers,maker,cook,guest1,guest2,ritualVisitor];
const dinerBowls15=[...builderBowls,...crewFeastBowls,makerBowl,cookCup,cup1,cup2,cylinder(ritualVisitor.g,.076,.052,.052,[0,0,0],mats.plaster,null,16)];
const benches15=[];for(const zz of[-1.02,1.02]){const g=new THREE.Group();feastGroup.add(g);box(g,[5.6,.075,.35],[0,.475,zz],mats.woodLight,null,.01);for(const xx of[-2.35,0,2.35])for(const dz of[-.11,.11])beam(g,[xx,0,zz+dz],[xx,.437,zz+dz],.068,.068,mats.wood,null);benches15.push(g);}for(const q of mealSeats15.slice(12)){const g=new THREE.Group();feastGroup.add(g);cylinder(g,.22,.22,.065,[q[0],.472,q[1]],mats.woodLight,null,20);for(const sx of[-.13,.13])for(const sz of[-.13,.13])beam(g,[q[0]+sx,0,q[1]+sz],[q[0]+sx,.44,q[1]+sz],.065,.065,mats.wood,null);benches15.push(g);}
const waitDogSpots15=[[-2.70,-2.05],[-1.35,-2.17],[0,-2.22],[1.35,-2.17],[2.70,-2.05]];
dogFeedSpots.forEach((p,i)=>{p[0]=waitDogSpots15[i][0];p[1]=waitDogSpots15[i][1]+.30;dogFeedBowls[i*2].position.x=p[0];dogFeedBowls[i*2].position.z=p[1];dogFeedBowls[i*2+1].position.x=p[0];dogFeedBowls[i*2+1].position.z=p[1];});
function mealProbe15(){return{...mealState15,drumstickCount:drumsticks15.filter(o=>o.visible&&feastGroup.visible).length,liveChickens:village.chickens.filter(c=>c.g.visible&&groups.atmosphere.visible).length,table:feastGroup.position.toArray(),tableFootprint:{x0:feastGroup.position.x-2.775,x1:feastGroup.position.x+2.775,z0:feastGroup.position.z-.59,z1:feastGroup.position.z+.59},stoneBandFront:-5.60-.34};}
function poseDiner15(w,bowl,seat,k,t,s){const[x,z,h]=seat,xx=P.feastCenter.x+x,zz=P.feastCenter.z+z;w.g.visible=(k<13?state.workers:state.atmosphere)&&state.view!=='joint';poseHuman(w,xx,zz,h,k%3?'toast':'eat',t,groundHeightAt(xx,zz,s));w.tool.visible=false;w.basket.visible=false;bowl.visible=true;bowl.position.copy(w.hands[1].position);}
function updateMeal15(s){const setup=s.stage===I.feastsetup,meal=s.stage===I.feast,active=setup||meal;drumsticks15.forEach(g=>g.visible=meal);benches15.forEach(g=>g.visible=meal||(setup&&s.feastsetup>.82));if(!active){diners15.at(-1).g.children.at(-1).visible=false;return;}
 const carry=setup?smooth(clamp((s.feastsetup-.12)/.70)):1,lift=setup?.23*Math.sin(Math.PI*clamp(s.feastsetup/.87)):0;
 feastGroup.position.set(lerp(tableStart15.x,tableEnd15.x,carry),lift,lerp(tableStart15.z,tableEnd15.z,carry));feastGroup.visible=state.atmosphere;tableFood15.forEach(o=>o.visible=meal);feastFood.forEach(o=>o.visible=false);dogFeedingGroup.position.set(tableEnd15.x,0,tableEnd15.z);
 let seated=0,clinks=[];
 if(setup){groups.crew.visible=state.workers;crewFeastBowls.forEach(b=>b.visible=false);builderBowls.forEach(b=>b.visible=false);makerBowl.visible=false;const carriers=[builders[0],builders[1],crew[0],crew[1]],spots=[[-3.00,-.36],[-3.00,.36],[3.00,-.36],[3.00,.36]];carriers.forEach((w,i)=>{const[x,z]=spots[i],xx=feastGroup.position.x+x,zz=feastGroup.position.z+z;w.g.visible=state.workers;poseHuman(w,xx,zz,x<0?Math.PI/2:-Math.PI/2,'carry',s.t,groundHeightAt(xx,zz,s));w.tool.visible=false;for(let j=0;j<2;j++)setHandWorld15(w,j,new THREE.Vector3(feastGroup.position.x+Math.sign(x)*2.77,feastGroup.position.y+.73,feastGroup.position.z+z+(j?.10:-.10)));});
 for(let i=2;i<6;i++){const w=builders[i],x=-3+(i-2)*1.9,z=-6.72;w.g.visible=state.workers;poseHuman(w,x,z,Math.PI,'carry',s.t,groundHeightAt(x,z,s));}siteStatus.roles=['四人抬桌到前院','摆凳','准备酒碗'];
 }else{
 groups.crew.visible=state.workers;const arriving=clamp(s.feast/.27);
 diners15.forEach((w,k)=>{const seat=mealSeats15[k];if(arriving<1){const x=tableEnd15.x+seat[0],tz=tableEnd15.z+seat[1],startZ=seat[1]<0?-10.95:-6.60,z=lerp(startZ,tz,smooth(arriving));w.g.visible=(k<13?state.workers:state.atmosphere);poseHuman(w,x,z,seat[2],arriving<.85?'walk':'watch',s.t,groundHeightAt(x,z,s));w.tool.visible=false;dinerBowls15[k].visible=false;}else{poseDiner15(w,dinerBowls15[k],seat,k,s.t,s);seated++;}});
 if(arriving>=1){for(const[i,j]of[[0,1],[2,3],[4,5],[6,7],[8,9],[10,11]]){const a=diners15[i],b=diners15[j],q=.5+.5*Math.sin(s.t*1.35+i*.22),wa=a.g.localToWorld(a.hands[1].position.clone()),wb=b.g.localToWorld(b.hands[1].position.clone()),mid=new THREE.Vector3((a.g.position.x+b.g.position.x)/2,.94,(a.g.position.z+b.g.position.z)/2+.08*(i<6?1:-1)),dir=b.g.position.clone().sub(a.g.position).setY(0).normalize(),ta=mid.clone().addScaledVector(dir,-.075),tb=mid.clone().addScaledVector(dir,.075);setHandWorld15(a,1,wa.lerp(ta,smooth(q)));setHandWorld15(b,1,wb.lerp(tb,smooth(q)));dinerBowls15[i].position.copy(a.hands[1].position);dinerBowls15[j].position.copy(b.hands[1].position);clinks.push({a:a.id,b:b.id,phase:q,targetSeparation:.15});}}
 const allDogs=[{g:dog,legs:dogLegs,head:dogHead,tail,offset:.085},...extraDogs.map(e=>({g:e.g,legs:e.legs,head:e.head,tail:e.tail,offset:e.footOffset}))],fed=s.feast>.72;
 allDogs.forEach((d,i)=>{const p=waitDogSpots15[i],x=tableEnd15.x+p[0],z=tableEnd15.z+p[1],gy=groundHeightAt(x,z,s);d.g.position.set(x,gy-d.offset+.012,z);d.g.rotation.y=0;d.legs.forEach(g=>g.rotation.x=0);d.head.rotation.x=fed?.46+.07*Math.sin(s.t*3+i):-.12+.04*Math.sin(s.t+i);d.tail.rotation.z=.72*Math.sin(s.t*(7.6+i*.6)+i);if(i===0){animalGroundState.dog=.012;dogState={...dogState,position:d.g.position.toArray(),speed:fed?'fed_after_wait':'waiting_wagging',outsideWorkArea:true};}else{animalGroundState.extraDogs[i-1]=.012;extraDogStates[i-1]={...extraDogStates[i-1],position:d.g.position.toArray(),mode:fed?'fed_after_wait':'waiting_wagging',groundClearance:.012};}});
 dogFeedingGroup.visible=state.atmosphere&&fed;village.chickens.forEach(c=>c.g.visible=false);siteStatus.roles=['前院落座','相邻碰碗','端菜','院后犬只摇尾等饭'];}
 mealState15={stage:setup?'搬桌与摆凳':'前院入席',tableTravel:carry,tableLift:lift,constructionPresent:[...builders,maker,...crew,...pushers].filter(w=>w.g.visible).length,dinersSeated:seated,totalDiners:17,waitingDogs:meal&&s.feast<=.72?5:0,fedDogs:meal&&s.feast>.72?5:0,clinks};
}
// Make the front court a small flattened earth work area. Preserve the surrounding terrain.
const groundPrevious15=groundHeightAt;
groundHeightAt=function(x,z,s){const h=groundPrevious15(x,z,s),mx=1-smooth((Math.abs(x)-5.20)/1.20),mz=1-smooth((Math.abs(z+8.38)-2.05)/.80),f=mx*mz*smooth(s.levelled);return lerp(h,0,f);};
function settleGroundCrew15(s){if(s.groundfloor<=0)return;const onWalk=new Set(walkingState15.map(w=>w.id));
 for(const w of[...builders,maker,...crew,...pushers,cook,guest1,guest2,ritualVisitor]){if(!w.g.visible||w.g.position.y>1.05||onWalk.has(w.id))continue;let h=groundHeightAt(w.g.position.x,w.g.position.z,s);
 for(const o of groundFinishMembers){if(!o.visible)continue;const b=new THREE.Box3().setFromObject(o);if(w.g.position.x>=b.min.x&&w.g.position.x<=b.max.x&&w.g.position.z>=b.min.z&&w.g.position.z<=b.max.z)h=Math.max(h,b.max.y);}
 w.g.updateMatrixWorld(true);const sole=Math.min(...w.feet.map(f=>new THREE.Box3().setFromObject(f).min.y));if(sole<h+.003)w.g.position.y+=h+.003-sole;}}
const evaluatePrevious15=evaluate;
evaluate=function(t){const result=evaluatePrevious15(t);updateWalking15(result);updateMeal15(result);settleGroundCrew15(result);scene.updateMatrixWorld(true);return result;};
function startWalkInspection15(){state.playing=false;walkReplay15.enabled=true;walkReplay15.time=0;state.doorManual=false;evaluate(STAGES[I.groundfloor].end-.001);setView('walk');state.director=false;state.playing=true;updatePlay();return true;}

function bodyClearanceProbe15(){scene.updateMatrixWorld(true);const obstacles=[];
 for(const o of uprightObstacle15){if(visible15(o)&&!o.userData.record.id.startsWith('RAFTER-'))obstacles.push({id:o.userData.record.id,bb:new THREE.Box3().setFromObject(o)});}
 const hits=[],soleHits=[];
 for(let k=0;k<walkingState15.length;k++){const w=builders[k];for(const[part,name,margin]of[[w.torso,'torso',.012],[w.head,'head',.01]]){const bb=new THREE.Box3().setFromObject(part);bb.expandByScalar(-margin);for(const o of obstacles){if(bb.intersectsBox(o.bb))hits.push({worker:w.id,part:name,obstacle:o.id});}}
  const hatBox=new THREE.Box3().setFromObject(w.hat),ceil=ceiling15(w.g.position.x,w.g.position.z,w.g.position.y);if(hatBox.max.y>ceil.y-.008)hits.push({worker:w.id,part:'hat/ceiling',obstacle:ceil.id,clearance:ceil.y-hatBox.max.y});
  for(const foot of w.feet){if(!foot.geometry.boundingBox)foot.geometry.computeBoundingBox();const box=foot.geometry.boundingBox,pts=[[0,0],[box.min.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z],[box.max.x,box.min.z]];for(const[x,z]of pts){const pt=foot.localToWorld(new THREE.Vector3(x,box.min.y,z)),sp=surfaceAt15(pt.x,pt.z,snapshot);if(pt.y<sp.y-.012)soleHits.push({worker:w.id,id:sp.id,penetration:sp.y-pt.y});}}}
 return{bodyHits:hits,soleHits};}
function auditStair15(){scene.updateMatrixWorld(true);const tests=[],add=(id,pass,detail)=>tests.push({id,pass:!!pass,detail});
 const topBox=new THREE.Box3().setFromObject(topLanding),midBox=new THREE.Box3().setFromObject(stairLanding),baseBox=new THREE.Box3().setFromObject(bottomLanding);
 add('TOP_LANDING_FLUSH',Math.abs(topBox.max.y-P.floorTop)<1e-6,{landing:topBox.max.y,floor:P.floorTop});
 add('TOP_DOES_NOT_COVER_TREADS',Math.abs(topBox.min.z-(-3.60))<1e-6&&stairTreads.filter(o=>o.userData.record.id.includes('UPPER')).every(o=>new THREE.Box3().setFromObject(o).max.z<=topBox.min.z+1e-6),'上跑踏步终止于平台前缘');
 add('BOTTOM_PAD_BEARING',baseBox.min.y<0&&Math.abs(baseBox.max.y-.21)<1e-6,{bottom:baseBox.min.y,top:baseBox.max.y});
 let runEdges=[];for(const run of['LOWER','UPPER']){const base=run==='LOWER'?.21:landingY,heights=stairTreads.filter(o=>o.userData.record.id.includes(run)).map(o=>new THREE.Box3().setFromObject(o).max.y).sort((a,b)=>a-b);let prev=base;for(const h of heights){runEdges.push(h-prev);prev=h;}runEdges.push((run==='LOWER'?landingY:P.floorTop)-prev);}
 add('RISERS_UNIFORM',runEdges.length===16&&runEdges.every(h=>Math.abs(h-stairRise)<1e-6),{count:runEdges.length,rise:stairRise,min:Math.min(...runEdges),max:Math.max(...runEdges)});
 let overlaps=[];const tops=[topLanding,stairLanding,bottomLanding];for(const o of stairTreads){const a=new THREE.Box3().setFromObject(o);for(const p of tops){const b=new THREE.Box3().setFromObject(p),x=Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x),z=Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z);if(x>.005&&z>.005)overlaps.push([o.userData.record.id,p.userData.record.id]);}}
 add('NO_TREAD_LANDING_OVERLAP',overlaps.length===0,overlaps);
 // Raycasts check two contact lines under every tread, using the rendered stringer geometry.
 const contacts=[],rc=new THREE.Raycaster();for(const o of stairTreads){const r=walkSurfaces.find(v=>v.obj===o),low=o.userData.record.id.includes('LOWER'),str=stairBearers.filter(v=>v.userData.record.id.startsWith(low?'STAIR-LOWER-STRING':'STAIR-UPPER-STRING'));
 for(const side of[-1,1]){const x=(r.x0+r.x1)/2+(low?0:side*.44),z=(r.z0+r.z1)/2+(low?side*.44:0);rc.set(new THREE.Vector3(x,r.top+1,z),new THREE.Vector3(0,-1,0));const hits=rc.intersectObjects(str,false);const hit=hits[0];contacts.push({id:r.id,side,gap:hit?r.top-S15.thickness-hit.point.y:null});}}
 add('TREADS_TOUCH_BOTH_STRINGERS',contacts.length===28&&contacts.every(c=>c.gap!==null&&Math.abs(c.gap)<.010),contacts);
 return{passed:tests.filter(t=>t.pass).length,total:tests.length,pass:tests.every(t=>t.pass),tests};}
const auditPrevious15=geometricAudit;
geometricAudit=function(){const a=auditPrevious15(),extra=auditStair15();a.tests.push(...extra.tests);if(walkingState15.length)a.tests.push({id:'WALKING_SOLES_CLEAR',pass:walkingState15.every(w=>w.feet.every(f=>f.clearance>=-.012)),detail:walkingState15.map(w=>({id:w.id,feet:w.feet}))});if(snapshot.stage===I.feast&&snapshot.feast>.3)a.tests.push({id:'FOUR_LEGS_ON_FRONT_COURT',pass:drumsticks15.every(g=>g.visible)&&feastGroup.position.z+.59<-6.0&&!village.chickens.some(c=>c.g.visible),detail:mealProbe15()});a.passed=a.tests.filter(t=>t.pass).length;a.total=a.tests.length;a.pass=a.passed===a.total;return a;};
$('#descentDemo15').onclick=()=>{walkReplay15.enabled=false;state.playing=false;evaluate(STAGES[I.descend].start);setView('walk');state.director=false;state.playing=true;updatePlay();};
$('#walkTest15').onclick=startWalkInspection15;
$('#doorToggle15').onclick=()=>{state.doorManual=!state.doorManual;evaluate(state.time);};
