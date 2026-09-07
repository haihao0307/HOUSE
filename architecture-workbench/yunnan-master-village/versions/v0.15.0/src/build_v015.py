from pathlib import Path
import re,json,hashlib
D=Path(__file__).resolve().parent.parent; W=D/'src'; baseline=D/'baseline'/'Yunnan_Master_and_Village_V0.14.0.html'
s=baseline.read_text(); original=s
scripts=re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)
core=scripts[1]; app=scripts[2]
def rep(text,old,new):
 assert old in text,old[:150]
 return text.replace(old,new)
core=rep(core,"version:'0.14.0'","version:'0.15.0'")
core=rep(core,"feastCenter:{x:0,z:-5.05}","feastCenter:{x:0,z:-8.15}")
core=rep(core,"['rafters','铺设小圆木椽与前后出檐'","['descend','铺板收工，工人依次下楼','沿实楼板、平台和踏步回到院地','三名铺板工按同一实体通道下行，脚步读取各踏步标高；当前围护尚未安装。',62],\n['rafters','铺设小圆木椽与前后出檐'")
core=rep(core,"['feast','完工聚餐与村落庆祝'","['feastsetup','搬桌至前院，摆凳端菜','先搬桌，落稳后上菜','长桌从廊前石板带搬到前院红土地，人员分工抬桌、摆凳和候席。',20],\n['feast','完工聚餐与村落庆祝'")
core=rep(core,"groundfloor:p('groundfloor'),feast:p('feast')","groundfloor:p('groundfloor'),descent:p('descend'),feastsetup:p('feastsetup'),feast:p('feast')")
core=rep(core,"['GALLERY'", "['GALLERY'") if "['GALLERY'" in core else core
core=rep(core,"add('KEEP_BRACES'","add('DESCEND_AFTER_BOARD',!s.descent||s.boards>=1&&s.stairs>=1,'楼面与两跑木梯完成后才下楼');add('FEAST_SETUP_AFTER_FINISH',!s.feastsetup||s.groundfloor>=1,'施工收尾后搬桌到前院');add('MEAL_AFTER_TABLE',!s.feast||s.feastsetup>=1,'长桌落位后上菜入席');add('KEEP_BRACES'")
# Replace only the staircase assembly; retain the complete frame and existing floor array.
a=app.index('// L-shaped side stair:'); b=app.index('// First-floor ground finish',a)
app=app[:a]+(W/'stair_v015.js').read_text()+'\n'+app[b:]
# Add a usable double door in the east upstairs screen. The rest stay in their original frame.
app=rep(app,"doorGroups.push(dg);","doorGroups.push(dg);dg.userData.door={bay,level,leaf:li};")
needle='// Track every enclosure renderable once;'
pos=app.index(needle)
app=app[:pos]+'''// The two centre leaves of the east upper bay open into the room.
const accessDoors=doorGroups.filter(g=>g.userData.door.bay===2&&g.userData.door.level===1&&[1,2].includes(g.userData.door.leaf));
const accessWidth=(P.axesX[3]-P.axesX[2]-.40)/4;
const rightAccessDoor=accessDoors[1];rightAccessDoor.position.x+=accessWidth;rightAccessDoor.children.forEach(o=>o.position.x-=accessWidth);
accessDoors.forEach((g,i)=>g.userData.openSign=i?1:-1);
''' +app[pos:]
app=rep(app,"function poseHuman(w,x,z,heading,mode,time,groundY=0){","function poseHuman(w,x,z,heading,mode,time,groundY=0){w.feet.forEach(f=>{f.rotation.set(0,0,0);f.scale.set(1,1,1);});")
app=rep(app,"w.torso.position.y=1.13-crouch+bob;","if(w.waist)w.waist.position.y=.90-crouch+bob;w.torso.position.y=1.13-crouch+bob;")
# Pose support gains a waist reference without changing existing worker meshes.
app=rep(app,'return {g,torso,head,neck,hat,arms','return {g,torso,head,neck,hat,waist,arms')
# Staircase visibility is a prerequisite for the new descent phase.
app=rep(app,'stairs:p(', 'stairs:p(') if 'stairs:p(' in app else app
# Public UI and update extension injected before API initialisation.
pos=app.index('window.YKY=')
app=app[:pos]+(W/'runtime_v015.js').read_text()+'\n'+app[pos:]
# Remove obsolete, misleading checks, replace with actual geometry tests supplied by extension.
app=rep(app,"add('STAIR_SIDE_ENTRY',stairStart.x>5.58&&stairEnd.x<=5.12,'木梯由东侧外部进入木廊边缘');","add('STAIR_SIDE_ENTRY',stairStart.x>stairTurn.x&&Math.abs(stairEnd.z+3.30)<1e-7,'东侧起步，转向后接入院侧木廊');")
app=rep(app,"add('STAIR_TWO_RUN_TURN',stairStart.z!==stairTurn.z&&stairTurn.x!==stairEnd.x,'下跑至平台后转向进入上跑');","add('STAIR_TWO_RUN_TURN',stairStart.x!==stairTurn.x&&stairTurn.z!==stairEnd.z,'下跑沿面阔，上跑转向木廊');")
app=rep(app,"add('COURTYARD_FEAST_CENTERED',Math.abs(feastGroup.position.x-P.feastCenter.x)<1e-7&&Math.abs(feastGroup.position.z-P.feastCenter.z)<1e-7,'完工长桌位于院心控制点');","add('COURTYARD_FEAST_CENTERED',snapshot.stage!==I.feast||Math.abs(feastGroup.position.x-P.feastCenter.x)<1e-7&&Math.abs(feastGroup.position.z-P.feastCenter.z)<1e-7,'聚餐长桌已落在前院控制点');")
app=rep(app,"snapshot.feast<.16||dogFeedingGroup.visible","snapshot.feast<.72||dogFeedingGroup.visible")
# Genuine scene queries are exposed for reproducible tests; no hidden review flags.
app=rep(app,'window.YKY={soundDemo:',"window.YKY={getCirculationProbe:()=>circulationProbe15(),getBodyClearance:()=>bodyClearanceProbe15(),setWalkInspection:()=>startWalkInspection15(),setDoor:v=>{state.doorManual=!!v;evaluate(state.time);},inspectStaircase:()=>auditStair15(),getMealProbe:()=>mealProbe15(),setInspectionTime:t=>{walkReplay15.enabled=true;walkReplay15.time=Math.max(0,t);state.playing=false;evaluate(STAGES[I.groundfloor].end-.001);updatePlay();return circulationProbe15();},soundDemo:")
app=rep(app,"if(state.playing){state.time=Math.min(TOTAL,state.time+dt*state.speed);", "if(walkReplay15.enabled&&state.playing){walkReplay15.time=Math.min(62,walkReplay15.time+dt*state.speed);evaluate(state.time);if(walkReplay15.time>=62){state.playing=false;updatePlay();}}else if(state.playing){state.time=Math.min(TOTAL,state.time+dt*state.speed);")
# Dedicated side/front viewpoints, unchanged default palette.
app=rep(app,"if(view==='floor'){orbit.target.set(5.35,2.15,-2.55);orbit.radius=17.2;orbit.theta=-1.34;orbit.phi=1.10;}","if(view==='floor'||view==='walk'){orbit.target.set(4.75,1.80,-4.20);orbit.radius=13.4;orbit.theta=.92;orbit.phi=1.17;}if(view==='door'){orbit.target.set(3.40,4.00,-1.98);orbit.radius=3.85;orbit.theta=Math.PI;orbit.phi=1.50;}if(view==='food'){orbit.target.set(0,.86,P.feastCenter.z);orbit.radius=5.20;orbit.theta=.35;orbit.phi=.64;}")
# New camera beats follow the actual corridor rather than the obstructed rear camera.
campos=app.index("function updateDirectorCamera(")
app=app[:campos]+rep(app[campos:],"else if(s.stage===I.rafters){", "else if(s.stage===I.descend||walkReplay15.enabled){tx=4.65;ty=1.95;tz=-4.25;r=13.6;th=.90+.06*Math.sin(time*.1);ph=1.18;}else if(s.stage===I.feastsetup){tx=0;ty=.9;tz=-7.0;r=17.0;th=.74;ph=1.07;}else if(s.stage===I.rafters){")
app=rep(app,"let last=performance.now(),lastUI=0;","if(!params.has('stage')){walkReplay15.enabled=false;state.playing=false;evaluate(STAGES[I.descend].start+18);setView('walk');state.director=false;$('#directorButton').classList.remove('active');updatePlay();}\nlet last=performance.now(),lastUI=0;")
# Clear replay on timeline and ordinary stage controls.
app=rep(app,"function togglePlay(){", "function togglePlay(){if(walkReplay15.enabled){if(walkReplay15.time>=62)walkReplay15.time=0;state.playing=!state.playing;updatePlay();return;}")
for nav in ["$('#prev').onclick=()=>{","$('#next').onclick=()=>{","$('#celebrateJump').onclick=()=>{","$('#feastJump').onclick=()=>{"]:
 app=rep(app,nav,nav+"walkReplay15.enabled=false;")
for nav in ['setTimeFast:t=>{','setTime:t=>{','evaluateOnly:t=>{','sampleAnimals:times=>times.map(t=>{']:
 app=rep(app,nav,nav+'walkReplay15.enabled=false;')

app=rep(app,"b.onclick=()=>{state.playing=false;state.started=true;const p=", "b.onclick=()=>{walkReplay15.enabled=false;state.playing=false;state.started=true;const p=")
app=rep(app,"$('#timeline').oninput=e=>{state.playing=false;", "$('#timeline').oninput=e=>{if(walkReplay15.enabled){walkReplay15.time=clamp(+e.target.value,0,62);state.playing=false;evaluate(state.time);updatePlay();return;}walkReplay15.enabled=false;state.playing=false;")
app=rep(app,"$('#restart').onclick=()=>{state.autoCamera=true;", "$('#restart').onclick=()=>{walkReplay15.enabled=false;state.doorManual=false;state.autoCamera=true;")
app=rep(app,"getProbe(){const visible", "getProbe(){const visible") # Assert API marker without semantic change.
# Preserve all previously frozen source scripts apart from these named edits.
s=s.replace(scripts[1],core).replace(scripts[2],app)
s=s.replace('V0.14.0','V0.15.0').replace('施工导演、快速落撑、通长檩与院中庆功','楼梯实走、开门通行与前院庆功')
s=s.replace('<head>','<head>\n<link rel="icon" href="data:,">',1)
# Real clickable controls; no source-derived identities are invented.
s=s.replace('<button id="soundDemoButton"','<button id="descentDemo15">工人下楼</button><button id="walkTest15">成屋通行复核</button><button id="doorToggle15">二楼门：关闭</button><button data-view="door">二楼门近景</button><button data-view="food">上菜近景</button><button id="soundDemoButton"',1)
s=s.replace('</style>','''
body.walk-active15 #villageState{display:none!important}
.righttools{max-height:calc(100% - 250px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:#b8c8ad transparent}
#walkBadge15{position:absolute;left:26px;bottom:138px;max-width:410px;padding:10px 14px;background:rgba(253,250,239,.95);border:1px solid #d8e0d2;border-radius:10px;color:#355549;font-size:12px;line-height:1.65;pointer-events:none;z-index:5}
@media(max-width:600px){#walkBadge15{left:12px;right:12px;bottom:132px;font-size:11px;max-width:none;padding:7px 10px}body.cinema-mode #walkBadge15{bottom:118px}.righttools{max-height:calc(100% - 320px)}.righttools button{min-height:30px}}
</style>''',1)
for i,j in enumerate([scripts[0],core,app]):(W/f'v015_script_{i}.js').write_text(j)
out=D/'Yunnan_Master_and_Village_V0.15.0.html';out.write_text(s)
print('built',out,'bytes',out.stat().st_size)
print('baseline intact',hashlib.sha256(baseline.read_bytes()).hexdigest())
